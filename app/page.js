import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="card" style={{ maxWidth: "560px" }}>
        <h1>Multiplayer Quiz</h1>
        <p>
          Live quiz game for groups! Admins create games. Players join with a code. Real-time leaderboard.
        </p>
        <div className="actions">
          <Link href="/play/join" className="link-btn">
            🎮 Join Game
          </Link>
          <Link href="/login" className="link-btn">
            👨‍💼 Admin Login
          </Link>
        </div>
      </div>
    </main>
  );
}
