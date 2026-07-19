-- All administrators share the same workspace: any signed-in admin can see
-- and manage every game, not just the ones they personally created.
-- owner_id stays on games (useful "created by" metadata) but is no longer
-- used as an access-control gate anywhere.

create or replace function public.is_admin()
returns boolean as $$
  select exists (select 1 from public.administrators where id = auth.uid());
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- RLS: replace every owner_id = auth.uid() check with is_admin()
-- ============================================================

drop policy if exists "games_owner_all" on public.games;
create policy "games_owner_all" on public.games
  for all using (public.is_admin());

drop policy if exists "settings_owner_all" on public.game_settings;
create policy "settings_owner_all" on public.game_settings
  for all using (public.is_admin());

drop policy if exists "questions_owner_all" on public.questions;
create policy "questions_owner_all" on public.questions
  for all using (public.is_admin());

drop policy if exists "choices_owner_all" on public.question_choices;
create policy "choices_owner_all" on public.question_choices
  for all using (public.is_admin());

drop policy if exists "bands_owner_all" on public.scoring_bands;
create policy "bands_owner_all" on public.scoring_bands
  for all using (public.is_admin());

drop policy if exists "sessions_owner_all" on public.game_sessions;
create policy "sessions_owner_all" on public.game_sessions
  for all using (public.is_admin());

drop policy if exists "players_owner_read" on public.players;
create policy "players_owner_read" on public.players
  for select using (public.is_admin());

drop policy if exists "players_owner_update" on public.players;
create policy "players_owner_update" on public.players
  for update using (public.is_admin());

drop policy if exists "answers_owner_read" on public.answers;
create policy "answers_owner_read" on public.answers
  for select using (public.is_admin());

drop policy if exists "events_owner_read" on public.game_events;
create policy "events_owner_read" on public.game_events
  for select using (public.is_admin());

-- ============================================================
-- FUNCTIONS: replace internal owner_id = auth.uid() checks with is_admin()
-- ============================================================

create or replace function public.start_session(p_game_id uuid)
returns jsonb as $$
declare
  v_game record;
  v_code text;
  v_question_count integer;
  v_session_id uuid;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'Access denied');
  end if;

  select * into v_game from public.games where id = p_game_id;
  if not found then
    return jsonb_build_object('error', 'Game not found');
  end if;

  select count(*) into v_question_count from public.questions where game_id = p_game_id;
  if v_question_count = 0 then
    return jsonb_build_object('error', 'Game must have at least one question');
  end if;

  v_code := public.generate_room_code();

  insert into public.game_sessions (game_id, room_code, status, published_at)
  values (p_game_id, v_code, 'published', now())
  returning id into v_session_id;

  insert into public.game_events (session_id, event_type, event_data, actor_type, actor_id)
  values (v_session_id, 'game_published', jsonb_build_object('room_code', v_code), 'admin', auth.uid());

  return jsonb_build_object('session_id', v_session_id, 'room_code', v_code, 'status', 'published');
end;
$$ language plpgsql security definer;

create or replace function public.start_game(p_session_id uuid)
returns jsonb as $$
declare
  v_session record;
  v_settings record;
  v_player_count integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'Access denied');
  end if;

  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('error', 'Game not found');
  end if;

  if v_session.status != 'lobby' then
    return jsonb_build_object('error', 'Game must be in lobby state to start');
  end if;

  select count(*) into v_player_count from public.players where session_id = p_session_id and status = 'active';
  if v_player_count = 0 then
    return jsonb_build_object('error', 'At least one player must be connected to start');
  end if;

  select * into v_settings from public.game_settings where game_id = v_session.game_id;

  update public.game_sessions set
    status = 'active',
    active_sub_state = 'countdown',
    started_at = now()
  where id = p_session_id;

  insert into public.game_events (session_id, event_type, event_data, actor_type, actor_id)
  values (p_session_id, 'game_started', jsonb_build_object('player_count', v_player_count), 'admin', auth.uid());

  return jsonb_build_object(
    'status', 'active',
    'sub_state', 'countdown',
    'countdown_seconds', v_settings.preparation_countdown_seconds,
    'player_count', v_player_count
  );
end;
$$ language plpgsql security definer;

create or replace function public.next_question(p_session_id uuid)
returns jsonb as $$
declare
  v_session record;
  v_next_question record;
  v_next_index integer;
  v_total_questions integer;
  v_duration constant integer := 30;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'Access denied');
  end if;

  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('error', 'Game not found');
  end if;

  if v_session.status != 'active' then
    return jsonb_build_object('error', 'Game is not active');
  end if;

  select count(*) into v_total_questions from public.questions where game_id = v_session.game_id;

  v_next_index := coalesce(v_session.current_question_index, 0) + 1;

  if v_next_index > v_total_questions then
    update public.game_sessions set
      status = 'completed',
      active_sub_state = null,
      completed_at = now()
    where id = p_session_id;

    insert into public.game_events (session_id, event_type, event_data, actor_type, actor_id)
    values (p_session_id, 'game_completed', '{}', 'admin', auth.uid());

    return jsonb_build_object('status', 'completed');
  end if;

  select * into v_next_question
  from public.questions
  where game_id = v_session.game_id and question_order = v_next_index;

  if not found then
    return jsonb_build_object('error', format('Question at order %s not found', v_next_index));
  end if;

  v_start := now();
  v_end := v_start + (v_duration || ' seconds')::interval;

  update public.game_sessions set
    active_sub_state = 'question_active',
    current_question_id = v_next_question.id,
    current_question_index = v_next_index,
    question_started_at = v_start,
    question_ends_at = v_end
  where id = p_session_id;

  insert into public.game_events (session_id, event_type, event_data, actor_type, actor_id)
  values (p_session_id, 'question_started', jsonb_build_object(
    'question_index', v_next_index,
    'question_id', v_next_question.id,
    'duration_seconds', v_duration
  ), 'admin', auth.uid());

  return jsonb_build_object(
    'question_id', v_next_question.id,
    'question_index', v_next_index,
    'total_questions', v_total_questions,
    'started_at', v_start,
    'ends_at', v_end,
    'duration_seconds', v_duration
  );
end;
$$ language plpgsql security definer;

create or replace function public.end_question(p_session_id uuid)
returns jsonb as $$
declare
  v_session record;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'Access denied');
  end if;

  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('error', 'Game not found');
  end if;

  if v_session.active_sub_state != 'question_active' then
    return jsonb_build_object('error', 'No active question to end');
  end if;

  update public.game_sessions set
    active_sub_state = 'question_results',
    question_ends_at = now()
  where id = p_session_id;

  insert into public.game_events (session_id, event_type, event_data, actor_type, actor_id)
  values (p_session_id, 'question_ended', jsonb_build_object('question_id', v_session.current_question_id, 'ended_early', true), 'admin', auth.uid());

  return jsonb_build_object('status', 'question_results');
end;
$$ language plpgsql security definer;

create or replace function public.pause_game(p_session_id uuid)
returns jsonb as $$
declare
  v_session record;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'Access denied');
  end if;

  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('error', 'Game not found');
  end if;

  if v_session.status != 'active' or v_session.active_sub_state = 'paused' then
    return jsonb_build_object('error', 'Game cannot be paused in its current state');
  end if;

  update public.game_sessions set
    paused_from_state = active_sub_state,
    active_sub_state = 'paused'
  where id = p_session_id;

  insert into public.game_events (session_id, event_type, event_data, actor_type, actor_id)
  values (p_session_id, 'game_paused', jsonb_build_object('paused_from', v_session.active_sub_state), 'admin', auth.uid());

  return jsonb_build_object('status', 'paused', 'paused_from', v_session.active_sub_state);
end;
$$ language plpgsql security definer;

create or replace function public.resume_game(p_session_id uuid)
returns jsonb as $$
declare
  v_session record;
  v_remaining_ms integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'Access denied');
  end if;

  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('error', 'Game not found');
  end if;

  if v_session.active_sub_state != 'paused' then
    return jsonb_build_object('error', 'Game is not paused');
  end if;

  if v_session.paused_from_state = 'question_active' and v_session.question_ends_at is not null then
    v_remaining_ms := extract(epoch from (v_session.question_ends_at - now())) * 1000;
    if v_remaining_ms > 0 then
      update public.game_sessions set
        active_sub_state = paused_from_state,
        paused_from_state = null,
        question_ends_at = now() + (v_remaining_ms || ' milliseconds')::interval
      where id = p_session_id;
    else
      update public.game_sessions set
        active_sub_state = 'question_results',
        paused_from_state = null
      where id = p_session_id;
    end if;
  else
    update public.game_sessions set
      active_sub_state = paused_from_state,
      paused_from_state = null
    where id = p_session_id;
  end if;

  insert into public.game_events (session_id, event_type, event_data, actor_type, actor_id)
  values (p_session_id, 'game_resumed', jsonb_build_object('resumed_to', v_session.paused_from_state), 'admin', auth.uid());

  return jsonb_build_object('status', 'active', 'sub_state', v_session.paused_from_state);
end;
$$ language plpgsql security definer;

create or replace function public.remove_player(p_session_id uuid, p_player_id uuid, p_reason text default 'Removed by host')
returns jsonb as $$
declare
  v_player record;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'Access denied');
  end if;

  if not exists (select 1 from public.game_sessions where id = p_session_id) then
    return jsonb_build_object('error', 'Game not found');
  end if;

  select * into v_player from public.players where id = p_player_id and session_id = p_session_id;
  if not found then
    return jsonb_build_object('error', 'Player not found');
  end if;

  update public.players set
    status = 'removed',
    removed_at = now(),
    removed_reason = p_reason
  where id = p_player_id;

  insert into public.game_events (session_id, event_type, event_data, actor_type, actor_id)
  values (p_session_id, 'player_removed', jsonb_build_object('player_name', v_player.display_name, 'reason', p_reason), 'admin', auth.uid());

  return jsonb_build_object('removed', true, 'player_name', v_player.display_name);
end;
$$ language plpgsql security definer;
