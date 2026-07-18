import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await request.json();
    if (!gameId) {
      return NextResponse.json({ error: "Game ID required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("publish_game", { p_game_id: gameId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError) {
      return NextResponse.json({ error: gameError.message }, { status: 500 });
    }

    return NextResponse.json({ game, room_code: data.room_code });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
