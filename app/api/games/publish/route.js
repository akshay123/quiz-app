import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateRoomCode } from "@/lib/room-code";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await request.json();

    if (!gameId) {
      return NextResponse.json({ error: "Game ID required" }, { status: 400 });
    }

    // Verify ownership
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("id", gameId)
      .eq("admin_id", user.id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found or unauthorized" }, { status: 404 });
    }

    // Generate unique room code
    let roomCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      roomCode = generateRoomCode();
      const { data: existing } = await supabase
        .from("games")
        .select("id")
        .eq("room_code", roomCode)
        .single();
      isUnique = !existing;
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json({ error: "Failed to generate unique room code" }, { status: 500 });
    }

    // Update game with room code and publish it
    const { data: updated, error: updateError } = await supabase
      .from("games")
      .update({ room_code: roomCode, status: "published" })
      .eq("id", gameId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ game: updated, room_code: roomCode });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
