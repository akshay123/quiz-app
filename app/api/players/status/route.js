import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { game_id, session_token } = body;

    if (!game_id || !session_token) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify player session
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", game_id)
      .eq("session_token", session_token)
      .is_active(true)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Fetch game
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", game_id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Fetch current question if game is active
    let currentQuestion = null;
    if (game.status === "active" && game.current_question_number) {
      const { data: question } = await supabase
        .from("questions")
        .select("*")
        .eq("game_id", game_id)
        .eq("question_number", game.current_question_number)
        .single();
      currentQuestion = question;
    }

    return NextResponse.json({
      player,
      game,
      currentQuestion
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
