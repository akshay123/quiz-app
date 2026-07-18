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
      .eq("owner_id", user.id)
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

    const { count: playerCount } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId)
      .neq("status", "removed");

    // Normalize choice ordering
    const normalizedQuestions = questions.map((q) => ({
      ...q,
      question_choices: [...q.question_choices].sort((a, b) => a.display_order - b.display_order)
    }));

    return NextResponse.json({ game, questions: normalizedQuestions, player_count: playerCount ?? 0 });
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
    const { action } = await request.json();

    // Verify ownership
    const { data: game } = await supabase.from("games").select("id").eq("id", gameId).eq("owner_id", user.id).single();

    if (!game) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "start") {
      const { data: startData, error: startError } = await supabase.rpc("start_game", { p_game_id: gameId });
      if (startError) return NextResponse.json({ error: startError.message }, { status: 500 });
      if (startData?.error) return NextResponse.json({ error: startData.error }, { status: 400 });

      const { data: nextData, error: nextError } = await supabase.rpc("next_question", { p_game_id: gameId });
      if (nextError) return NextResponse.json({ error: nextError.message }, { status: 500 });
      if (nextData?.error) return NextResponse.json({ error: nextData.error }, { status: 400 });

      return NextResponse.json({ started: startData, question: nextData });
    }

    if (action === "next") {
      const { data, error } = await supabase.rpc("next_question", { p_game_id: gameId });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
      return NextResponse.json({ question: data });
    }

    if (action === "end") {
      const { data: updated, error } = await supabase
        .from("games")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", gameId)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
