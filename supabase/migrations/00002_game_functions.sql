-- Multiplayer Quiz Application - Server-Side Functions
-- These run with SECURITY DEFINER (elevated privileges) to bypass RLS
-- and enforce business logic atomically.

-- ============================================================
-- ROOM CODE GENERATION
-- ============================================================

create or replace function public.generate_room_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  i integer;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    -- Ensure uniqueness among active games
    if not exists (
      select 1 from public.games
      where room_code = code
      and status in ('published', 'lobby', 'active')
    ) then
      return code;
    end if;
  end loop;
end;
$$ language plpgsql volatile;

-- ============================================================
-- PUBLISH GAME (generates room code)
-- ============================================================

create or replace function public.publish_game(p_game_id uuid)
returns jsonb as $$
declare
  v_game record;
  v_code text;
  v_question_count integer;
begin
  select * into v_game from public.games where id = p_game_id and owner_id = auth.uid();
  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
  end if;

  if v_game.status != 'draft' then
    return jsonb_build_object('error', 'Only draft games can be published');
  end if;

  select count(*) into v_question_count from public.questions where game_id = p_game_id;
  if v_question_count = 0 then
    return jsonb_build_object('error', 'Game must have at least one question');
  end if;

  v_code := public.generate_room_code();

  update public.games
  set status = 'published',
      room_code = v_code,
      published_at = now()
  where id = p_game_id;

  insert into public.game_events (game_id, event_type, event_data, actor_type, actor_id)
  values (p_game_id, 'game_published', jsonb_build_object('room_code', v_code), 'admin', auth.uid());

  return jsonb_build_object('room_code', v_code, 'status', 'published');
end;
$$ language plpgsql security definer;

-- ============================================================
-- PLAYER JOIN (atomic, enforces max players)
-- ============================================================

create or replace function public.join_game(
  p_room_code text,
  p_display_name text,
  p_session_token text
)
returns jsonb as $$
declare
  v_game record;
  v_settings record;
  v_player_count integer;
  v_existing_player record;
  v_token_hash text;
  v_player_id uuid;
  v_normalized_code text;
  v_normalized_name text;
begin
  v_normalized_code := upper(trim(p_room_code));
  v_normalized_name := trim(p_display_name);

  if char_length(v_normalized_name) < 2 or char_length(v_normalized_name) > 20 then
    return jsonb_build_object('error', 'Display name must be between 2 and 20 characters.');
  end if;

  -- Find the game and lock the row
  select * into v_game
  from public.games
  where room_code = v_normalized_code
    and status in ('published', 'lobby', 'active')
  for update;

  if not found then
    return jsonb_build_object('error', 'No game found with this code. Check the code and try again.');
  end if;

  -- Check if game accepts players
  if v_game.status = 'active' then
    select * into v_settings from public.game_settings where game_id = v_game.id;
    if not v_settings.allow_late_join then
      return jsonb_build_object('error', 'This game has already started and is not accepting new players.');
    end if;
  end if;

  select * into v_settings from public.game_settings where game_id = v_game.id;

  -- Check duplicate display names
  if not v_settings.allow_duplicate_display_names then
    if exists (
      select 1 from public.players
      where game_id = v_game.id
        and lower(display_name) = lower(v_normalized_name)
        and status != 'removed'
    ) then
      return jsonb_build_object('error', 'Someone already has that name. Try a different one.');
    end if;
  end if;

  -- Count active players and enforce limit
  select count(*) into v_player_count
  from public.players
  where game_id = v_game.id and status in ('active', 'disconnected');

  if v_player_count >= v_settings.max_players then
    return jsonb_build_object('error', format('This game is full (%s/%s players).', v_player_count, v_settings.max_players));
  end if;

  -- Hash the session token
  v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  -- Create the player
  insert into public.players (game_id, display_name, session_token_hash, status)
  values (v_game.id, v_normalized_name, v_token_hash, 'active')
  returning id into v_player_id;

  -- Transition game to lobby if it was published
  if v_game.status = 'published' then
    update public.games set status = 'lobby' where id = v_game.id;
  end if;

  insert into public.game_events (game_id, event_type, event_data, actor_type, actor_id)
  values (v_game.id, 'player_joined', jsonb_build_object('player_name', v_normalized_name), 'player', v_player_id);

  return jsonb_build_object(
    'player_id', v_player_id,
    'game_id', v_game.id,
    'game_name', v_game.name,
    'game_status', v_game.status,
    'player_count', v_player_count + 1
  );
end;
$$ language plpgsql security definer;

-- ============================================================
-- PLAYER RECONNECT
-- ============================================================

create or replace function public.reconnect_player(p_session_token text)
returns jsonb as $$
declare
  v_token_hash text;
  v_player record;
  v_game record;
begin
  v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  select p.*, g.name as game_name, g.status as game_status,
         g.active_sub_state, g.current_question_id, g.current_question_index,
         g.question_started_at, g.question_ends_at
  into v_player
  from public.players p
  join public.games g on g.id = p.game_id
  where p.session_token_hash = v_token_hash
    and p.status != 'removed'
    and g.status in ('lobby', 'active')
  order by p.joined_at desc
  limit 1;

  if not found then
    return jsonb_build_object('error', 'session_expired');
  end if;

  -- Mark player as active again
  update public.players
  set status = 'active', last_seen_at = now()
  where id = v_player.id;

  return jsonb_build_object(
    'player_id', v_player.id,
    'game_id', v_player.game_id,
    'game_name', v_player.game_name,
    'game_status', v_player.game_status,
    'active_sub_state', v_player.active_sub_state,
    'current_question_id', v_player.current_question_id,
    'current_question_index', v_player.current_question_index,
    'question_started_at', v_player.question_started_at,
    'question_ends_at', v_player.question_ends_at,
    'display_name', v_player.display_name,
    'total_score', v_player.total_score
  );
end;
$$ language plpgsql security definer;

-- ============================================================
-- SUBMIT ANSWER (atomic: validate, score, persist)
-- ============================================================

create or replace function public.submit_answer(
  p_session_token text,
  p_question_id uuid,
  p_choice_id uuid
)
returns jsonb as $$
declare
  v_token_hash text;
  v_player record;
  v_game record;
  v_settings record;
  v_question record;
  v_choice record;
  v_existing_answer record;
  v_elapsed_ms integer;
  v_points integer := 0;
  v_is_correct boolean;
  v_band record;
  v_now timestamptz;
begin
  v_now := now();
  v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  -- Validate player session
  select * into v_player
  from public.players
  where session_token_hash = v_token_hash and status = 'active';

  if not found then
    return jsonb_build_object('error', 'Invalid session.', 'accepted', false);
  end if;

  -- Validate game state
  select * into v_game
  from public.games
  where id = v_player.game_id
    and status = 'active'
    and active_sub_state = 'question_active'
    and current_question_id = p_question_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Question is not active.', 'accepted', false);
  end if;

  select * into v_settings from public.game_settings where game_id = v_game.id;

  -- Check if answer was already submitted
  select * into v_existing_answer
  from public.answers
  where player_id = v_player.id and question_id = p_question_id;

  if found then
    if v_settings.allow_answer_changes then
      -- Allow update: delete old answer and recalculate
      -- Revert previous score
      update public.players set
        total_score = total_score - v_existing_answer.points_awarded,
        correct_answer_count = correct_answer_count - (case when v_existing_answer.is_correct then 1 else 0 end),
        total_response_time_ms = total_response_time_ms - (case when v_existing_answer.is_correct then v_existing_answer.response_time_ms else 0 end)
      where id = v_player.id;

      delete from public.answers where id = v_existing_answer.id;
    else
      return jsonb_build_object(
        'accepted', false,
        'already_answered', true,
        'submitted_at', v_existing_answer.submitted_at
      );
    end if;
  end if;

  -- Check deadline
  if v_now > v_game.question_ends_at then
    return jsonb_build_object('error', 'Time is up! Your answer was not submitted in time.', 'accepted', false);
  end if;

  -- Calculate elapsed time
  v_elapsed_ms := extract(epoch from (v_now - v_game.question_started_at)) * 1000;

  -- Determine correctness
  select * into v_choice from public.question_choices where id = p_choice_id and question_id = p_question_id;
  if not found then
    return jsonb_build_object('error', 'Invalid choice.', 'accepted', false);
  end if;

  v_is_correct := v_choice.is_correct;

  -- Calculate points from scoring bands
  if v_is_correct then
    select * into v_band
    from public.scoring_bands
    where game_id = v_game.id
      and (question_id = p_question_id or question_id is null)
      and start_ms <= v_elapsed_ms
      and (
        (is_final_band and end_ms >= v_elapsed_ms) or
        (not is_final_band and end_ms > v_elapsed_ms)
      )
    order by question_id nulls last -- prefer question-specific bands
    limit 1;

    if found then
      v_points := v_band.points;
    end if;
  end if;

  -- Insert answer
  insert into public.answers (game_id, question_id, player_id, selected_choice_id, is_correct, response_time_ms, points_awarded, submitted_at)
  values (v_game.id, p_question_id, v_player.id, p_choice_id, v_is_correct, v_elapsed_ms, v_points, v_now);

  -- Update player denormalized scores
  update public.players set
    total_score = total_score + v_points,
    correct_answer_count = correct_answer_count + (case when v_is_correct then 1 else 0 end),
    total_response_time_ms = total_response_time_ms + (case when v_is_correct then v_elapsed_ms else 0 end),
    last_seen_at = v_now
  where id = v_player.id;

  -- Return result (conditionally include correctness based on settings)
  if v_settings.show_points_immediately then
    return jsonb_build_object(
      'accepted', true,
      'already_answered', false,
      'response_time_ms', v_elapsed_ms,
      'points_awarded', v_points,
      'is_correct', v_is_correct,
      'submitted_at', v_now
    );
  else
    return jsonb_build_object(
      'accepted', true,
      'already_answered', false,
      'response_time_ms', v_elapsed_ms,
      'submitted_at', v_now
    );
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================
-- START GAME
-- ============================================================

create or replace function public.start_game(p_game_id uuid)
returns jsonb as $$
declare
  v_game record;
  v_settings record;
  v_player_count integer;
begin
  select * into v_game from public.games where id = p_game_id and owner_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
  end if;

  if v_game.status != 'lobby' then
    return jsonb_build_object('error', 'Game must be in lobby state to start');
  end if;

  select count(*) into v_player_count from public.players where game_id = p_game_id and status = 'active';
  if v_player_count = 0 then
    return jsonb_build_object('error', 'At least one player must be connected to start');
  end if;

  select * into v_settings from public.game_settings where game_id = p_game_id;

  update public.games set
    status = 'active',
    active_sub_state = 'countdown',
    started_at = now()
  where id = p_game_id;

  insert into public.game_events (game_id, event_type, event_data, actor_type, actor_id)
  values (p_game_id, 'game_started', jsonb_build_object('player_count', v_player_count), 'admin', auth.uid());

  return jsonb_build_object(
    'status', 'active',
    'sub_state', 'countdown',
    'countdown_seconds', v_settings.preparation_countdown_seconds,
    'player_count', v_player_count
  );
end;
$$ language plpgsql security definer;

-- ============================================================
-- ADVANCE TO NEXT QUESTION
-- ============================================================

create or replace function public.next_question(p_game_id uuid)
returns jsonb as $$
declare
  v_game record;
  v_settings record;
  v_next_question record;
  v_next_index integer;
  v_total_questions integer;
begin
  select * into v_game from public.games where id = p_game_id and owner_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
  end if;

  if v_game.status != 'active' then
    return jsonb_build_object('error', 'Game is not active');
  end if;

  select count(*) into v_total_questions from public.questions where game_id = p_game_id;

  v_next_index := coalesce(v_game.current_question_index, 0) + 1;

  if v_next_index > v_total_questions then
    -- No more questions, complete the game
    update public.games set
      status = 'completed',
      active_sub_state = null,
      completed_at = now()
    where id = p_game_id;

    insert into public.game_events (game_id, event_type, event_data, actor_type, actor_id)
    values (p_game_id, 'game_completed', '{}', 'admin', auth.uid());

    return jsonb_build_object('status', 'completed');
  end if;

  select * into v_next_question
  from public.questions
  where game_id = p_game_id and question_order = v_next_index;

  if not found then
    return jsonb_build_object('error', format('Question at order %s not found', v_next_index));
  end if;

  select * into v_settings from public.game_settings where game_id = p_game_id;

  declare
    v_duration integer;
    v_start timestamptz;
    v_end timestamptz;
  begin
    v_duration := coalesce(v_next_question.duration_seconds, v_settings.default_question_duration_seconds);
    v_start := now();
    v_end := v_start + (v_duration || ' seconds')::interval;

    update public.games set
      active_sub_state = 'question_active',
      current_question_id = v_next_question.id,
      current_question_index = v_next_index,
      question_started_at = v_start,
      question_ends_at = v_end
    where id = p_game_id;

    insert into public.game_events (game_id, event_type, event_data, actor_type, actor_id)
    values (p_game_id, 'question_started', jsonb_build_object(
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
end;
$$ language plpgsql security definer;

-- ============================================================
-- END QUESTION EARLY
-- ============================================================

create or replace function public.end_question(p_game_id uuid)
returns jsonb as $$
declare
  v_game record;
begin
  select * into v_game from public.games where id = p_game_id and owner_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
  end if;

  if v_game.active_sub_state != 'question_active' then
    return jsonb_build_object('error', 'No active question to end');
  end if;

  update public.games set
    active_sub_state = 'question_results',
    question_ends_at = now()
  where id = p_game_id;

  insert into public.game_events (game_id, event_type, event_data, actor_type, actor_id)
  values (p_game_id, 'question_ended', jsonb_build_object('question_id', v_game.current_question_id, 'ended_early', true), 'admin', auth.uid());

  return jsonb_build_object('status', 'question_results');
end;
$$ language plpgsql security definer;

-- ============================================================
-- PAUSE / RESUME
-- ============================================================

create or replace function public.pause_game(p_game_id uuid)
returns jsonb as $$
declare
  v_game record;
begin
  select * into v_game from public.games where id = p_game_id and owner_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
  end if;

  if v_game.status != 'active' or v_game.active_sub_state = 'paused' then
    return jsonb_build_object('error', 'Game cannot be paused in its current state');
  end if;

  update public.games set
    paused_from_state = active_sub_state,
    active_sub_state = 'paused'
  where id = p_game_id;

  insert into public.game_events (game_id, event_type, event_data, actor_type, actor_id)
  values (p_game_id, 'game_paused', jsonb_build_object('paused_from', v_game.active_sub_state), 'admin', auth.uid());

  return jsonb_build_object('status', 'paused', 'paused_from', v_game.active_sub_state);
end;
$$ language plpgsql security definer;

create or replace function public.resume_game(p_game_id uuid)
returns jsonb as $$
declare
  v_game record;
  v_remaining_ms integer;
begin
  select * into v_game from public.games where id = p_game_id and owner_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
  end if;

  if v_game.active_sub_state != 'paused' then
    return jsonb_build_object('error', 'Game is not paused');
  end if;

  -- If resuming into question_active, extend the deadline by the paused duration
  if v_game.paused_from_state = 'question_active' and v_game.question_ends_at is not null then
    -- The question_ends_at was set before pause; we need to extend it
    -- Calculate how much time was remaining when paused
    -- Since we stored the original end time, re-set it relative to now
    v_remaining_ms := extract(epoch from (v_game.question_ends_at - now())) * 1000;
    if v_remaining_ms > 0 then
      update public.games set
        active_sub_state = paused_from_state,
        paused_from_state = null,
        question_ends_at = now() + (v_remaining_ms || ' milliseconds')::interval
      where id = p_game_id;
    else
      -- Timer already expired during pause, go to results
      update public.games set
        active_sub_state = 'question_results',
        paused_from_state = null
      where id = p_game_id;
    end if;
  else
    update public.games set
      active_sub_state = paused_from_state,
      paused_from_state = null
    where id = p_game_id;
  end if;

  insert into public.game_events (game_id, event_type, event_data, actor_type, actor_id)
  values (p_game_id, 'game_resumed', jsonb_build_object('resumed_to', v_game.paused_from_state), 'admin', auth.uid());

  return jsonb_build_object('status', 'active', 'sub_state', v_game.paused_from_state);
end;
$$ language plpgsql security definer;

-- ============================================================
-- GET LEADERBOARD
-- ============================================================

create or replace function public.get_leaderboard(p_game_id uuid, p_limit integer default 10)
returns jsonb as $$
declare
  v_rankings jsonb;
begin
  select jsonb_agg(row_to_json(r)) into v_rankings
  from (
    select
      display_name,
      total_score,
      correct_answer_count,
      rank() over (
        order by total_score desc,
                 correct_answer_count desc,
                 total_response_time_ms asc,
                 joined_at asc
      ) as rank
    from public.players
    where game_id = p_game_id and status != 'removed'
    order by total_score desc, correct_answer_count desc, total_response_time_ms asc, joined_at asc
    limit p_limit
  ) r;

  return coalesce(v_rankings, '[]'::jsonb);
end;
$$ language plpgsql security definer;

-- ============================================================
-- REMOVE PLAYER
-- ============================================================

create or replace function public.remove_player(p_game_id uuid, p_player_id uuid, p_reason text default 'Removed by host')
returns jsonb as $$
declare
  v_game record;
  v_player record;
begin
  select * into v_game from public.games where id = p_game_id and owner_id = auth.uid();
  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
  end if;

  select * into v_player from public.players where id = p_player_id and game_id = p_game_id;
  if not found then
    return jsonb_build_object('error', 'Player not found');
  end if;

  update public.players set
    status = 'removed',
    removed_at = now(),
    removed_reason = p_reason
  where id = p_player_id;

  insert into public.game_events (game_id, event_type, event_data, actor_type, actor_id)
  values (p_game_id, 'player_removed', jsonb_build_object('player_name', v_player.display_name, 'reason', p_reason), 'admin', auth.uid());

  return jsonb_build_object('removed', true, 'player_name', v_player.display_name);
end;
$$ language plpgsql security definer;
