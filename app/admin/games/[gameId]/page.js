"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  const gameId = params.gameId;

  useEffect(() => {
    fetchGameDetails();
  }, [gameId]);

  async function fetchGameDetails() {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load game");
      } else {
        setGame(data.game);
        setQuestions(data.questions || []);
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
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <Link href="/admin" style={{ color: "#0f7b6c", textDecoration: "none", marginBottom: "1rem", display: "block" }}>
          ← Back to Games
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
          {/* Game Info & Controls */}
          <div className="card">
            <h2 style={{ margin: "0 0 1rem" }}>{game.title}</h2>
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Status:</strong> <span style={{ color: "#0f7b6c", textTransform: "uppercase", fontSize: "0.9rem", fontWeight: "600" }}>
                  {game.status}
                </span>
              </p>
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Questions:</strong> {questions.length}
              </p>
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Max Players:</strong> {game.max_players}
              </p>
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Question Duration:</strong> {game.question_duration_seconds}s
              </p>
            </div>

            {game.description && <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>{game.description}</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {game.status === "draft" && (
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
                    disabled={actionInProgress || !currentQuestion || game.current_question_number >= questions.length}
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
              {currentQuestion ? `Question ${game.current_question_number}/${questions.length}` : "No question active"}
            </h3>
            {currentQuestion ? (
              <>
                <p style={{ fontSize: "1.1rem", marginBottom: "1.5rem", fontWeight: "500" }}>
                  {currentQuestion.text}
                </p>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {[
                    { label: "A", text: currentQuestion.option_a },
                    { label: "B", text: currentQuestion.option_b },
                    { label: "C", text: currentQuestion.option_c },
                    { label: "D", text: currentQuestion.option_d }
                  ].map((opt) => (
                    <div
                      key={opt.label}
                      style={{
                        padding: "0.75rem",
                        border: `2px solid ${opt.label === currentQuestion.correct_option ? "#10b981" : "#e5e7eb"}`,
                        borderRadius: "8px",
                        background: opt.label === currentQuestion.correct_option ? "#ecfdf5" : "white"
                      }}
                    >
                      <strong>{opt.label})</strong> {opt.text}
                      {opt.label === currentQuestion.correct_option && (
                        <span style={{ color: "#10b981", marginLeft: "0.5rem", fontWeight: "600" }}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: "#6b7280" }}>Start the game to display questions</p>
            )}
          </div>
        </div>

        {/* Questions List */}
        <div className="card" style={{ marginTop: "2rem" }}>
          <h3>All Questions</h3>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {questions.map((q, idx) => (
              <div
                key={q.id}
                style={{
                  padding: "0.75rem",
                  border: `2px solid ${q.question_number === game.current_question_number ? "#2563eb" : "#e5e7eb"}`,
                  borderRadius: "8px",
                  background: q.question_number === game.current_question_number ? "#eff6ff" : "white"
                }}
              >
                <strong>Q{q.question_number}:</strong> {q.text}
                <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.25rem" }}>
                  {q.category && <span>{q.category} • </span>}
                  Answer: <strong>{q.correct_option}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
