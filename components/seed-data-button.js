"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SeedDataButton({ onGameCreated }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function seedSampleGame() {
    setLoading(true);
    setMessage("Seeding sample game...");

    try {
      const response = await fetch("/api/seed-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample: true })
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(`Error: ${result.error}`);
      } else {
        setMessage(`✓ Sample game created!`);
        setTimeout(() => setMessage(""), 3000);
        if (onGameCreated) {
          onGameCreated();
        }
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={seedSampleGame}
        disabled={loading}
        style={{
          padding: "0.75rem 1rem",
          background: "#8b5cf6",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: "600",
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? "Seeding..." : "📚 Load Sample Game"}
      </button>
      {message && (
        <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: message.includes("Error") ? "#dc2626" : "#16a34a" }}>
          {message}
        </p>
      )}
    </div>
  );
}
