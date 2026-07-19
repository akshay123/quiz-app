import Link from "next/link";

const FEATURES = [
  { icon: "⚡", title: "Instant join", desc: "Enter a 6-character code and you're in — no app, no signup." },
  { icon: "🏆", title: "Live leaderboard", desc: "Ranks update in real time after every question." },
  { icon: "📊", title: "Excel import", desc: "Upload a spreadsheet to build a quiz in seconds." }
];

export default function HomePage() {
  return (
    <main style={{ display: "block", minHeight: "100vh", padding: 0, justifyItems: "stretch" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1.5rem clamp(1.25rem, 5vw, 3rem)"
        }}
      >
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.2rem", color: "var(--accent-dark)" }}>
          🪔 Multiplayer Quiz
        </span>
        <Link
          href="/login"
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--text)",
            textDecoration: "none",
            padding: "0.55rem 1.1rem",
            border: "1px solid var(--border)",
            borderRadius: "999px",
            background: "var(--surface)",
            whiteSpace: "nowrap"
          }}
        >
          Admin Login →
        </Link>
      </header>

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "clamp(2.5rem, 10vh, 6rem) 1.5rem 3rem",
          gap: "1.5rem"
        }}
      >
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent)"
          }}
        >
          Live · Group · Real-time
        </div>
        <h1
          style={{
            fontSize: "clamp(2.25rem, 6vw, 3.5rem)",
            maxWidth: "700px",
            margin: 0,
            lineHeight: 1.15,
            color: "var(--text)"
          }}
        >
          Play trivia together, wherever you are
        </h1>
        <p style={{ maxWidth: "520px", fontSize: "1.1rem", color: "var(--muted)" }}>
          Admins create quizzes and host live rounds. Players join instantly with a
          code, and the leaderboard updates as everyone answers.
        </p>

        <div style={{ marginTop: "0.5rem" }}>
          <Link href="/play/join" className="link-btn" style={{ fontSize: "1.05rem", padding: "1rem 2.25rem" }}>
            🎮 Join a Game
          </Link>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Hosting?{" "}
          <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Sign in as admin
          </Link>
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.25rem",
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 1.5rem 4rem"
        }}
      >
        {FEATURES.map((f) => (
          <div
            key={f.title}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "1.25rem",
              boxShadow: "var(--shadow-soft-sm)"
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{f.icon}</div>
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "1rem" }}>{f.title}</h3>
            <p style={{ margin: 0, fontSize: "0.85rem" }}>{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
