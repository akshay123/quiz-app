-- Multiplayer Quiz Application - Default Scoring Band Template
-- Used when creating a new game without custom scoring configuration

-- Helper function to create default scoring bands for a new game
create or replace function public.create_default_scoring_bands(p_game_id uuid)
returns void as $$
begin
  insert into public.scoring_bands (game_id, question_id, start_ms, end_ms, is_final_band, points, display_order)
  values
    (p_game_id, null, 0, 10000, false, 3, 1),
    (p_game_id, null, 10000, 20000, false, 2, 2),
    (p_game_id, null, 20000, 30000, true, 1, 3);
end;
$$ language plpgsql;

-- Auto-create settings and scoring bands when a game is created
create or replace function public.handle_new_game()
returns trigger as $$
begin
  insert into public.game_settings (game_id) values (new.id);
  perform public.create_default_scoring_bands(new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_game_created
  after insert on public.games
  for each row execute function public.handle_new_game();
