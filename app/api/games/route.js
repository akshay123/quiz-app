import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const includeDisabled = new URL(request.url).searchParams.get("include_disabled") === "true";

    const { data: games, error } = await supabase
      .from("games")
      .select("*, questions(count), game_sessions(count)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = games.map((g) => ({
      ...g,
      question_count: g.questions?.[0]?.count ?? 0,
      session_count: g.game_sessions?.[0]?.count ?? 0,
      questions: undefined,
      game_sessions: undefined
    }));

    const disabledCount = normalized.filter((g) => g.disabled_at).length;
    const visible = includeDisabled ? normalized : normalized.filter((g) => !g.disabled_at);

    return NextResponse.json({ games: visible, disabled_count: disabledCount });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
