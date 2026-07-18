"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [submitted, setSubmitted] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [pollInterval, setPollInterval] = useState(null);

  // Load player session and verify
  useEffect(() => {
    const sessionStr = localStorage.getItem("player_session");
    if (!sessionStr) {
      router.push("/play/join");
      return;
    }

    const session = JSON.parse(sessionStr);
    setSessionToken(session.session_token);
    verifySession(session);
  }, []);

  // Fetch game updates every 1 second (polling for game state changes)
  useEffect(() => {
    if (!gameId || !sessionToken) return;

    const interval = setInterval(async () => {
      try {
        const sessionStr = localStorage.getItem("player_session");
        if (!sessionStr) return;
        const session = JSON.parse(sessionStr);

        const res = await fetch("/api/players/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game_id: session.game_id,
            session_token: session.session_token
          })
        });

        const data = await res.json();
        if (res.ok) {
          // If question changed, reset answer and timer
          if (currentQuestion?.id !== data.currentQuestion?.id) {
            setPlayerAnswer(null);
            setSubmitted(false);
            setTimeLeft(30);
          }
          setGame(data.game);
          setCurrentQuestion(data.currentQuestion);
          setPlayer(data.player);
        }
      } catch (err) {
        console.error("Error polling game status:", err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameId, sessionToken, currentQuestion?.id]);

  // Fetch leaderboard every 2 seconds
  useEffect(() => {
    if (!gameId) return;

    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}/leaderboard`);
        const data = await res.json();
        if (res.ok) {
          setLeaderboard(data.leaderboard);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      }
    };

    const interval = setInterval(fetchLeaderboard, 2000);
    return () => clearInterval(interval);
  }, [gameId]);

  // Timer countdown
  useEffect(() => {
    if (game?.status !== "active" || !currentQuestion) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setSubmitted(true); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [game?.status, currentQuestion?.id]);

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

  async function submitAnswer(selectedOption) {
    if (submitted || !currentQuestion) return;

    setPlayerAnswer(selectedOption);
    setSubmitted(true);

    try {
      const res = await fetch("/api/players/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: gameId,
          player_id: player.id,
          session_token: sessionToken,
          question_id: currentQuestion.id,
          answer: selectedOption
        })
      });

      const data = await res.json();
      if (res.ok) {
        setPlayer(data.player);
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
          {/* Header */}
          <div style={{ textAlign: "center", color: "white", marginBottom: "2rem" }}>
            <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
              {game.title}
            </h1>
            <p style={{ margin: "0", opacity: 0.9, fontSize: "0.9rem" }}>
              Welcome, <strong>{player.display_name}</strong> | Score: <strong>{player.score}</strong>
            </p>
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
                <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: "0", color: "#6b7280", fontSize: "0.9rem" }}>
                    Question {game.current_question_number} of {game.question_count}
                  </p>
                  <div style={{
                    padding: "0.4rem 0.8rem",
                    background: timeLeft <= 10 ? "#fca5a5" : "#d1fae5",
                    color: timeLeft <= 10 ? "#991b1b" : "#065f46",
                    borderRadius: "6px",
                    fontWeight: "600",
                    fontSize: "0.9rem"
                  }}>
                    ⏱ {timeLeft}s
                  </div>
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
                      onClick={() => !submitted && submitAnswer(opt.label)}
                      disabled={submitted || timeLeft === 0}
                      style={{
                        padding: "1rem",
                        border: `2px solid ${playerAnswer === opt.label ? "#0f7b6c" : "#d9e1eb"}`,
                        borderRadius: "8px",
                        background: playerAnswer === opt.label ? "#d1fae5" : "white",
                        textAlign: "left",
                        cursor: submitted || timeLeft === 0 ? "not-allowed" : "pointer",
                        fontSize: "1rem",
                        transition: "all 0.2s",
                        opacity: submitted || timeLeft === 0 ? 0.7 : 1
                      }}
                    >
                      <strong>{opt.label}.</strong> {opt.text}
                    </button>
                  ))}
                </div>

                {submitted ? (
                  <p style={{ marginTop: "1rem", textAlign: "center", color: "#10b981", fontWeight: "600" }}>
                    ✓ Answer submitted! Waiting for next question...
                  </p>
                ) : timeLeft === 0 ? (
                  <p style={{ marginTop: "1rem", textAlign: "center", color: "#dc2626", fontWeight: "600" }}>
                    ⏹ Time's up!
                  </p>
                ) : null}
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
                You scored <strong>{player.score} points</strong>
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
                  key={p.id}
                  style={{
                    padding: "0.75rem",
                    background: p.id === player.id ? "#eff6ff" : "#f9fafb",
                    borderRadius: "6px",
                    border: p.id === player.id ? "2px solid #2563eb" : "1px solid #e5e7eb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                      #{p.rank} {p.display_name}
                      {p.id === player.id && " (You)"}
                    </div>
                  </div>
                  <div style={{ fontWeight: "700", color: "#0f7b6c", fontSize: "1rem" }}>
                    {p.score}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
