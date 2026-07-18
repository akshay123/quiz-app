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

  const statusColors = {
    draft: "#6b7280",
    published: "#2563eb",
    lobby: "#f59e0b",
    active: "#10b981",
    completed: "#8b5cf6",
    cancelled: "#dc2626"
  };

  return (
    <main style={{ padding: "2rem" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1>My Games</h1>
          <div style={{ display: "flex", gap: "1rem" }}>
            <SeedDataButton onGameCreated={handleGameCreated} />
          </div>
        </div>

        {loading ? (
          <p>Loading games...</p>
        ) : games.length === 0 ? (
          <div className="card">
            <p>No games yet. Create one to get started!</p>
            <div style={{ marginTop: "1rem" }}>
              <SeedDataButton onGameCreated={handleGameCreated} />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {games.map((game) => (
              <div key={game.id} className="card" style={{ cursor: "pointer" }} onClick={() => router.push(`/admin/games/${game.id}`)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h3 style={{ margin: "0 0 0.5rem" }}>{game.name}</h3>
                    <p style={{ margin: "0.25rem 0", color: "#6b7280", fontSize: "0.9rem" }}>
                      {game.question_count} questions • {game.player_count} players
                    </p>
                    {game.room_code && (
                      <p style={{ margin: "0", color: "#8b5cf6", fontSize: "0.85rem", fontFamily: "monospace" }}>
                        Code: {game.room_code}
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "8px",
                      background: statusColors[game.status] || "#999",
                      color: "white",
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      textTransform: "capitalize"
                    }}
                  >
                    {game.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
