"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [player, setPlayer] = useState(null);
  const [game, setGame] = useState(null);
  const [question, setQuestion] = useState(null);
  const [choices, setChoices] = useState([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [recap, setRecap] = useState(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapError, setRecapError] = useState("");

  // Load player session and verify
  useEffect(() => {
    const sessionStr = localStorage.getItem("player_session");
    if (!sessionStr) {
      router.push("/play/join");
      return;
    }
    pollStatus(JSON.parse(sessionStr), true);
  }, []);

  // Poll game/question state every 1 second
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      const sessionStr = localStorage.getItem("player_session");
      if (!sessionStr) return;
      pollStatus(JSON.parse(sessionStr), false);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, question?.id]);

  // Poll leaderboard every 2 seconds
  useEffect(() => {
    if (!sessionId) return;
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/leaderboard`);
        const data = await res.json();
        if (res.ok) setLeaderboard(data.leaderboard);
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      }
    };
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Timer countdown, derived from the server's question_ends_at timestamp
  useEffect(() => {
    if (!game?.question_ends_at) return;

    const tick = () => {
      const remainingMs = new Date(game.question_ends_at).getTime() - Date.now();
      setTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
    };

    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [game?.question_ends_at]);

  async function pollStatus(session, isInitialLoad) {
    try {
      const res = await fetch("/api/players/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: session.session_token })
      });

      const data = await res.json();

      if (!res.ok) {
        localStorage.removeItem("player_session");
        router.push("/play/join");
        return;
      }

      // If question changed, reset answer state
      setQuestion((prevQuestion) => {
        if (prevQuestion?.id !== data.question?.id) {
          setSelectedChoiceId(null);
          setSubmitted(false);
          setLastResult(null);
        }
        return data.question;
      });

      setChoices(data.choices || []);
      setGame(data.game);
      setPlayer(data.player);
    } catch (err) {
      if (isInitialLoad) setError(err.message);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }

  async function submitAnswer(choiceId) {
    if (submitted || !question) return;

    setSelectedChoiceId(choiceId);
    setSubmitted(true);

    try {
      const sessionStr = localStorage.getItem("player_session");
      const session = JSON.parse(sessionStr);

      const res = await fetch("/api/players/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: session.session_token,
          question_id: question.id,
          choice_id: choiceId
        })
      });

      const data = await res.json();
      if (res.ok) {
        setLastResult(data);
      }
    } catch (err) {
      console.error("Failed to submit answer:", err);
    }
  }

  async function openRecap() {
    setShowRecapModal(true);
    if (recap) return;

    setRecapLoading(true);
    setRecapError("");
    try {
      const sessionStr = localStorage.getItem("player_session");
      const session = JSON.parse(sessionStr);

      const res = await fetch("/api/players/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: session.session_token })
      });

      const data = await res.json();
      if (!res.ok) {
        setRecapError(data.error || "Failed to load recap");
      } else {
        setRecap(data.questions || []);
      }
    } catch (err) {
      setRecapError(err.message);
    } finally {
      setRecapLoading(false);
    }
  }

  if (loading) {
    return <main><p>Loading game...</p></main>;
  }

  if (error || !player || !game) {
    return (
      <main>
        <div className="card">
          <p style={{ color: "var(--danger)" }}>Error: {error || "Session invalid"}</p>
          <button onClick={() => router.push("/play/join")} style={{ marginTop: "1rem" }}>
            Back to Join
          </button>
        </div>
      </main>
    );
  }

  const myRankIndex = leaderboard.findIndex((p) => p.display_name === player.display_name);
  const myEntry = myRankIndex >= 0 ? leaderboard[myRankIndex] : null;
  const top3 = leaderboard.slice(0, 3);
  const isInTop3 = myRankIndex >= 0 && myRankIndex < 3;

  const rankChip = myEntry ? (
    <div className="rank-chip">
      🏅 #{myEntry.rank} of {leaderboard.length} · {myEntry.total_score} pts
    </div>
  ) : null;

  const quickView = (
    <div className="quick-leaderboard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <strong style={{ fontSize: "0.85rem" }}>🏆 Quick View</strong>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: "0.3rem 0.7rem", minHeight: "auto", fontSize: "0.75rem" }}
          onClick={() => setShowLeaderboardModal(true)}
        >
          View Full
        </button>
      </div>
      {top3.length === 0 ? (
        <p style={{ fontSize: "0.85rem", margin: 0 }}>No players yet</p>
      ) : (
        <>
          {top3.map((p) => (
            <div
              key={`${p.rank}-${p.display_name}`}
              className={`quick-leaderboard-row${p.display_name === player.display_name ? " is-me" : ""}`}
            >
              <span>#{p.rank} {p.display_name}{p.display_name === player.display_name ? " (You)" : ""}</span>
              <span>{p.total_score}</span>
            </div>
          ))}
          {!isInTop3 && myEntry && (
            <>
              <div className="quick-leaderboard-sep">···</div>
              <div className="quick-leaderboard-row is-me">
                <span>#{myEntry.rank} {myEntry.display_name} (You)</span>
                <span>{myEntry.total_score}</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  const leaderboardModal = showLeaderboardModal ? (
    <div className="modal-overlay" onClick={() => setShowLeaderboardModal(false)}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>🏆 Full Leaderboard</h3>
          <button type="button" className="btn-secondary" style={{ padding: "0.4rem 0.8rem", minHeight: "auto" }} onClick={() => setShowLeaderboardModal(false)}>
            ✕ Close
          </button>
        </div>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {leaderboard.length === 0 ? (
            <p>No players yet</p>
          ) : (
            leaderboard.map((p) => (
              <div
                key={`${p.rank}-${p.display_name}`}
                style={{
                  padding: "0.75rem",
                  background: p.display_name === player.display_name ? "var(--surface-muted)" : "var(--surface)",
                  borderRadius: "var(--radius-sm)",
                  border: p.display_name === player.display_name ? "2px solid var(--accent)" : "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                  #{p.rank} {p.display_name}
                  {p.display_name === player.display_name && " (You)"}
                </div>
                <div style={{ fontWeight: "700", color: "var(--accent-dark)", fontSize: "1rem" }}>{p.total_score}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  ) : null;

  const recapModal = showRecapModal ? (
    <div className="modal-overlay" onClick={() => setShowRecapModal(false)}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>📋 Recap</h3>
          <button type="button" className="btn-secondary" style={{ padding: "0.4rem 0.8rem", minHeight: "auto" }} onClick={() => setShowRecapModal(false)}>
            ✕ Close
          </button>
        </div>
        {recapLoading ? (
          <p>Loading recap...</p>
        ) : recapError ? (
          <p style={{ color: "var(--danger)" }}>{recapError}</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {(recap || []).map((q) => (
              <div
                key={q.question_order}
                style={{
                  padding: "0.85rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface)"
                }}
              >
                <p style={{ margin: "0 0 0.5rem", fontWeight: "600", color: "var(--text)" }}>
                  Q{q.question_order}. {q.question_text}
                </p>
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "var(--correct)" }}>
                  ✓ Correct: {q.correct_choice ? `${q.correct_choice.key}) ${q.correct_choice.text}` : "—"}
                </p>
                {q.answered ? (
                  <p style={{ margin: 0, fontSize: "0.9rem", color: q.was_correct ? "var(--correct)" : "var(--danger)" }}>
                    {q.was_correct ? "✓" : "✗"} Your answer: {q.your_choice ? `${q.your_choice.key}) ${q.your_choice.text}` : "—"}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>You didn't answer this one</p>
                )}
                {q.explanation && (
                  <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>{q.explanation}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <main style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)", minHeight: "100vh" }}>
      <div className="grid-responsive-2" style={{ width: "min(1000px, 100%)", margin: "0 auto" }}>
        {/* Main Question Area */}
        <div>
          <div style={{ textAlign: "center", color: "white", marginBottom: "1.5rem" }}>
            <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", color: "white" }}>{game.name}</h1>
            <p style={{ margin: "0", opacity: 0.9, fontSize: "0.9rem", color: "white" }}>
              Welcome, <strong>{player.display_name}</strong> | Score: <strong>{player.total_score}</strong>
            </p>
          </div>

          {game.status === "published" || game.status === "lobby" ? (
            <div className="card">
              <h2 style={{ textAlign: "center" }}>Waiting for game to start...</h2>
              <p style={{ textAlign: "center", margin: "1rem 0 0" }}>Your host will start the game shortly</p>
            </div>
          ) : game.status === "active" ? (
            question ? (
              <div className="card">
                <div className="sticky-top" style={{ background: "var(--surface)", marginBottom: "1rem", paddingBottom: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <p style={{ margin: "0", fontSize: "0.9rem" }}>
                      Question {game.current_question_index}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {rankChip}
                      <div className={`pill ${timeLeft <= 10 ? "pill-timer-urgent" : ""}`}>
                        ⏱ {timeLeft}s
                      </div>
                    </div>
                  </div>
                  <div className="show-mobile-only">{quickView}</div>
                </div>

                <h2 style={{ fontSize: "1.3rem", marginBottom: "1.5rem", lineHeight: "1.4" }}>{question.question_text}</h2>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {choices.map((choice) => {
                    const revealed = submitted && lastResult?.correct_choice_id;
                    const isCorrectChoice = revealed && choice.id === lastResult.correct_choice_id;
                    const isWrongChoice = revealed && choice.id !== lastResult.correct_choice_id;
                    const isMySelection = selectedChoiceId === choice.id;

                    let className = isMySelection ? "" : "btn-secondary";
                    let extraStyle = {};
                    if (isCorrectChoice) {
                      extraStyle = { background: "var(--correct-bg)", color: "var(--text)", border: "2px solid var(--correct)" };
                    } else if (isWrongChoice) {
                      extraStyle = isMySelection
                        ? { background: "var(--danger-bg)", color: "var(--text)", border: "2px solid var(--danger)" }
                        : { opacity: 0.6 };
                    }

                    return (
                      <button
                        key={choice.id}
                        onClick={() => !submitted && submitAnswer(choice.id)}
                        disabled={submitted || timeLeft === 0}
                        className={className}
                        style={{
                          padding: "1rem",
                          textAlign: "left",
                          justifyContent: "space-between",
                          fontSize: "1rem",
                          minHeight: "auto",
                          ...extraStyle
                        }}
                      >
                        <span>
                          <strong>{choice.choice_key}.</strong>&nbsp;{choice.choice_text}
                        </span>
                        {isCorrectChoice && <span aria-label="Correct">✓</span>}
                        {isWrongChoice && <span aria-label="Incorrect">✗</span>}
                      </button>
                    );
                  })}
                </div>

                {submitted ? (
                  <p
                    style={{
                      marginTop: "1rem",
                      textAlign: "center",
                      color: lastResult?.is_correct === true ? "var(--correct)" : lastResult?.is_correct === false ? "var(--danger)" : "var(--accent)",
                      fontWeight: "600"
                    }}
                  >
                    {lastResult?.is_correct === true && "✓ Correct!"}
                    {lastResult?.is_correct === false && "✗ Not quite — see the correct answer above."}
                    {lastResult?.is_correct === undefined && "✓ Answer submitted! Waiting for next question..."}
                    {lastResult?.points_awarded !== undefined && ` (+${lastResult.points_awarded} pts)`}
                  </p>
                ) : timeLeft === 0 ? (
                  <p style={{ marginTop: "1rem", textAlign: "center", color: "var(--danger)", fontWeight: "600" }}>⏹ Time's up!</p>
                ) : null}
              </div>
            ) : (
              <div className="card">
                <h2 style={{ textAlign: "center" }}>Preparing next question...</h2>
                <div className="show-mobile-only">{quickView}</div>
              </div>
            )
          ) : game.status === "completed" ? (
            <div className="card">
              <h2 style={{ textAlign: "center", color: "var(--accent)" }}>✓ Game Completed!</h2>
              <p style={{ textAlign: "center", margin: "1rem 0 0" }}>
                You scored <strong>{player.total_score} points</strong>
              </p>
              {rankChip && <div style={{ textAlign: "center", marginTop: "1rem" }}>{rankChip}</div>}
              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <button type="button" className="btn-secondary" onClick={openRecap}>
                  📋 View Recap
                </button>
              </div>
              <div className="show-mobile-only" style={{ marginTop: "1rem" }}>{quickView}</div>
            </div>
          ) : null}
        </div>

        {/* Leaderboard Sidebar (desktop/tablet permanent panel) */}
        <div className="card show-desktop-only" style={{ height: "fit-content", position: "sticky", top: "1.5rem" }}>
          {rankChip && <div style={{ marginBottom: "1rem" }}>{rankChip}</div>}
          <h3 style={{ margin: "0 0 1rem" }}>🏆 Leaderboard</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {leaderboard.length === 0 ? (
              <p style={{ fontSize: "0.9rem" }}>No players yet</p>
            ) : (
              leaderboard.slice(0, 10).map((p) => (
                <div
                  key={`${p.rank}-${p.display_name}`}
                  style={{
                    padding: "0.75rem",
                    background: p.display_name === player.display_name ? "var(--surface-muted)" : "var(--surface)",
                    borderRadius: "var(--radius-sm)",
                    border: p.display_name === player.display_name ? "2px solid var(--accent)" : "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                    #{p.rank} {p.display_name}
                    {p.display_name === player.display_name && " (You)"}
                  </div>
                  <div style={{ fontWeight: "700", color: "var(--accent-dark)", fontSize: "1rem" }}>{p.total_score}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {leaderboardModal}
      {recapModal}
    </main>
  );
}
