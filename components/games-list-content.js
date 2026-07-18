"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SeedDataButton from "@/components/seed-data-button";

export default function GamesListContent({ user }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchGames();
  }, []);

  async function fetchGames() {
    try {
      const res = await fetch("/api/games");
      const data = await res.json();
      setGames(data.games || []);
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleGameCreated() {
    fetchGames();
  }

  return (
    <main className="page-shell" style={{ display: "block", minHeight: "auto" }}>
      <div className="container-wide">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <h1 style={{ margin: 0 }}>My Games</h1>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link href="/admin/import" className="link-btn">
              📤 Upload Excel
            </Link>
            <SeedDataButton onGameCreated={handleGameCreated} />
          </div>
        </div>

        {loading ? (
          <p>Loading games...</p>
        ) : games.length === 0 ? (
          <div className="card" style={{ width: "100%" }}>
            <p>No games yet. Create one to get started!</p>
            <div style={{ marginTop: "1rem" }}>
              <SeedDataButton onGameCreated={handleGameCreated} />
            </div>
          </div>
        ) : (
          <div className="grid-responsive-list" style={{ display: "grid", gap: "1rem" }}>
            {games.map((game) => (
              <div
                key={game.id}
                className="card"
                style={{ width: "100%", cursor: "pointer" }}
                onClick={() => router.push(`/admin/games/${game.id}`)}
              >
                <div>
                  <h3 style={{ margin: "0 0 0.5rem" }}>{game.name}</h3>
                  <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
                    {game.question_count} question{game.question_count === 1 ? "" : "s"} • {game.session_count} session{game.session_count === 1 ? "" : "s"} run
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
