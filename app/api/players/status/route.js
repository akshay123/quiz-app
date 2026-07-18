import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request) {
  try {
    const { session_token } = await request.json();

    if (!session_token) {
      return NextResponse.json({ error: "Missing session token" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reconnect_player", { p_session_token: session_token });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.error) {
      // reconnect_player only recognizes games in 'lobby' or 'active' state.
      // If the game has since completed, fall back to a service-role lookup
      // so the player can still see their final result instead of being kicked out.
      const tokenHash = createHash("sha256").update(session_token).digest("hex");
      const admin = createAdminClient();

      const { data: player } = await admin
        .from("players")
        .select("id, display_name, total_score, game_id, games(id, name, status)")
        .eq("session_token_hash", tokenHash)
        .neq("status", "removed")
        .single();

      if (player && player.games?.status === "completed") {
        return NextResponse.json({
          player: { id: player.id, display_name: player.display_name, total_score: player.total_score },
          game: { id: player.games.id, name: player.games.name, status: "completed" },
          question: null,
          choices: []
        });
      }

      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    let question = null;
    let choices = [];

    if (data.current_question_id) {
      const { data: q } = await supabase
        .from("questions")
        .select("*")
        .eq("id", data.current_question_id)
        .single();
      question = q;

      const { data: c } = await supabase
        .from("question_choices")
        .select("id, choice_key, choice_text, display_order")
        .eq("question_id", data.current_question_id)
        .order("display_order");
      choices = c || [];
    }

    return NextResponse.json({
      player: {
        id: data.player_id,
        display_name: data.display_name,
        total_score: data.total_score
      },
      game: {
        id: data.game_id,
        name: data.game_name,
        status: data.game_status,
        active_sub_state: data.active_sub_state,
        current_question_index: data.current_question_index,
        question_started_at: data.question_started_at,
        question_ends_at: data.question_ends_at
      },
      question,
      choices
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
