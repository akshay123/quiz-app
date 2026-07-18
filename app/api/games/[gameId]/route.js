import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gameId = params.gameId;

    // Fetch game
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .eq("admin_id", user.id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Fetch questions
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("game_id", gameId)
      .order("question_number");

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    return NextResponse.json({ game, questions });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gameId = params.gameId;
    const body = await request.json();
    const { status, current_question_number } = body;

    // Verify ownership
    const { data: game } = await supabase
      .from("games")
      .select("id")
      .eq("id", gameId)
      .eq("admin_id", user.id)
      .single();

    if (!game) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (current_question_number !== undefined) updateData.current_question_number = current_question_number;

    const { data: updated, error } = await supabase
      .from("games")
      .update(updateData)
      .eq("id", gameId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
