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
        background: "linear-gradient(135deg, #0f7b6c 0%, #0b5a4f 100%)",
        color: "white",
        padding: "2rem",
        borderBottom: "1px solid #ccc"
      }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h1 style={{ margin: "0 0 0.5rem" }}>Welcome, {user.email.split("@")[0]}</h1>
          <p style={{ margin: "0", opacity: 0.9 }}>Manage your quiz games and host live events</p>
        </div>
      </div>
      <GamesListContent user={user} />
      <div style={{
        position: "fixed",
        bottom: "2rem",
        right: "2rem",
        display: "flex",
        gap: "1rem"
      }}>
        <form action="/auth/signout" method="post">
          <button type="submit" style={{
            padding: "0.5rem 1rem",
            background: "#e5e7eb",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "0.85rem"
          }}>
            Sign Out
          </button>
        </form>
      </div>
    </>
  );
}
