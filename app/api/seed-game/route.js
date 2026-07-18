import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SAMPLE_GAME } from "@/lib/seed-data";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body.sample) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Create the game (game_settings + scoring_bands are auto-created by DB trigger)
    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({ owner_id: user.id, name: SAMPLE_GAME.name })
      .select()
      .single();

    if (gameError) {
      return NextResponse.json({ error: gameError.message }, { status: 500 });
    }

    // Create questions + their choices
    for (const q of SAMPLE_GAME.questions) {
      const { data: question, error: questionError } = await supabase
        .from("questions")
        .insert({
          game_id: game.id,
          question_order: q.question_order,
          question_text: q.question_text,
          category: q.category
        })
        .select()
        .single();

      if (questionError) {
        return NextResponse.json({ error: questionError.message }, { status: 500 });
      }

      const choicesToInsert = q.choices.map((c, idx) => ({
        question_id: question.id,
        choice_key: c.choice_key,
        choice_text: c.choice_text,
        is_correct: c.is_correct,
        display_order: idx + 1
      }));

      const { error: choicesError } = await supabase.from("question_choices").insert(choicesToInsert);

      if (choicesError) {
        return NextResponse.json({ error: choicesError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ game_id: game.id, success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
