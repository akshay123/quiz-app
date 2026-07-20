"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  const gameId = params.gameId;
  const sessionId = params.sessionId;

  useEffect(() => {
    fetchDetails();
    const interval = setInterval(fetchDetails, 2000);
    return () => clearInterval(interval);
  }, [gameId, sessionId]);

  // Timer countdown, derived from the server's question_ends_at timestamp
  useEffect(() => {
    if (!session?.question_ends_at) {
      setTimeLeft(0);
      return;
    }

    const tick = () => {
      const remainingMs = new Date(session.question_ends_at).getTime() - Date.now();
      setTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
    };

    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [session?.question_ends_at]);

  async function fetchDetails() {
    try {
      const [sessionRes, questionsRes, leaderboardRes, progressRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/games/${gameId}`),
        fetch(`/api/sessions/${sessionId}/leaderboard`),
        fetch(`/api/sessions/${sessionId}/progress`)
      ]);

      const sessionData = await sessionRes.json();
      const questionsData = await questionsRes.json();
      const leaderboardData = await leaderboardRes.json();
      const progressData = await progressRes.json();

      if (!sessionRes.ok) {
        setError(sessionData.error || "Failed to load session");
      } else {
        setSession(sessionData.session);
        setPlayerCount(sessionData.player_count || 0);
      }

      if (questionsRes.ok) {
        setQuestions(questionsData.questions || []);
      }

      if (leaderboardRes.ok) {
        setLeaderboard(leaderboardData.leaderboard || []);
      }

      if (progressRes.ok) {
        setProgress(progressData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyJoinLink() {
    const link = `${window.location.origin}/play/join/${session.room_code}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }

  async function runAction(action) {
    setActionInProgress(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Failed to run action: ${action}`);
      } else {
        await fetchDetails();
        if (action === "end") {
          setTimeout(() => router.push(`/admin/games/${gameId}`), 1500);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  }

  if (loading) return <main className="page-shell" style={{ display: "block" }}><p>Loading session...</p></main>;

  if (error && !session) {
    return (
      <main className="page-shell" style={{ display: "block" }}>
        <div className="card">
          <p style={{ color: "var(--danger)" }}>Error: {error}</p>
          <Link href={`/admin/games/${gameId}`} className="link-btn">
            Back to Game
          </Link>
        </div>
      </main>
    );
  }

  if (!session) return <main><p>Session not found</p></main>;

  const totalQuestions = questions.length;
  const currentIndex = session.current_question_index || 0;
  const currentQuestion = currentIndex ? questions.find((q) => q.question_order === currentIndex) : null;

  return (
    <main className="page-shell" style={{ display: "block", minHeight: "100vh" }}>
      <div className="container-wide">
        <Link href={`/admin/games/${gameId}`} style={{ marginBottom: "1rem", display: "block" }}>
          ← Back to Game
        </Link>

        {error && (
          <div className="card" style={{ background: "var(--danger-bg)", marginBottom: "1rem", width: "100%" }}>
            <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
          </div>
        )}

        <div className="grid-responsive-3">
          {/* Session Controls */}
          <div className="card" style={{ width: "100%" }}>
            <h2 style={{ margin: "0 0 1rem" }}>{session.game_name}</h2>

            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Status:</strong>{" "}
                <span className={`badge badge-${session.status}`}>{session.status}</span>
              </p>
              {session.room_code && (
                <>
                  <p className="pill pill-warm" style={{ width: "100%", justifyContent: "center", fontSize: "1.1rem", letterSpacing: "2px", fontFamily: "monospace", margin: "0.5rem 0" }}>
                    Code: {session.room_code}
                  </p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={copyJoinLink}
                    style={{ width: "100%", margin: "0.5rem 0 0" }}
                  >
                    {linkCopied ? "✓ Link Copied!" : "🔗 Copy Player Link"}
                  </button>
                </>
              )}
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Questions:</strong> {totalQuestions}
              </p>
              <p style={{ margin: "0.5rem 0" }}>
                <strong>Players:</strong> {playerCount}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(session.status === "published" || session.status === "lobby") && (
                <>
                  <button
                    onClick={() => runAction("start")}
                    disabled={actionInProgress || (session.status === "lobby" && playerCount === 0)}
                  >
                    🎮 Start Game {session.status === "published" ? "(waiting for players)" : ""}
                  </button>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>
                    ⚠️ Make sure everyone has joined first — players can't join once the game starts.
                  </p>
                </>
              )}

              {session.status === "active" && (
                <>
                  <button onClick={() => runAction("next")} disabled={actionInProgress}>
                    → Next Question ({Math.min(currentIndex + 1, totalQuestions)}/{totalQuestions})
                  </button>
                  <button onClick={() => runAction("end")} disabled={actionInProgress} className="btn-danger">
                    ⏹ End Game
                  </button>
                </>
              )}

              {session.status === "completed" && (
                <p style={{ color: "var(--accent)", textAlign: "center", fontWeight: "600" }}>✓ Game Completed</p>
              )}
            </div>
          </div>

          {/* Current Question */}
          <div className="card" style={{ width: "100%", background: currentQuestion ? "var(--success-bg)" : "var(--surface-muted)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>{currentQuestion ? `Q${currentIndex}` : "No Q"}</h3>
              {currentQuestion && session.active_sub_state === "question_active" && (
                <div className={`pill ${timeLeft <= 10 ? "pill-timer-urgent" : ""}`}>⏱ {timeLeft}s remaining</div>
              )}
            </div>
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
              <p style={{ fontSize: "0.9rem" }}>Start the game to begin</p>
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

        {/* Answer Progress (current question only, resets each question) */}
        {session.active_sub_state === "question_active" && progress && (
          <div className="card" style={{ marginTop: "2rem", width: "100%" }}>
            <h3 style={{ margin: "0 0 1rem" }}>
              ✏️ Answer Progress — {progress.answered_count}/{progress.total_count} answered
            </h3>
            {progress.players.length === 0 ? (
              <p style={{ fontSize: "0.85rem" }}>No players yet</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {progress.players.map((p) => (
                  <span
                    key={p.id}
                    className="pill"
                    style={
                      p.answered
                        ? { background: "var(--success-bg)", borderColor: "var(--accent)", color: "var(--accent-dark)" }
                        : { opacity: 0.7 }
                    }
                  >
                    {p.answered ? "✓" : "⏳"} {p.display_name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

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
                  Answer:{" "}
                  <strong>
                    {q.question_choices.find((c) => c.is_correct)?.choice_key}) {q.question_choices.find((c) => c.is_correct)?.choice_text}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
