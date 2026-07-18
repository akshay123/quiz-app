"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_CLASS = {
  draft: "badge-draft",
  published: "badge-published",
  lobby: "badge-lobby",
  active: "badge-active",
  completed: "badge-completed",
  cancelled: "badge-cancelled"
};

export default function GameTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const gameId = params.gameId;

  useEffect(() => {
    fetchGame();
    const interval = setInterval(fetchGame, 4000);
    return () => clearInterval(interval);
  }, [gameId]);

  async function fetchGame() {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load game");
      } else {
        setGame(data.game);
        setQuestions(data.questions || []);
        setSessions(data.sessions || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startNewSession() {
    setStarting(true);
    setError("");
    try {
      const res = await fetch(`/api/games/${gameId}/sessions`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start a new session");
        setStarting(false);
      } else {
        router.push(`/admin/games/${gameId}/sessions/${data.session_id}`);
      }
    } catch (err) {
      setError(err.message);
      setStarting(false);
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

        <div className="card" style={{ width: "100%", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2 style={{ margin: "0 0 0.5rem" }}>{game.name}</h2>
              <p style={{ margin: 0 }}>
                {questions.length} question{questions.length === 1 ? "" : "s"} • {sessions.length} session{sessions.length === 1 ? "" : "s"} run
              </p>
            </div>
            <button onClick={startNewSession} disabled={starting || questions.length === 0}>
              {starting ? "Starting..." : "▶ Start New Session"}
            </button>
          </div>
          {questions.length === 0 && (
            <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>Add at least one question before starting a session.</p>
          )}
        </div>

        {/* Sessions (past and current runs of this game) */}
        <div className="card" style={{ width: "100%", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem" }}>Sessions</h3>
          {sessions.length === 0 ? (
            <p style={{ fontSize: "0.9rem" }}>No sessions yet. Start one to get a room code.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="card"
                  style={{ width: "100%", cursor: "pointer" }}
                  onClick={() => router.push(`/admin/games/${gameId}/sessions/${s.id}`)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                      <p style={{ margin: "0 0 0.25rem", fontFamily: "monospace", fontSize: "0.95rem" }}>
                        {s.room_code || "—"}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.85rem" }}>
                        {s.player_count} player{s.player_count === 1 ? "" : "s"} • {new Date(s.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className={`badge ${STATUS_CLASS[s.status] || ""}`}>{s.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Questions */}
        <div className="card" style={{ width: "100%" }}>
          <h3>All Questions</h3>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {questions.map((q) => (
              <div
                key={q.id}
                style={{
                  padding: "0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface)"
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
