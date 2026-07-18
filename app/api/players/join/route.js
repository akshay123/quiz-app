import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { room_code, display_name } = body;

    if (!room_code || !display_name) {
      return NextResponse.json({ error: "Missing game code or player name" }, { status: 400 });
    }

    const supabase = await createClient();
    const sessionToken = randomBytes(24).toString("hex");

    const { data, error } = await supabase.rpc("join_game", {
      p_room_code: room_code,
      p_display_name: display_name,
      p_session_token: sessionToken
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({
      session_token: sessionToken,
      player_id: data.player_id,
      session_id: data.session_id,
      game_name: data.game_name,
      game_status: data.game_status
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
