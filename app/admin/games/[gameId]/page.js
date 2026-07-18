"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  const gameId = params.gameId;

  useEffect(() => {
    fetchGameDetails();
    const interval = setInterval(fetchGameDetails, 2000);
    return () => clearInterval(interval);
  }, [gameId]);

  async function fetchGameDetails() {
    try {
      const [gameRes, leaderboardRes] = await Promise.all([
        fetch(`/api/games/${gameId}`),
        fetch(`/api/games/${gameId}/leaderboard`)
      ]);

      const gameData = await gameRes.json();
      const leaderboardData = await leaderboardRes.json();

      if (!gameRes.ok) {
        setError(gameData.error || "Failed to load game");
      } else {
        setGame(gameData.game);
        setQuestions(gameData.questions || []);
      }

      if (leaderboardRes.ok) {
        setLeaderboard(leaderboardData.leaderboard || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startGame() {
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active", current_question_number: 1 })
      });
      if (res.ok) {
        const data = await res.json();
        setGame(data.updated);
      } else {
        setError("Failed to start game");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  }

  async function advanceQuestion() {
    if (!game) return;
    setActionInProgress(true);
    try {
      const nextQuestionNum = (game.current_question_number || 0) + 1;
      const res = await fetch(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_question_number: nextQuestionNum })
      });
      if (res.ok) {
        const data = await res.json();
        setGame(data.updated);
      } else {
        setError("Failed to advance question");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  }

  async function publishGame() {
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/games/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId })
      });
      if (res.ok) {
        const data = await res.json();
        setGame(data.game);
      } else {
        setError("Failed to publish game");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  }

  async function endGame() {
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });
      if (res.ok) {
        const data = await res.json();
        setGame(data.updated);
        setTimeout(() => router.push("/admin"), 2000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  }

  if (loading) return <main style={{ padding: "2rem" }}><p>Loading game...</p></main>;

  if (error) {
    return (
      <main style={{ padding: "2rem" }}>
        <div className="card">
          <p style={{ color: "#dc2626" }}>Error: {error}</p>
          <Link href="/admin" className="link-btn">
            Back to Games
          </Link>
        </div>
      </main>
    );
  }

  if (!game) return <main><p>Game not found</p></main>;

  const currentQuestion = game.current_question_number
    ? questions.find((q) => q.question_number === game.current_question_number)
    : null;

  return (
    <main style={{ padding: "2rem" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Link href="/admin" style={{ color: "#0f7b6c", textDecoration: "none", marginBottom: "1rem", display: "block" }}>
          ← Back to Games
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "2rem" }}>
          {/* Game Controls */}
          <div className="card">
            <h2 style={{ margin: "0 0 1rem" }}>{game.title}</h2>

            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Status:</strong> <span style={{ color: "#0f7b6c", textTransform: "uppercase", fontSize: "0.9rem", fontWeight: "600" }}>
                  {game.status}
                </span>
              </p>
              {game.room_code && (
                <p style={{ margin: "0.5rem 0", padding: "0.75rem", background: "#fef3c7", borderRadius: "6px", fontFamily: "monospace", fontSize: "1.1rem", fontWeight: "600", letterSpacing: "2px", textAlign: "center" }}>
                  Code: {game.room_code}
                </p>
              )}
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Questions:</strong> {questions.length}
              </p>
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Players:</strong> {leaderboard.length}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {game.status === "draft" && (
                <>
                  <button
                    onClick={publishGame}
                    disabled={actionInProgress}
                    style={{
                      padding: "0.75rem",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: actionInProgress ? "not-allowed" : "pointer",
                      fontWeight: "600",
                      opacity: actionInProgress ? 0.7 : 1
                    }}
                  >
                    📢 Publish & Get Code
                  </button>
                  <button
                    onClick={startGame}
                    disabled={actionInProgress}
                    style={{
                      padding: "0.75rem",
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: actionInProgress ? "not-allowed" : "pointer",
                      fontWeight: "600",
                      opacity: actionInProgress ? 0.7 : 1
                    }}
                  >
                    🎮 Start Game Now
                  </button>
                </>
              )}

              {game.status === "published" && (
                <button
                  onClick={startGame}
                  disabled={actionInProgress}
                  style={{
                    padding: "0.75rem",
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: actionInProgress ? "not-allowed" : "pointer",
                    fontWeight: "600",
                    opacity: actionInProgress ? 0.7 : 1
                  }}
                >
                  🎮 Start Game
                </button>
              )}

              {game.status === "active" && (
                <>
                  <button
                    onClick={advanceQuestion}
                    disabled={actionInProgress || game.current_question_number >= questions.length}
                    style={{
                      padding: "0.75rem",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: actionInProgress ? "not-allowed" : "pointer",
                      fontWeight: "600",
                      opacity: (actionInProgress || game.current_question_number >= questions.length) ? 0.7 : 1
                    }}
                  >
                    → Next Question ({(game.current_question_number || 0) + 1}/{questions.length})
                  </button>
                  <button
                    onClick={endGame}
                    disabled={actionInProgress}
                    style={{
                      padding: "0.75rem",
                      background: "#8b5cf6",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: actionInProgress ? "not-allowed" : "pointer",
                      fontWeight: "600",
                      opacity: actionInProgress ? 0.7 : 1
                    }}
                  >
                    ⏹ End Game
                  </button>
                </>
              )}

              {game.status === "completed" && (
                <p style={{ color: "#10b981", textAlign: "center", fontWeight: "600" }}>
                  ✓ Game Completed
                </p>
              )}
            </div>
          </div>

          {/* Current Question */}
          <div className="card" style={{ background: currentQuestion ? "#f0fdf4" : "#f3f4f6" }}>
            <h3 style={{ margin: "0 0 1rem" }}>
              {currentQuestion ? `Q${game.current_question_number}` : "No Q"}
            </h3>
            {currentQuestion ? (
              <>
                <p style={{ fontSize: "0.95rem", marginBottom: "1rem", fontWeight: "500", lineHeight: "1.3" }}>
                  {currentQuestion.text}
                </p>
                <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.85rem" }}>
                  {[
                    { label: "A", text: currentQuestion.option_a },
                    { label: "B", text: currentQuestion.option_b },
                    { label: "C", text: currentQuestion.option_c },
                    { label: "D", text: currentQuestion.option_d }
                  ].map((opt) => (
                    <div
                      key={opt.label}
                      style={{
                        padding: "0.5rem",
                        border: `1px solid ${opt.label === currentQuestion.correct_option ? "#10b981" : "#e5e7eb"}`,
                        borderRadius: "6px",
                        background: opt.label === currentQuestion.correct_option ? "#ecfdf5" : "white"
                      }}
                    >
                      <strong>{opt.label})</strong> {opt.text}
                      {opt.label === currentQuestion.correct_option && (
                        <span style={{ color: "#10b981", marginLeft: "0.3rem", fontWeight: "600" }}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Publish & start game</p>
            )}
          </div>

          {/* Leaderboard */}
          <div className="card">
            <h3 style={{ margin: "0 0 1rem" }}>🏆 Live Scores</h3>
            <div style={{ display: "grid", gap: "0.4rem" }}>
              {leaderboard.length === 0 ? (
                <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>Waiting for players...</p>
              ) : (
                leaderboard.slice(0, 15).map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: "0.5rem",
                      background: "#f9fafb",
                      borderRadius: "4px",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.85rem"
                    }}
                  >
                    <div>#{p.rank} {p.display_name}</div>
                    <div style={{ fontWeight: "700", color: "#0f7b6c" }}>{p.score}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
