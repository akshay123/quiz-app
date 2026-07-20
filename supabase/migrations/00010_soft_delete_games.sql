-- Soft-delete games: disabling a game hides it from the default list
-- instead of destroying it. Existing sessions/players/answers/history are
-- untouched; a disabled game just can't have new sessions started against
-- it until it's re-enabled.

alter table public.games add column disabled_at timestamptz;

create index idx_games_disabled on public.games(disabled_at);

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

  if v_game.disabled_at is not null then
    return jsonb_build_object('error', 'This game is disabled. Enable it before starting a new session.');
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
