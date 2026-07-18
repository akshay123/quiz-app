-- Multiplayer Quiz Application - Database Schema
-- Supabase Migration: 00001_create_schema
-- Run via: supabase db push (or applied automatically on supabase start)

-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- CUSTOM TYPES
-- ============================================================

create type game_status as enum (
  'draft',
  'published',
  'lobby',
  'active',
  'completed',
  'cancelled'
);

create type game_sub_state as enum (
  'countdown',
  'question_active',
  'question_results',
  'leaderboard',
  'paused'
);

create type player_status as enum (
  'active',
  'disconnected',
  'removed'
);

create type event_actor_type as enum (
  'admin',
  'system',
  'player'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Administrators (extends Supabase auth.users via Google OAuth)
create table public.administrators (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Games
create table public.games (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.administrators(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 150),
  room_code text unique,
  status game_status not null default 'draft',
  active_sub_state game_sub_state,
  paused_from_state game_sub_state,
  current_question_id uuid,
  current_question_index integer,
  question_started_at timestamptz,
  question_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

-- Game Settings (1:1 with games)
create table public.game_settings (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null unique references public.games(id) on delete cascade,
  max_players integer not null default 100 check (max_players between 2 and 100),
  default_question_duration_seconds integer not null default 30 check (default_question_duration_seconds between 5 and 300),
  preparation_countdown_seconds integer not null default 3 check (preparation_countdown_seconds between 0 and 30),
  leaderboard_duration_seconds integer not null default 5 check (leaderboard_duration_seconds between 0 and 60),
  allow_late_join boolean not null default false,
  randomize_questions boolean not null default false,
  randomize_answers boolean not null default false,
  show_correct_answer boolean not null default true,
  show_leaderboard_after_question boolean not null default true,
  auto_close_when_all_answered boolean not null default false,
  allow_host_early_close boolean not null default true,
  allow_duplicate_display_names boolean not null default false,
  show_points_immediately boolean not null default false,
  allow_answer_changes boolean not null default false,
  auto_advance_questions boolean not null default false,
  auto_advance_delay_seconds integer not null default 5 check (auto_advance_delay_seconds between 3 and 30)
);

-- Questions
create table public.questions (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references public.games(id) on delete cascade,
  question_order integer not null,
  question_text text not null check (char_length(question_text) between 1 and 2000),
  explanation text,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 5 and 300),
  category text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, question_order)
);

-- Add foreign key from games.current_question_id now that questions table exists
alter table public.games
  add constraint fk_games_current_question
  foreign key (current_question_id) references public.questions(id) on delete set null;

-- Question Choices
create table public.question_choices (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references public.questions(id) on delete cascade,
  choice_key char(1) not null check (choice_key in ('A','B','C','D','E','F')),
  choice_text text not null check (char_length(choice_text) between 1 and 500),
  is_correct boolean not null default false,
  display_order integer not null,
  unique (question_id, choice_key)
);

-- Scoring Bands
create table public.scoring_bands (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references public.games(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms > 0),
  is_final_band boolean not null default false,
  points integer not null check (points >= 0),
  display_order integer not null,
  check (end_ms > start_ms)
);

-- Players
create table public.players (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references public.games(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 20),
  session_token_hash text not null,
  status player_status not null default 'active',
  total_score integer not null default 0,
  correct_answer_count integer not null default 0,
  total_response_time_ms bigint not null default 0,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_reason text
);

-- Answers
create table public.answers (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references public.games(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  selected_choice_id uuid not null references public.question_choices(id),
  is_correct boolean not null,
  response_time_ms integer not null check (response_time_ms >= 0),
  points_awarded integer not null default 0 check (points_awarded >= 0),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (player_id, question_id)
);

-- Game Events (audit log)
create table public.game_events (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references public.games(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}',
  actor_type event_actor_type not null default 'system',
  actor_id uuid,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_games_owner on public.games(owner_id);
create index idx_games_status on public.games(status);
create unique index idx_games_room_code_active on public.games(room_code)
  where status in ('published', 'lobby', 'active');

create index idx_players_game_id on public.players(game_id);
create index idx_players_game_status on public.players(game_id, status);
create index idx_players_session_hash on public.players(session_token_hash);
create index idx_players_game_score on public.players(game_id, total_score desc);

create index idx_answers_game_question on public.answers(game_id, question_id);
create index idx_answers_player_question on public.answers(player_id, question_id);

create index idx_questions_game_order on public.questions(game_id, question_order);

create index idx_scoring_bands_game on public.scoring_bands(game_id);
create index idx_scoring_bands_question on public.scoring_bands(game_id, question_id);

create index idx_game_events_game on public.game_events(game_id);
create index idx_game_events_created on public.game_events(game_id, created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.administrators
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.games
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.questions
  for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE ADMINISTRATOR ON GOOGLE SIGN-IN
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.administrators (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.administrators enable row level security;
alter table public.games enable row level security;
alter table public.game_settings enable row level security;
alter table public.questions enable row level security;
alter table public.question_choices enable row level security;
alter table public.scoring_bands enable row level security;
alter table public.players enable row level security;
alter table public.answers enable row level security;
alter table public.game_events enable row level security;

-- Administrators: can only read/update their own record
create policy "admins_read_own" on public.administrators
  for select using (auth.uid() = id);

create policy "admins_update_own" on public.administrators
  for update using (auth.uid() = id);

-- Games: owners have full access
create policy "games_owner_all" on public.games
  for all using (auth.uid() = owner_id);

-- Games: players can read games they are part of (via service role in functions)
create policy "games_read_by_room_code" on public.games
  for select using (
    status in ('published', 'lobby', 'active', 'completed')
  );

-- Game Settings: owners can manage, players can read active games
create policy "settings_owner_all" on public.game_settings
  for all using (
    exists (select 1 from public.games where games.id = game_settings.game_id and games.owner_id = auth.uid())
  );

create policy "settings_read_active" on public.game_settings
  for select using (
    exists (select 1 from public.games where games.id = game_settings.game_id and games.status in ('published', 'lobby', 'active', 'completed'))
  );

-- Questions: owners can manage
create policy "questions_owner_all" on public.questions
  for all using (
    exists (select 1 from public.games where games.id = questions.game_id and games.owner_id = auth.uid())
  );

-- Questions: readable during active game (text only, not correct answer)
create policy "questions_read_active" on public.questions
  for select using (
    exists (select 1 from public.games where games.id = questions.game_id and games.status in ('active', 'completed'))
  );

-- Choices: owners can manage
create policy "choices_owner_all" on public.question_choices
  for all using (
    exists (
      select 1 from public.questions q
      join public.games g on g.id = q.game_id
      where q.id = question_choices.question_id and g.owner_id = auth.uid()
    )
  );

-- Choices: players can read choice_text during active game (is_correct filtered in API)
create policy "choices_read_active" on public.question_choices
  for select using (
    exists (
      select 1 from public.questions q
      join public.games g on g.id = q.game_id
      where q.id = question_choices.question_id and g.status in ('active', 'completed')
    )
  );

-- Scoring bands: owners can manage
create policy "bands_owner_all" on public.scoring_bands
  for all using (
    exists (select 1 from public.games where games.id = scoring_bands.game_id and games.owner_id = auth.uid())
  );

-- Players: managed via service role functions (join, reconnect)
-- Admins can read players in their games
create policy "players_owner_read" on public.players
  for select using (
    exists (select 1 from public.games where games.id = players.game_id and games.owner_id = auth.uid())
  );

create policy "players_owner_update" on public.players
  for update using (
    exists (select 1 from public.games where games.id = players.game_id and games.owner_id = auth.uid())
  );

-- Answers: managed via service role functions
create policy "answers_owner_read" on public.answers
  for select using (
    exists (select 1 from public.games where games.id = answers.game_id and games.owner_id = auth.uid())
  );

-- Game events: owners can read
create policy "events_owner_read" on public.game_events
  for select using (
    exists (select 1 from public.games where games.id = game_events.game_id and games.owner_id = auth.uid())
  );

create policy "events_insert_system" on public.game_events
  for insert with check (true);
