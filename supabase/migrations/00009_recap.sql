-- Post-game recap: once a session completes, a player can pull a single
-- list of every question with the correct answer and their own answer.

create or replace function public.get_recap(p_session_token text)
returns jsonb as $$
declare
  v_token_hash text;
  v_player record;
  v_session record;
  v_recap jsonb;
begin
  v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  select * into v_player from public.players where session_token_hash = v_token_hash and status != 'removed';
  if not found then
    return jsonb_build_object('error', 'Invalid session.');
  end if;

  select * into v_session from public.game_sessions where id = v_player.session_id;
  if not found or v_session.status != 'completed' then
    return jsonb_build_object('error', 'Recap is only available after the game completes.');
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'question_order', q.question_order,
      'question_text', q.question_text,
      'explanation', q.explanation,
      'correct_choice', (
        select jsonb_build_object('key', qc.choice_key, 'text', qc.choice_text)
        from public.question_choices qc
        where qc.question_id = q.id and qc.is_correct
        limit 1
      ),
      'your_choice', (
        select jsonb_build_object('key', qc2.choice_key, 'text', qc2.choice_text)
        from public.answers a
        join public.question_choices qc2 on qc2.id = a.selected_choice_id
        where a.question_id = q.id and a.player_id = v_player.id
        limit 1
      ),
      'was_correct', exists (
        select 1 from public.answers a2 where a2.question_id = q.id and a2.player_id = v_player.id and a2.is_correct
      ),
      'answered', exists (
        select 1 from public.answers a3 where a3.question_id = q.id and a3.player_id = v_player.id
      )
    ) order by q.question_order
  ) into v_recap
  from public.questions q
  where q.game_id = v_session.game_id;

  return jsonb_build_object('questions', coalesce(v_recap, '[]'::jsonb));
end;
$$ language plpgsql security definer;
