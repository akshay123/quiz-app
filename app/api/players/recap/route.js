import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const { session_token } = await request.json();

    if (!session_token) {
      return NextResponse.json({ error: "Missing session token" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_recap", { p_session_token: session_token });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
