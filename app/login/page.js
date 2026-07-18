"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo }
      });

      if (authError) {
        setError(authError.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="card">
        <h1>Admin Sign In</h1>
        <p>Use Google OAuth to access your quiz admin dashboard.</p>
        <div className="actions">
          <button type="button" onClick={signInWithGoogle} disabled={loading}>
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>
        </div>
        {error ? (
          <p style={{ marginTop: "1rem", color: "#b42318" }}>{error}</p>
        ) : null}
      </div>
    </main>
  );
}
