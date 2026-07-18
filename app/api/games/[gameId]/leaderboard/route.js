import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const gameId = params.gameId;

    // Get all players in game with scores, ordered by score descending
    const { data: players, error } = await supabase
      .from("players")
      .select("id, display_name, score, is_active, created_at")
      .eq("game_id", gameId)
      .eq("is_active", true)
      .order("score", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add ranks
    const leaderboard = players.map((player, index) => ({
      ...player,
      rank: index + 1
    }));

    return NextResponse.json({ leaderboard });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
