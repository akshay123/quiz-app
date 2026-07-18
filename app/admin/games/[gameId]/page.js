"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [playerCount, setPlayerCount] = useState(0);
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
        setPlayerCount(gameData.player_count || 0);
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

  async function runAction(action) {
    setActionInProgress(true);
    setError("");
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Failed to run action: ${action}`);
      } else {
        await fetchGameDetails();
        if (action === "end") {
          setTimeout(() => router.push("/admin"), 1500);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  }

  async function publishGame() {
    setActionInProgress(true);
    setError("");
    try {
      const res = await fetch(`/api/games/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to publish game");
      } else {
        setGame(data.game);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  }

  if (loading) return <main className="page-shell" style={{ display: "block" }}><p>Loading game...</p></main>;

  if (error && !game) {
    return (
      <main className="page-shell" style={{ display: "block" }}>
        <div className="card">
          <p style={{ color: "var(--danger)" }}>Error: {error}</p>
          <Link href="/admin" className="link-btn">
            Back to Games
          </Link>
        </div>
      </main>
    );
  }

  if (!game) return <main><p>Game not found</p></main>;

  const totalQuestions = questions.length;
  const currentIndex = game.current_question_index || 0;
  const currentQuestion = currentIndex ? questions.find((q) => q.question_order === currentIndex) : null;

  return (
    <main className="page-shell" style={{ display: "block", minHeight: "100vh" }}>
      <div className="container-wide">
        <Link href="/admin" style={{ marginBottom: "1rem", display: "block" }}>
          ← Back to Games
        </Link>

        {error && (
          <div className="card" style={{ background: "var(--danger-bg)", marginBottom: "1rem", width: "100%" }}>
            <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
          </div>
        )}

        <div className="grid-responsive-3">
          {/* Game Controls */}
          <div className="card" style={{ width: "100%" }}>
            <h2 style={{ margin: "0 0 1rem" }}>{game.name}</h2>

            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Status:</strong>{" "}
                <span className={`badge badge-${game.status}`}>{game.status}</span>
              </p>
              {game.room_code && (
                <p className="pill pill-warm" style={{ width: "100%", justifyContent: "center", fontSize: "1.1rem", letterSpacing: "2px", fontFamily: "monospace", margin: "0.5rem 0" }}>
                  Code: {game.room_code}
                </p>
              )}
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Questions:</strong> {totalQuestions}
              </p>
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Players:</strong> {playerCount}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {game.status === "draft" && (
                <button onClick={publishGame} disabled={actionInProgress}>
                  📢 Publish & Get Code
                </button>
              )}

              {(game.status === "published" || game.status === "lobby") && (
                <button
                  onClick={() => runAction("start")}
                  disabled={actionInProgress || (game.status === "lobby" && playerCount === 0)}
                >
                  🎮 Start Game {game.status === "published" ? "(waiting for players)" : ""}
                </button>
              )}

              {game.status === "active" && (
                <>
                  <button onClick={() => runAction("next")} disabled={actionInProgress}>
                    → Next Question ({Math.min(currentIndex + 1, totalQuestions)}/{totalQuestions})
                  </button>
                  <button onClick={() => runAction("end")} disabled={actionInProgress} className="btn-danger">
                    ⏹ End Game
                  </button>
                </>
              )}

              {game.status === "completed" && (
                <p style={{ color: "var(--accent)", textAlign: "center", fontWeight: "600" }}>✓ Game Completed</p>
              )}
            </div>
          </div>

          {/* Current Question */}
          <div className="card" style={{ width: "100%", background: currentQuestion ? "var(--success-bg)" : "var(--surface-muted)" }}>
            <h3 style={{ margin: "0 0 1rem" }}>{currentQuestion ? `Q${currentIndex}` : "No Q"}</h3>
            {currentQuestion ? (
              <>
                <p style={{ fontSize: "0.95rem", marginBottom: "1rem", fontWeight: "500", lineHeight: "1.3", color: "var(--text)" }}>
                  {currentQuestion.question_text}
                </p>
                <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.85rem" }}>
                  {currentQuestion.question_choices.map((choice) => (
                    <div
                      key={choice.id}
                      style={{
                        padding: "0.5rem",
                        border: `1px solid ${choice.is_correct ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: "var(--radius-sm)",
                        background: choice.is_correct ? "var(--success-bg)" : "var(--surface)"
                      }}
                    >
                      <strong>{choice.choice_key})</strong> {choice.choice_text}
                      {choice.is_correct && <span style={{ color: "var(--accent)", marginLeft: "0.3rem", fontWeight: "600" }}>✓</span>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: "0.9rem" }}>Publish & start game</p>
            )}
          </div>

          {/* Leaderboard */}
          <div className="card" style={{ width: "100%" }}>
            <h3 style={{ margin: "0 0 1rem" }}>🏆 Live Scores</h3>
            <div style={{ display: "grid", gap: "0.4rem" }}>
              {leaderboard.length === 0 ? (
                <p style={{ fontSize: "0.85rem" }}>Waiting for players...</p>
              ) : (
                leaderboard.slice(0, 15).map((p) => (
                  <div
                    key={`${p.rank}-${p.display_name}`}
                    style={{
                      padding: "0.5rem",
                      background: "var(--surface-muted)",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.85rem"
                    }}
                  >
                    <div>
                      #{p.rank} {p.display_name}
                    </div>
                    <div style={{ fontWeight: "700", color: "var(--accent-dark)" }}>{p.total_score}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* All Questions */}
        <div className="card" style={{ marginTop: "2rem", width: "100%" }}>
          <h3>All Questions</h3>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {questions.map((q) => (
              <div
                key={q.id}
                style={{
                  padding: "0.75rem",
                  border: `2px solid ${q.question_order === currentIndex ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)",
                  background: q.question_order === currentIndex ? "var(--surface-muted)" : "var(--surface)"
                }}
              >
                <strong>Q{q.question_order}:</strong> {q.question_text}
                <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  {q.category && <span>{q.category} • </span>}
                  Answer: <strong>{q.question_choices.find((c) => c.is_correct)?.choice_key}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
