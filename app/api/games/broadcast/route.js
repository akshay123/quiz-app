import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId, event, payload } = await request.json();

    if (!gameId || !event) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Verify admin ownership
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("id", gameId)
      .eq("admin_id", user.id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found or unauthorized" }, { status: 401 });
    }

    // Broadcast event to game channel
    // This is a placeholder - in production, use Supabase Realtime directly
    // For now, we'll rely on client-side polling which is already implemented

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
