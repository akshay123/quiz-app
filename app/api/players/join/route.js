import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { game_code, player_name } = body;

    if (!game_code || !player_name) {
      return NextResponse.json({ error: "Missing game code or player name" }, { status: 400 });
    }

    const supabase = await createClient();

    // Find game by room code
    const { data: games, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("room_code", game_code.toUpperCase().trim())
      .single();

    if (gameError || !games) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Check if game is joinable
    if (games.status !== "active" && games.status !== "published") {
      return NextResponse.json({ error: "Game is not accepting new players" }, { status: 400 });
    }

    // Check max players
    const { count: playerCount } = await supabase
      .from("players")
      .select("*", { count: "exact" })
      .eq("game_id", games.id)
      .eq("is_active", true);

    if (playerCount >= games.max_players) {
      return NextResponse.json({ error: "Game is full" }, { status: 400 });
    }

    // Create player session
    const sessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        game_id: games.id,
        display_name: player_name.trim().substring(0, 50),
        session_token: sessionToken,
        is_active: true
      })
      .select()
      .single();

    if (playerError) {
      return NextResponse.json({ error: playerError.message }, { status: 500 });
    }

    return NextResponse.json({
      game_id: games.id,
      player_id: player.id,
      session_token: sessionToken,
      game: games
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
