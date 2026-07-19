-- Players should see whether their answer was right or wrong immediately
-- after submitting, not just at the end of the question. submit_answer
-- previously only revealed is_correct (and no correct_choice_id at all)
-- when show_points_immediately was on -- but that setting is about scores,
-- not correctness, and defaults to false. Decouple the two: is_correct and
-- correct_choice_id are now gated by show_correct_answer (defaults true),
-- and points_awarded stays gated by show_points_immediately.

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
  v_correct_choice_id uuid;
  v_band record;
  v_now timestamptz;
  v_result jsonb;
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

  v_result := jsonb_build_object(
    'accepted', true,
    'already_answered', false,
    'response_time_ms', v_elapsed_ms,
    'submitted_at', v_now
  );

  if v_settings.show_correct_answer then
    select id into v_correct_choice_id from public.question_choices where question_id = p_question_id and is_correct limit 1;
    v_result := v_result || jsonb_build_object(
      'is_correct', v_is_correct,
      'correct_choice_id', v_correct_choice_id
    );
  end if;

  if v_settings.show_points_immediately then
    v_result := v_result || jsonb_build_object('points_awarded', v_points);
  end if;

  return v_result;
end;
$$ language plpgsql security definer;
