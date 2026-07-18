import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main>
      <div className="card">
        <h1>Admin Dashboard</h1>
        <p>Signed in as {user.email}</p>
        <div className="actions">
          <form action="/auth/signout" method="post">
            <button type="submit">Sign Out</button>
          </form>
          <Link href="/" className="link-muted">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
