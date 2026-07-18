import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <div className="card">
        <h1>Multiplayer Quiz</h1>
        <p>
          Supabase is connected. Continue to admin login to authenticate with
          Google.
        </p>
        <div className="actions">
          <Link href="/login" className="link-btn">
            Admin Login
          </Link>
          <Link href="/admin" className="link-muted">
            Admin Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
