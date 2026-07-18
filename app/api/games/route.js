import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: games, error } = await supabase
      .from("games")
      .select("*, questions!questions_game_id_fkey(count), players(count)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = games.map((g) => ({
      ...g,
      question_count: g.questions?.[0]?.count ?? 0,
      player_count: g.players?.[0]?.count ?? 0,
      questions: undefined,
      players: undefined
    }));

    return NextResponse.json({ games: normalized });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
