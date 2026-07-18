import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { sessionId } = await params;

    const { data, error } = await supabase.rpc("get_leaderboard", { p_session_id: sessionId, p_limit: 50 });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leaderboard: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
