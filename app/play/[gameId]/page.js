"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId;

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
    if (!gameId) return;
    const interval = setInterval(() => {
      const sessionStr = localStorage.getItem("player_session");
      if (!sessionStr) return;
      pollStatus(JSON.parse(sessionStr), false);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameId, question?.id]);

  // Poll leaderboard every 2 seconds
  useEffect(() => {
    if (!gameId) return;
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}/leaderboard`);
        const data = await res.json();
        if (res.ok) setLeaderboard(data.leaderboard);
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      }
    };
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 2000);
    return () => clearInterval(interval);
  }, [gameId]);

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

  if (loading) {
    return <main style={{ padding: "2rem" }}><p>Loading game...</p></main>;
  }

  if (error || !player || !game) {
    return (
      <main style={{ padding: "2rem" }}>
        <div className="card">
          <p style={{ color: "#dc2626" }}>Error: {error || "Session invalid"}</p>
          <button
            onClick={() => router.push("/play/join")}
            style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#0f7b6c", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            Back to Join
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "1.5rem", background: "linear-gradient(135deg, #0f7b6c 0%, #0b5a4f 100%)", minHeight: "100vh" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        {/* Main Question Area */}
        <div>
          <div style={{ textAlign: "center", color: "white", marginBottom: "2rem" }}>
            <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>{game.name}</h1>
            <p style={{ margin: "0", opacity: 0.9, fontSize: "0.9rem" }}>
              Welcome, <strong>{player.display_name}</strong> | Score: <strong>{player.total_score}</strong>
            </p>
          </div>

          {game.status === "published" || game.status === "lobby" ? (
            <div className="card">
              <h2 style={{ textAlign: "center", color: "#6b7280" }}>Waiting for game to start...</h2>
              <p style={{ textAlign: "center", margin: "1rem 0 0", color: "#999" }}>Your host will start the game shortly</p>
            </div>
          ) : game.status === "active" ? (
            question ? (
              <div className="card">
                <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: "0", color: "#6b7280", fontSize: "0.9rem" }}>
                    Question {game.current_question_index}
                  </p>
                  <div
                    style={{
                      padding: "0.4rem 0.8rem",
                      background: timeLeft <= 10 ? "#fca5a5" : "#d1fae5",
                      color: timeLeft <= 10 ? "#991b1b" : "#065f46",
                      borderRadius: "6px",
                      fontWeight: "600",
                      fontSize: "0.9rem"
                    }}
                  >
                    ⏱ {timeLeft}s
                  </div>
                </div>

                <h2 style={{ fontSize: "1.3rem", marginBottom: "1.5rem", lineHeight: "1.4" }}>{question.question_text}</h2>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {choices.map((choice) => (
                    <button
                      key={choice.id}
                      onClick={() => !submitted && submitAnswer(choice.id)}
                      disabled={submitted || timeLeft === 0}
                      style={{
                        padding: "1rem",
                        border: `2px solid ${selectedChoiceId === choice.id ? "#0f7b6c" : "#d9e1eb"}`,
                        borderRadius: "8px",
                        background: selectedChoiceId === choice.id ? "#d1fae5" : "white",
                        textAlign: "left",
                        cursor: submitted || timeLeft === 0 ? "not-allowed" : "pointer",
                        fontSize: "1rem",
                        transition: "all 0.2s",
                        opacity: submitted || timeLeft === 0 ? 0.7 : 1
                      }}
                    >
                      <strong>{choice.choice_key}.</strong> {choice.choice_text}
                    </button>
                  ))}
                </div>

                {submitted ? (
                  <p style={{ marginTop: "1rem", textAlign: "center", color: "#10b981", fontWeight: "600" }}>
                    ✓ Answer submitted! Waiting for next question...
                    {lastResult?.points_awarded !== undefined && ` (+${lastResult.points_awarded} pts)`}
                  </p>
                ) : timeLeft === 0 ? (
                  <p style={{ marginTop: "1rem", textAlign: "center", color: "#dc2626", fontWeight: "600" }}>⏹ Time's up!</p>
                ) : null}
              </div>
            ) : (
              <div className="card">
                <h2 style={{ textAlign: "center", color: "#6b7280" }}>Preparing next question...</h2>
              </div>
            )
          ) : game.status === "completed" ? (
            <div className="card">
              <h2 style={{ textAlign: "center", color: "#10b981" }}>✓ Game Completed!</h2>
              <p style={{ textAlign: "center", margin: "1rem 0 0", color: "#6b7280" }}>
                You scored <strong>{player.total_score} points</strong>
              </p>
            </div>
          ) : null}
        </div>

        {/* Leaderboard Sidebar */}
        <div className="card" style={{ height: "fit-content", position: "sticky", top: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem" }}>🏆 Leaderboard</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {leaderboard.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>No players yet</p>
            ) : (
              leaderboard.slice(0, 10).map((p) => (
                <div
                  key={`${p.rank}-${p.display_name}`}
                  style={{
                    padding: "0.75rem",
                    background: p.display_name === player.display_name ? "#eff6ff" : "#f9fafb",
                    borderRadius: "6px",
                    border: p.display_name === player.display_name ? "2px solid #2563eb" : "1px solid #e5e7eb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                    #{p.rank} {p.display_name}
                    {p.display_name === player.display_name && " (You)"}
                  </div>
                  <div style={{ fontWeight: "700", color: "#0f7b6c", fontSize: "1rem" }}>{p.total_score}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
