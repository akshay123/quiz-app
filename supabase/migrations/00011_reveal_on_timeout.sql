-- A player who lets the clock run out without answering currently gets no
-- feedback at all — the tick/cross reveal only ever populated from
-- submit_answer's response, which never runs if they never tapped a choice.
-- Once a question's deadline has passed, it's safe to reveal the correct
-- choice to every player polling status, answered or not (nobody can still
-- be influenced by seeing it — the window to answer is already closed).

create or replace function public.reconnect_player(p_session_token text)
returns jsonb as $$
declare
  v_token_hash text;
  v_player record;
  v_revealed_correct_choice_id uuid;
begin
  v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  select p.*, g.name as game_name, gs.status as game_status,
         gs.active_sub_state, gs.current_question_id, gs.current_question_index,
         gs.question_started_at, gs.question_ends_at, gs.game_id as session_game_id
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

  if v_player.current_question_id is not null
     and v_player.question_ends_at is not null
     and now() > v_player.question_ends_at then
    select qc.id into v_revealed_correct_choice_id
    from public.question_choices qc
    join public.game_settings gset on gset.game_id = v_player.session_game_id
    where qc.question_id = v_player.current_question_id
      and qc.is_correct
      and gset.show_correct_answer
    limit 1;
  end if;

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
    'total_score', v_player.total_score,
    'revealed_correct_choice_id', v_revealed_correct_choice_id
  );
end;
$$ language plpgsql security definer;
