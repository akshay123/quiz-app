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

    const { gameId } = await params;

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*, question_choices(*)")
      .eq("game_id", gameId)
      .order("question_order");

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from("game_sessions")
      .select("*, players(count)")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false });

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    // Normalize choice ordering
    const normalizedQuestions = questions.map((q) => ({
      ...q,
      question_choices: [...q.question_choices].sort((a, b) => a.display_order - b.display_order)
    }));

    const normalizedSessions = sessions.map((s) => ({
      ...s,
      player_count: s.players?.[0]?.count ?? 0,
      players: undefined
    }));

    return NextResponse.json({ game, questions: normalizedQuestions, sessions: normalizedSessions });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameId } = await params;
    const body = await request.json();

    let update;
    if (typeof body.name === "string") {
      const trimmedName = body.name.trim();
      if (trimmedName.length < 1 || trimmedName.length > 150) {
        return NextResponse.json({ error: "Game name must be between 1 and 150 characters" }, { status: 400 });
      }
      update = { name: trimmedName };
    } else if (body.action === "disable" || body.action === "enable") {
      update = { disabled_at: body.action === "disable" ? new Date().toISOString() : null };
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const { data: game, error } = await supabase.from("games").update(update).eq("id", gameId).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ game });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
