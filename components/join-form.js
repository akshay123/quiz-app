"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JoinForm({ initialCode }) {
  const [roomCode, setRoomCode] = useState(initialCode ? initialCode.toUpperCase() : "");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const codeLocked = Boolean(initialCode);

  async function handleJoin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/players/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_code: roomCode, display_name: displayName })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join game");
      } else {
        localStorage.setItem(
          "player_session",
          JSON.stringify({
            session_id: data.session_id,
            session_token: data.session_token,
            display_name: displayName
          })
        );
        router.push(`/play/${data.session_id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="card" style={{ maxWidth: "460px" }}>
        <h1 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Join Game</h1>
        <p style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          {codeLocked ? "Just enter your name to jump in" : "Enter the game code from your host"}
        </p>

        <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label>Game Code</label>
            <input
              type="text"
              placeholder="e.g. ABC123"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              disabled={loading || codeLocked}
              autoFocus={!codeLocked}
              style={{
                fontSize: "1.1rem",
                letterSpacing: "2px",
                textAlign: "center",
                opacity: codeLocked ? 0.75 : 1
              }}
            />
          </div>

          <div>
            <label>Your Name</label>
            <input
              type="text"
              placeholder="Enter your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
              maxLength="20"
              autoFocus={codeLocked}
            />
          </div>

          {error && (
            <p style={{ color: "var(--danger)", background: "var(--danger-bg)", padding: "0.75rem", borderRadius: "var(--radius-sm)", margin: "0" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !roomCode.trim() || !displayName.trim()}
          >
            {loading ? "Joining..." : "Join Game"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", textAlign: "center", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
          <Link href="/" style={{ fontSize: "0.9rem" }}>
            ← Back Home
          </Link>
        </div>
      </div>
    </main>
  );
}
