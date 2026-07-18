import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SAMPLE_GAME, DEFAULT_GAME_SETTINGS } from "@/lib/seed-data";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sample } = body;

    if (!sample) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Create game
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .insert({
        admin_id: user.id,
        title: SAMPLE_GAME.title,
        description: SAMPLE_GAME.description,
        category: SAMPLE_GAME.category,
        status: "draft",
        question_count: SAMPLE_GAME.questions.length,
        max_players: DEFAULT_GAME_SETTINGS.max_players,
        question_duration_seconds: DEFAULT_GAME_SETTINGS.question_duration_seconds,
        preparation_countdown_seconds: DEFAULT_GAME_SETTINGS.preparation_countdown_seconds,
        leaderboard_display_seconds: DEFAULT_GAME_SETTINGS.leaderboard_display_seconds,
        allow_answer_changes: DEFAULT_GAME_SETTINGS.allow_answer_changes,
        scoring_rules: DEFAULT_GAME_SETTINGS.scoring_rules
      })
      .select()
      .single();

    if (gameError) {
      return NextResponse.json({ error: gameError.message }, { status: 500 });
    }

    // Create questions
    const questionsToInsert = SAMPLE_GAME.questions.map((q) => ({
      game_id: gameData.id,
      question_number: q.number,
      text: q.text,
      category: q.category,
      option_a: q.options[0],
      option_b: q.options[1],
      option_c: q.options[2],
      option_d: q.options[3],
      correct_option: String.fromCharCode(65 + q.correct_option) // A, B, C, or D
    }));

    const { error: questionsError } = await supabase
      .from("questions")
      .insert(questionsToInsert);

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    return NextResponse.json({ game_id: gameData.id, success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
