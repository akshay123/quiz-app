"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JoinPage() {
  const [gameCode, setGameCode] = useState("");
  const [playerName, setPlayerName] = useState("");
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
        body: JSON.stringify({ game_code: gameCode, player_name: playerName })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join game");
      } else {
        // Store player session in localStorage
        localStorage.setItem("player_session", JSON.stringify({
          game_id: data.game_id,
          player_id: data.player_id,
          session_token: data.session_token,
          player_name: playerName
        }));
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
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                Game Code
              </label>
              <input
                type="text"
                placeholder="e.g. ABC123"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
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
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                Your Name
              </label>
              <input
                type="text"
                placeholder="Enter your display name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                disabled={loading}
                maxLength="50"
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
              disabled={loading || !gameCode.trim() || !playerName.trim()}
              style={{
                padding: "0.75rem",
                background: "#0f7b6c",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: "600",
                cursor:
                  loading || !gameCode.trim() || !playerName.trim() ? "not-allowed" : "pointer",
                opacity: loading || !gameCode.trim() || !playerName.trim() ? 0.7 : 1
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
