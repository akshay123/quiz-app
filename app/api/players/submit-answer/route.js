import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { game_id, player_id, session_token, question_id, answer } = body;

    if (!game_id || !player_id || !session_token || !question_id || !answer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify player session
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("id", player_id)
      .eq("game_id", game_id)
      .eq("session_token", session_token)
      .eq("is_active", true)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Invalid player session" }, { status: 401 });
    }

    // Get game and question
    const { data: game } = await supabase
      .from("games")
      .select("*")
      .eq("id", game_id)
      .single();

    const { data: question } = await supabase
      .from("questions")
      .select("*")
      .eq("id", question_id)
      .single();

    if (!game || !question) {
      return NextResponse.json({ error: "Game or question not found" }, { status: 404 });
    }

    // Check if answer is correct
    const is_correct = answer === question.correct_option;

    // Calculate points based on timing
    let points = 0;
    if (is_correct && question.question_started_at) {
      const now = new Date();
      const started = new Date(question.question_started_at);
      const secondsElapsed = (now - started) / 1000;

      if (secondsElapsed < 10) {
        points = game.scoring_rules?.correct_0_10s || 3;
      } else if (secondsElapsed < 20) {
        points = game.scoring_rules?.correct_10_20s || 2;
      } else if (secondsElapsed < 30) {
        points = game.scoring_rules?.correct_20_30s || 1;
      } else {
        points = 0; // Late answer
      }
    }

    // Store answer
    const { data: answerRecord, error: answerError } = await supabase
      .from("answers")
      .insert({
        game_id,
        player_id,
        question_id,
        answer,
        is_correct,
        points,
        answered_at: new Date().toISOString()
      })
      .select()
      .single();

    if (answerError) {
      return NextResponse.json({ error: answerError.message }, { status: 500 });
    }

    // Update player score
    const { data: updatedPlayer, error: updateError } = await supabase
      .from("players")
      .update({ score: (player.score || 0) + points })
      .eq("id", player_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      answer: answerRecord,
      player: updatedPlayer,
      is_correct,
      points
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
