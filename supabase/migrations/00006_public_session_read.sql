-- Fix: players couldn't see the current question after the host started a
-- session. questions_read_active/choices_read_active/settings_read_active
-- all check "does an active/completed game_session exist for this game" via
-- a subquery on game_sessions — but that subquery is itself subject to
-- game_sessions' own RLS, and the only policy there (sessions_owner_all)
-- requires auth.uid() to match the owner. An anonymous player has no
-- auth.uid(), so the subquery always saw zero rows and the outer policy
-- always failed, even for a genuinely active session.
--
-- The original schema avoided this because games had a public
-- "games_read_by_room_code" policy (readable by anyone once
-- published/lobby/active/completed) that the session-split migration
-- dropped without adding an equivalent on game_sessions. Add it back here.

create policy "sessions_read_active" on public.game_sessions
  for select using (
    status in ('published', 'lobby', 'active', 'completed')
  );
