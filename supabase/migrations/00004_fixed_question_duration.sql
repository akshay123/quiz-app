-- Fix: every question must run a fixed 30-second timer.
--
-- next_question() previously took the duration from the question's own
-- duration_seconds (settable via Excel "Time Limit" import) or fell back to
-- game_settings.default_question_duration_seconds. Scoring bands are a fixed
-- 0-10-20-30s structure (see create_default_scoring_bands), so any question
-- that ran for a different duration (e.g. imported Kahoot exports commonly
-- carry "Time limit (sec)" = 20) produced a timer that didn't match the 30s
-- players expect, and left part of the scoring curve unreachable or unscored.
-- The duration is now hardcoded so nothing can deviate from 30s.

create or replace function public.next_question(p_game_id uuid)
returns jsonb as $$
declare
  v_game record;
  v_next_question record;
  v_next_index integer;
  v_total_questions integer;
  v_duration constant integer := 30;
  v_start timestamptz;
  v_end timestamptz;
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
$$ language plpgsql security definer;
