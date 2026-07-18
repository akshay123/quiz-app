-- Split `games` into a permanent quiz template and a new `game_sessions`
-- table holding all per-run live state (room code, status, timer, current
-- question). This lets the same quiz be run many times, each run getting
-- its own room code and isolated players/leaderboard, while past runs stay
-- visible under the template they belong to.
--
-- games keeps: id, owner_id, name, created_at, updated_at.
-- game_settings, scoring_bands, questions, question_choices are untouched
-- (template-level, shared by every session).
-- players/answers/game_events move from game_id to session_id.
--
-- Bonus fix: games.room_code was a bare `unique` column, but
-- generate_room_code() only checked uniqueness among active-status rows —
-- a freshly generated code could collide with an old completed game's code
-- and fail the insert. game_sessions.room_code uses a partial unique index
-- scoped to active statuses instead, matching what the generator checks.

begin;

-- ============================================================
-- NEW TABLE: game_sessions
-- ============================================================

create table public.game_sessions (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references public.games(id) on delete cascade,
  room_code text,
  status game_status not null default 'draft',
  active_sub_state game_sub_state,
  paused_from_state game_sub_state,
  current_question_id uuid references public.questions(id) on delete set null,
  current_question_index integer,
  question_started_at timestamptz,
  question_ends_at timestamptz,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

-- ============================================================
-- BACKFILL: give every existing game its one implicit session,
-- carrying over the live/lifecycle state that used to live on games.
-- ============================================================

create temporary table _game_session_migration (
  old_game_id uuid primary key,
  new_session_id uuid not null
) on commit drop;

insert into public.game_sessions (
  game_id, room_code, status, active_sub_state, paused_from_state,
  current_question_id, current_question_index, question_started_at, question_ends_at,
  created_at, published_at, started_at, completed_at
)
select
  id, room_code, status, active_sub_state, paused_from_state,
  current_question_id, current_question_index, question_started_at, question_ends_at,
  created_at, published_at, started_at, completed_at
from public.games;

insert into _game_session_migration (old_game_id, new_session_id)
select g.id, gs.id
from public.games g
join public.game_sessions gs on gs.game_id = g.id;

-- ============================================================
-- players / answers / game_events: game_id -> session_id
-- ============================================================

alter table public.players add column session_id uuid references public.game_sessions(id) on delete cascade;
update public.players p set session_id = m.new_session_id from _game_session_migration m where p.game_id = m.old_game_id;
alter table public.players alter column session_id set not null;

alter table public.answers add column session_id uuid references public.game_sessions(id) on delete cascade;
update public.answers a set session_id = m.new_session_id from _game_session_migration m where a.game_id = m.old_game_id;
alter table public.answers alter column session_id set not null;

alter table public.game_events add column session_id uuid references public.game_sessions(id) on delete cascade;
update public.game_events e set session_id = m.new_session_id from _game_session_migration m where e.game_id = m.old_game_id;
alter table public.game_events alter column session_id set not null;

-- ============================================================
-- DROP POLICIES THAT REFERENCE COLUMNS ABOUT TO MOVE/DISAPPEAR
-- (must happen before the columns themselves are dropped)
-- ============================================================

drop policy if exists "games_read_by_room_code" on public.games;
drop policy if exists "questions_read_active" on public.questions;
drop policy if exists "choices_read_active" on public.question_choices;
drop policy if exists "settings_read_active" on public.game_settings;
drop policy if exists "players_owner_read" on public.players;
drop policy if exists "players_owner_update" on public.players;
drop policy if exists "answers_owner_read" on public.answers;
drop policy if exists "events_owner_read" on public.game_events;

-- ============================================================
-- DROP OLD game_id COLUMNS (auto-drops their indexes)
-- ============================================================

alter table public.players drop column game_id;
alter table public.answers drop column game_id;
alter table public.game_events drop column game_id;

-- ============================================================
-- DROP PER-RUN COLUMNS FROM games (auto-drops fk_games_current_question,
-- idx_games_status, idx_games_room_code_active along with their columns)
-- ============================================================

alter table public.games
  drop column room_code,
  drop column status,
  drop column active_sub_state,
  drop column paused_from_state,
  drop column current_question_id,
  drop column current_question_index,
  drop column question_started_at,
  drop column question_ends_at,
  drop column published_at,
  drop column started_at,
  drop column completed_at;

-- ============================================================
-- NEW INDEXES
-- ============================================================

create index idx_sessions_game on public.game_sessions(game_id);
create index idx_sessions_status on public.game_sessions(status);
create unique index idx_sessions_room_code_active on public.game_sessions(room_code)
  where status in ('published', 'lobby', 'active');

create index idx_players_session_id on public.players(session_id);
create index idx_players_session_status on public.players(session_id, status);
create index idx_players_session_score on public.players(session_id, total_score desc);

create index idx_answers_session_question on public.answers(session_id, question_id);

create index idx_game_events_session on public.game_events(session_id);
create index idx_game_events_created on public.game_events(session_id, created_at desc);

-- ============================================================
-- RLS: enable on game_sessions, recreate repointed policies
-- ============================================================

alter table public.game_sessions enable row level security;

create policy "sessions_owner_all" on public.game_sessions
  for all using (
    exists (select 1 from public.games where games.id = game_sessions.game_id and games.owner_id = auth.uid())
  );

create policy "questions_read_active" on public.questions
  for select using (
    exists (
      select 1 from public.game_sessions gs
      where gs.game_id = questions.game_id and gs.status in ('active', 'completed')
    )
  );

create policy "choices_read_active" on public.question_choices
  for select using (
    exists (
      select 1 from public.questions q
      join public.game_sessions gs on gs.game_id = q.game_id
      where q.id = question_choices.question_id and gs.status in ('active', 'completed')
    )
  );

create policy "settings_read_active" on public.game_settings
  for select using (
    exists (
      select 1 from public.game_sessions gs
      where gs.game_id = game_settings.game_id and gs.status in ('published', 'lobby', 'active', 'completed')
    )
  );

create policy "players_owner_read" on public.players
  for select using (
    exists (
      select 1 from public.game_sessions gs
      join public.games g on g.id = gs.game_id
      where gs.id = players.session_id and g.owner_id = auth.uid()
    )
  );

create policy "players_owner_update" on public.players
  for update using (
    exists (
      select 1 from public.game_sessions gs
      join public.games g on g.id = gs.game_id
      where gs.id = players.session_id and g.owner_id = auth.uid()
    )
  );

create policy "answers_owner_read" on public.answers
  for select using (
    exists (
      select 1 from public.game_sessions gs
      join public.games g on g.id = gs.game_id
      where gs.id = answers.session_id and g.owner_id = auth.uid()
    )
  );

create policy "events_owner_read" on public.game_events
  for select using (
    exists (
      select 1 from public.game_sessions gs
      join public.games g on g.id = gs.game_id
      where gs.id = game_events.session_id and g.owner_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS: retarget every lifecycle RPC from games to game_sessions
-- ============================================================

drop function if exists public.publish_game(uuid);

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
    if not exists (
      select 1 from public.game_sessions
      where room_code = code
      and status in ('published', 'lobby', 'active')
    ) then
      return code;
    end if;
  end loop;
end;
$$ language plpgsql volatile;

-- Creates a new session for a game template: room code assigned immediately,
-- no separate "draft session" state since a session only exists to be played.
create or replace function public.start_session(p_game_id uuid)
returns jsonb as $$
declare
  v_game record;
  v_code text;
  v_question_count integer;
  v_session_id uuid;
begin
  select * into v_game from public.games where id = p_game_id and owner_id = auth.uid();
  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
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

create or replace function public.join_game(
  p_room_code text,
  p_display_name text,
  p_session_token text
)
returns jsonb as $$
declare
  v_session record;
  v_settings record;
  v_player_count integer;
  v_token_hash text;
  v_player_id uuid;
  v_normalized_code text;
  v_normalized_name text;
  v_game_name text;
begin
  v_normalized_code := upper(trim(p_room_code));
  v_normalized_name := trim(p_display_name);

  if char_length(v_normalized_name) < 2 or char_length(v_normalized_name) > 20 then
    return jsonb_build_object('error', 'Display name must be between 2 and 20 characters.');
  end if;

  select * into v_session
  from public.game_sessions
  where room_code = v_normalized_code
    and status in ('published', 'lobby', 'active')
  for update;

  if not found then
    return jsonb_build_object('error', 'No game found with this code. Check the code and try again.');
  end if;

  select * into v_settings from public.game_settings where game_id = v_session.game_id;

  if v_session.status = 'active' then
    if not v_settings.allow_late_join then
      return jsonb_build_object('error', 'This game has already started and is not accepting new players.');
    end if;
  end if;

  if not v_settings.allow_duplicate_display_names then
    if exists (
      select 1 from public.players
      where session_id = v_session.id
        and lower(display_name) = lower(v_normalized_name)
        and status != 'removed'
    ) then
      return jsonb_build_object('error', 'Someone already has that name. Try a different one.');
    end if;
  end if;

  select count(*) into v_player_count
  from public.players
  where session_id = v_session.id and status in ('active', 'disconnected');

  if v_player_count >= v_settings.max_players then
    return jsonb_build_object('error', format('This game is full (%s/%s players).', v_player_count, v_settings.max_players));
  end if;

  v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  insert into public.players (session_id, display_name, session_token_hash, status)
  values (v_session.id, v_normalized_name, v_token_hash, 'active')
  returning id into v_player_id;

  if v_session.status = 'published' then
    update public.game_sessions set status = 'lobby' where id = v_session.id;
  end if;

  select name into v_game_name from public.games where id = v_session.game_id;

  insert into public.game_events (session_id, event_type, event_data, actor_type, actor_id)
  values (v_session.id, 'player_joined', jsonb_build_object('player_name', v_normalized_name), 'player', v_player_id);

  return jsonb_build_object(
    'player_id', v_player_id,
    'session_id', v_session.id,
    'game_name', v_game_name,
    'game_status', v_session.status,
    'player_count', v_player_count + 1
  );
end;
$$ language plpgsql security definer;

create or replace function public.reconnect_player(p_session_token text)
returns jsonb as $$
declare
  v_token_hash text;
  v_player record;
begin
  v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  select p.*, g.name as game_name, gs.status as game_status,
         gs.active_sub_state, gs.current_question_id, gs.current_question_index,
         gs.question_started_at, gs.question_ends_at
  into v_player
  from public.players p
  join public.game_sessions gs on gs.id = p.session_id
  join public.games g on g.id = gs.game_id
  where p.session_token_hash = v_token_hash
    and p.status != 'removed'
    and gs.status in ('lobby', 'active')
  order by p.joined_at desc
  limit 1;

  if not found then
    return jsonb_build_object('error', 'session_expired');
  end if;

  update public.players
  set status = 'active', last_seen_at = now()
  where id = v_player.id;

  return jsonb_build_object(
    'player_id', v_player.id,
    'session_id', v_player.session_id,
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

create or replace function public.submit_answer(
  p_session_token text,
  p_question_id uuid,
  p_choice_id uuid
)
returns jsonb as $$
declare
  v_token_hash text;
  v_player record;
  v_session record;
  v_settings record;
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

  select * into v_player
  from public.players
  where session_token_hash = v_token_hash and status = 'active';

  if not found then
    return jsonb_build_object('error', 'Invalid session.', 'accepted', false);
  end if;

  select * into v_session
  from public.game_sessions
  where id = v_player.session_id
    and status = 'active'
    and active_sub_state = 'question_active'
    and current_question_id = p_question_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Question is not active.', 'accepted', false);
  end if;

  select * into v_settings from public.game_settings where game_id = v_session.game_id;

  select * into v_existing_answer
  from public.answers
  where player_id = v_player.id and question_id = p_question_id;

  if found then
    if v_settings.allow_answer_changes then
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

  if v_now > v_session.question_ends_at then
    return jsonb_build_object('error', 'Time is up! Your answer was not submitted in time.', 'accepted', false);
  end if;

  v_elapsed_ms := extract(epoch from (v_now - v_session.question_started_at)) * 1000;

  select * into v_choice from public.question_choices where id = p_choice_id and question_id = p_question_id;
  if not found then
    return jsonb_build_object('error', 'Invalid choice.', 'accepted', false);
  end if;

  v_is_correct := v_choice.is_correct;

  if v_is_correct then
    select * into v_band
    from public.scoring_bands
    where game_id = v_session.game_id
      and (question_id = p_question_id or question_id is null)
      and start_ms <= v_elapsed_ms
      and (
        (is_final_band and end_ms >= v_elapsed_ms) or
        (not is_final_band and end_ms > v_elapsed_ms)
      )
    order by question_id nulls last
    limit 1;

    if found then
      v_points := v_band.points;
    end if;
  end if;

  insert into public.answers (session_id, question_id, player_id, selected_choice_id, is_correct, response_time_ms, points_awarded, submitted_at)
  values (v_session.id, p_question_id, v_player.id, p_choice_id, v_is_correct, v_elapsed_ms, v_points, v_now);

  update public.players set
    total_score = total_score + v_points,
    correct_answer_count = correct_answer_count + (case when v_is_correct then 1 else 0 end),
    total_response_time_ms = total_response_time_ms + (case when v_is_correct then v_elapsed_ms else 0 end),
    last_seen_at = v_now
  where id = v_player.id;

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

create or replace function public.start_game(p_session_id uuid)
returns jsonb as $$
declare
  v_session record;
  v_settings record;
  v_player_count integer;
begin
  select gs.* into v_session
  from public.game_sessions gs
  join public.games g on g.id = gs.game_id
  where gs.id = p_session_id and g.owner_id = auth.uid()
  for update of gs;

  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
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

-- Every question runs a fixed 30-second timer (see migration 00004): nothing
-- can override this per-question or per-game.
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
  select gs.* into v_session
  from public.game_sessions gs
  join public.games g on g.id = gs.game_id
  where gs.id = p_session_id and g.owner_id = auth.uid()
  for update of gs;

  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
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
  select gs.* into v_session
  from public.game_sessions gs
  join public.games g on g.id = gs.game_id
  where gs.id = p_session_id and g.owner_id = auth.uid()
  for update of gs;

  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
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
  select gs.* into v_session
  from public.game_sessions gs
  join public.games g on g.id = gs.game_id
  where gs.id = p_session_id and g.owner_id = auth.uid()
  for update of gs;

  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
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
  select gs.* into v_session
  from public.game_sessions gs
  join public.games g on g.id = gs.game_id
  where gs.id = p_session_id and g.owner_id = auth.uid()
  for update of gs;

  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
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

create or replace function public.get_leaderboard(p_session_id uuid, p_limit integer default 10)
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
    where session_id = p_session_id and status != 'removed'
    order by total_score desc, correct_answer_count desc, total_response_time_ms asc, joined_at asc
    limit p_limit
  ) r;

  return coalesce(v_rankings, '[]'::jsonb);
end;
$$ language plpgsql security definer;

create or replace function public.remove_player(p_session_id uuid, p_player_id uuid, p_reason text default 'Removed by host')
returns jsonb as $$
declare
  v_player record;
begin
  if not exists (
    select 1 from public.game_sessions gs
    join public.games g on g.id = gs.game_id
    where gs.id = p_session_id and g.owner_id = auth.uid()
  ) then
    return jsonb_build_object('error', 'Game not found or access denied');
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

commit;
