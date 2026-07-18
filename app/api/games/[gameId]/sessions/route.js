import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await params;

    const { data, error } = await supabase.rpc("start_session", { p_game_id: gameId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({ session_id: data.session_id, room_code: data.room_code, status: data.status });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
