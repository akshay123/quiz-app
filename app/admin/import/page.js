"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ImportGamePage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [gameName, setGameName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  function handleFileChange(e) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreview(null);
    setError("");
    if (selected && !nameEdited) {
      setGameName(selected.name.replace(/\.(xlsx|xls)$/i, ""));
    }
  }

  async function handlePreview() {
    if (!file) return;
    setPreviewing(true);
    setError("");
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", "true");

      const res = await fetch("/api/games/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok && !data.errors) {
        setError(data.error || "Failed to parse file");
      } else {
        setPreview(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCreate() {
    if (!file || !gameName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", gameName.trim());
      formData.append("dryRun", "false");

      const res = await fetch("/api/games/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create game");
        if (data.errors) setPreview(data);
      } else {
        router.push(`/admin/games/${data.game_id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const canCreate = file && gameName.trim() && preview?.success && preview.errors?.length === 0;

  return (
    <main style={{ padding: "2rem" }}>
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        <Link href="/admin" style={{ color: "#0f7b6c", textDecoration: "none", marginBottom: "1rem", display: "block" }}>
          ← Back to Games
        </Link>

        <div className="card">
          <h1 style={{ marginTop: 0 }}>Upload Excel Quiz</h1>
          <p style={{ color: "#6b7280" }}>
            Upload an .xlsx file with a Question column and at least two answer/choice columns
            (e.g. Kahoot&apos;s bulk export format, or Choice A/B/C/D).
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>Excel File</label>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={previewing || creating} />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>Game Name</label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => {
                  setGameName(e.target.value);
                  setNameEdited(true);
                }}
                disabled={previewing || creating}
                placeholder="Enter a name for this game"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d9e1eb",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {error && (
              <p style={{ color: "#dc2626", background: "#fee2e2", padding: "0.75rem", borderRadius: "8px", margin: 0 }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handlePreview}
                disabled={!file || previewing || creating}
                style={{
                  padding: "0.75rem 1.25rem",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: !file || previewing ? "not-allowed" : "pointer",
                  opacity: !file || previewing ? 0.7 : 1
                }}
              >
                {previewing ? "Parsing..." : "Preview"}
              </button>

              <button
                onClick={handleCreate}
                disabled={!canCreate || creating}
                style={{
                  padding: "0.75rem 1.25rem",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: !canCreate || creating ? "not-allowed" : "pointer",
                  opacity: !canCreate || creating ? 0.7 : 1
                }}
              >
                {creating ? "Creating..." : "Create Game"}
              </button>
            </div>
          </div>

          {preview && (
            <div style={{ marginTop: "2rem", borderTop: "1px solid #e5e7eb", paddingTop: "1.5rem" }}>
              {preview.errors?.length > 0 ? (
                <div>
                  <p style={{ color: "#dc2626", fontWeight: "600" }}>
                    {preview.errors.length} error{preview.errors.length > 1 ? "s" : ""} (must fix before creating):
                  </p>
                  <ul style={{ color: "#dc2626" }}>
                    {preview.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p style={{ color: "#16a34a", fontWeight: "600" }}>
                  ✓ {preview.question_count} question{preview.question_count === 1 ? "" : "s"} parsed successfully
                </p>
              )}

              {preview.warnings?.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <p style={{ color: "#b45309", fontWeight: "600" }}>
                    {preview.warnings.length} warning{preview.warnings.length > 1 ? "s" : ""}:
                  </p>
                  <ul style={{ color: "#b45309" }}>
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.questions?.length > 0 && (
                <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
                  {preview.questions.slice(0, 5).map((q, i) => (
                    <div key={i} style={{ padding: "0.6rem", background: "#f9fafb", borderRadius: "6px", fontSize: "0.85rem" }}>
                      <strong>Q{q.question_order}:</strong> {q.question_text}
                    </div>
                  ))}
                  {preview.questions.length > 5 && (
                    <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                      + {preview.questions.length - 5} more question{preview.questions.length - 5 === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
