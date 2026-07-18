"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JoinPage() {
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
            game_id: data.game_id,
            session_token: data.session_token,
            display_name: displayName
          })
        );
        router.push(`/play/${data.game_id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem" }}>
      <div style={{ maxWidth: "500px", margin: "5rem auto" }}>
        <div className="card">
          <h1 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Join Game</h1>
          <p style={{ textAlign: "center", color: "#6b7280", marginBottom: "2rem" }}>
            Enter the game code from your host
          </p>

          <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>Game Code</label>
              <input
                type="text"
                placeholder="e.g. ABC123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d9e1eb",
                  borderRadius: "8px",
                  fontSize: "1.1rem",
                  letterSpacing: "2px",
                  textAlign: "center",
                  fontWeight: "600",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>Your Name</label>
              <input
                type="text"
                placeholder="Enter your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
                maxLength="20"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d9e1eb",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {error && (
              <p style={{ color: "#dc2626", background: "#fee2e2", padding: "0.75rem", borderRadius: "8px", margin: "0" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !roomCode.trim() || !displayName.trim()}
              style={{
                padding: "0.75rem",
                background: "#0f7b6c",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: "600",
                cursor: loading || !roomCode.trim() || !displayName.trim() ? "not-allowed" : "pointer",
                opacity: loading || !roomCode.trim() || !displayName.trim() ? 0.7 : 1
              }}
            >
              {loading ? "Joining..." : "Join Game"}
            </button>
          </form>

          <div style={{ marginTop: "2rem", textAlign: "center", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}>
            <Link href="/" style={{ color: "#0f7b6c", textDecoration: "none", fontSize: "0.9rem" }}>
              ← Back Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
