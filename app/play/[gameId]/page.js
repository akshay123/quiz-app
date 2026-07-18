"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId;

  const [player, setPlayer] = useState(null);
  const [game, setGame] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [playerAnswer, setPlayerAnswer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Get player session from localStorage
    const sessionStr = localStorage.getItem("player_session");
    if (!sessionStr) {
      router.push("/play/join");
      return;
    }

    const session = JSON.parse(sessionStr);
    verifySession(session);
  }, []);

  async function verifySession(session) {
    try {
      const res = await fetch("/api/players/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: session.game_id,
          session_token: session.session_token
        })
      });

      const data = await res.json();
      if (!res.ok) {
        localStorage.removeItem("player_session");
        router.push("/play/join");
      } else {
        setPlayer(data.player);
        setGame(data.game);
        setCurrentQuestion(data.currentQuestion);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <main style={{ padding: "2rem" }}><p>Loading game...</p></main>;
  }

  if (error || !player || !game) {
    return (
      <main style={{ padding: "2rem" }}>
        <div className="card">
          <p style={{ color: "# dc2626" }}>Error: {error || "Session invalid"}</p>
          <button
            onClick={() => router.push("/play/join")}
            className="link-btn"
            style={{ marginTop: "1rem" }}
          >
            Back to Join
          </button>
        </div>
      </main>
    );
  }

  const statusColors = {
    draft: "#999",
    published: "#2563eb",
    active: "#10b981",
    completed: "#8b5cf6"
  };

  return (
    <main style={{ padding: "1.5rem", background: "linear-gradient(135deg, #0f7b6c 0%, #0b5a4f 100%)", minHeight: "100vh" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", color: "white", marginBottom: "2rem" }}>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            {game.title}
          </h1>
          <p style={{ margin: "0", opacity: 0.9, fontSize: "0.9rem" }}>
            Welcome, <strong>{player.display_name}</strong>
          </p>
        </div>

        {/* Game Status */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            display: "inline-block",
            padding: "0.5rem 1rem",
            background: "rgba(255,255,255,0.2)",
            borderRadius: "8px",
            color: "white",
            fontSize: "0.85rem",
            fontWeight: "600"
          }}>
            Status: <span style={{ textTransform: "uppercase" }}>{game.status}</span>
          </div>
        </div>

        {/* Question Display */}
        {game.status === "draft" || game.status === "published" ? (
          <div className="card">
            <h2 style={{ textAlign: "center", color: "#6b7280" }}>
              Waiting for game to start...
            </h2>
            <p style={{ textAlign: "center", margin: "1rem 0 0", color: "#999" }}>
              Your host will start the game shortly
            </p>
          </div>
        ) : game.status === "active" ? (
          currentQuestion ? (
            <div className="card">
              <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
                <p style={{ margin: "0", color: "#6b7280", fontSize: "0.9rem" }}>
                  Question {game.current_question_number} of {game.question_count}
                </p>
              </div>

              <h2 style={{ fontSize: "1.3rem", marginBottom: "1.5rem", lineHeight: "1.4" }}>
                {currentQuestion.text}
              </h2>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                {[
                  { label: "A", text: currentQuestion.option_a },
                  { label: "B", text: currentQuestion.option_b },
                  { label: "C", text: currentQuestion.option_c },
                  { label: "D", text: currentQuestion.option_d }
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setPlayerAnswer(opt.label)}
                    style={{
                      padding: "1rem",
                      border: `2px solid ${playerAnswer === opt.label ? "#0f7b6c" : "#d9e1eb"}`,
                      borderRadius: "8px",
                      background: playerAnswer === opt.label ? "#d1fae5" : "white",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "1rem",
                      transition: "all 0.2s"
                    }}
                  >
                    <strong>{opt.label}.</strong> {opt.text}
                  </button>
                ))}
              </div>

              {playerAnswer && (
                <p style={{ marginTop: "1rem", textAlign: "center", color: "#10b981", fontWeight: "600" }}>
                  ✓ Answer selected: {playerAnswer}
                </p>
              )}
            </div>
          ) : (
            <div className="card">
              <h2 style={{ textAlign: "center", color: "#6b7280" }}>
                Preparing next question...
              </h2>
            </div>
          )
        ) : game.status === "completed" ? (
          <div className="card">
            <h2 style={{ textAlign: "center", color: "#10b981" }}>
              ✓ Game Completed!
            </h2>
            <p style={{ textAlign: "center", margin: "1rem 0 0", color: "#6b7280" }}>
              Thanks for playing
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
