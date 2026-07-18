import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import GamesListContent from "@/components/games-list-content";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <div style={{
        background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)",
        color: "white",
        padding: "2rem 1.5rem",
        borderBottom: "1px solid var(--border)"
      }}>
        <div className="container-wide">
          <h1 style={{ margin: "0 0 0.5rem", color: "white" }}>Welcome, {user.email.split("@")[0]}</h1>
          <p style={{ margin: "0", opacity: 0.9, color: "white" }}>Manage your quiz games and host live events</p>
        </div>
      </div>
      <GamesListContent user={user} />
      <div style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        display: "flex",
        gap: "1rem"
      }}>
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn-secondary">
            Sign Out
          </button>
        </form>
      </div>
    </>
  );
}
