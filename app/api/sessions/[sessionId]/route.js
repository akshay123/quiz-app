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
      .select("*, games!inner(id, name, owner_id), players(count)")
      .eq("id", sessionId)
      .eq("games.owner_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { games: game, players, ...sessionFields } = session;
    const player_count = players?.[0]?.count ?? 0;

    return NextResponse.json({
      session: { ...sessionFields, game_id: game.id, game_name: game.name },
      player_count
    });
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

    const { sessionId } = await params;
    const { action } = await request.json();

    // Verify ownership
    const { data: session } = await supabase
      .from("game_sessions")
      .select("id, games!inner(owner_id)")
      .eq("id", sessionId)
      .eq("games.owner_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "start") {
      const { data: startData, error: startError } = await supabase.rpc("start_game", { p_session_id: sessionId });
      if (startError) return NextResponse.json({ error: startError.message }, { status: 500 });
      if (startData?.error) return NextResponse.json({ error: startData.error }, { status: 400 });

      const { data: nextData, error: nextError } = await supabase.rpc("next_question", { p_session_id: sessionId });
      if (nextError) return NextResponse.json({ error: nextError.message }, { status: 500 });
      if (nextData?.error) return NextResponse.json({ error: nextData.error }, { status: 400 });

      return NextResponse.json({ started: startData, question: nextData });
    }

    if (action === "next") {
      const { data, error } = await supabase.rpc("next_question", { p_session_id: sessionId });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
      return NextResponse.json({ question: data });
    }

    if (action === "end") {
      const { data: updated, error } = await supabase
        .from("game_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", sessionId)
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
