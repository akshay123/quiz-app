import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("current_question_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, display_name")
      .eq("session_id", sessionId)
      .neq("status", "removed")
      .order("joined_at");

    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }

    let answeredIds = new Set();
    if (session.current_question_id) {
      const { data: answers, error: answersError } = await supabase
        .from("answers")
        .select("player_id")
        .eq("session_id", sessionId)
        .eq("question_id", session.current_question_id);

      if (answersError) {
        return NextResponse.json({ error: answersError.message }, { status: 500 });
      }
      answeredIds = new Set(answers.map((a) => a.player_id));
    }

    const progress = players.map((p) => ({ ...p, answered: answeredIds.has(p.id) }));

    return NextResponse.json({
      players: progress,
      answered_count: answeredIds.size,
      total_count: players.length
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
