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
    <main className="page-shell" style={{ display: "block", minHeight: "100vh" }}>
      <div className="container-narrow">
        <Link href="/admin" style={{ marginBottom: "1rem", display: "block" }}>
          ← Back to Games
        </Link>

        <div className="card" style={{ width: "100%" }}>
          <h1 style={{ marginTop: 0 }}>Upload Excel Quiz</h1>
          <p>
            Upload an .xlsx file with a Question column and at least two answer/choice columns
            (e.g. Kahoot&apos;s bulk export format, or Choice A/B/C/D).
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
            <div>
              <label>Excel File</label>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={previewing || creating} />
            </div>

            <div>
              <label>Game Name</label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => {
                  setGameName(e.target.value);
                  setNameEdited(true);
                }}
                disabled={previewing || creating}
                placeholder="Enter a name for this game"
              />
            </div>

            {error && (
              <p style={{ color: "var(--danger)", background: "var(--danger-bg)", padding: "0.75rem", borderRadius: "var(--radius-sm)", margin: 0 }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button onClick={handlePreview} disabled={!file || previewing || creating} className="btn-secondary">
                {previewing ? "Parsing..." : "Preview"}
              </button>

              <button onClick={handleCreate} disabled={!canCreate || creating}>
                {creating ? "Creating..." : "Create Game"}
              </button>
            </div>
          </div>

          {preview && (
            <div style={{ marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
              {preview.errors?.length > 0 ? (
                <div>
                  <p style={{ color: "var(--danger)", fontWeight: "600" }}>
                    {preview.errors.length} error{preview.errors.length > 1 ? "s" : ""} (must fix before creating):
                  </p>
                  <ul style={{ color: "var(--danger)" }}>
                    {preview.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p style={{ color: "var(--accent)", fontWeight: "600" }}>
                  ✓ {preview.question_count} question{preview.question_count === 1 ? "" : "s"} parsed successfully
                </p>
              )}

              {preview.warnings?.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <p style={{ color: "var(--accent-warm)", fontWeight: "600" }}>
                    {preview.warnings.length} warning{preview.warnings.length > 1 ? "s" : ""}:
                  </p>
                  <ul style={{ color: "var(--accent-warm)" }}>
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.questions?.length > 0 && (
                <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
                  {preview.questions.slice(0, 5).map((q, i) => (
                    <div key={i} style={{ padding: "0.6rem", background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                      <strong>Q{q.question_order}:</strong> {q.question_text}
                    </div>
                  ))}
                  {preview.questions.length > 5 && (
                    <p style={{ fontSize: "0.85rem", margin: 0 }}>
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
