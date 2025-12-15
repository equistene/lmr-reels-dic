"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("10");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cleanupParams, setCleanupParams] = useState<{ file: string; workDir: string } | null>(null);

  async function processVideo() {
    setStatus("Procesando…");
    setDownloadUrl(null);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, start: Number(start), end: Number(end), title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      const dUrl = `/api/download?file=${encodeURIComponent(data.outFile)}&workDir=${encodeURIComponent(data.workDir)}&cleanup=1`;
      setDownloadUrl(dUrl);
      setCleanupParams({ file: data.outFile, workDir: data.workDir });
      setStatus("Listo para descargar");
      if (Notification && Notification.permission === "granted" && document.hidden) {
        new Notification("Video listo", { body: "Tu video 1080x1920 está listo." });
      }
    } catch (e: any) {
      setStatus(e.message || "Error procesando");
    }
  }

  // Request notification permission on load
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  async function cleanup() {
    if (!cleanupParams) return;
    await fetch(`/api/download?file=${encodeURIComponent(cleanupParams.file)}&workDir=${encodeURIComponent(cleanupParams.workDir)}`, { method: "DELETE" });
    setCleanupParams(null);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 p-6">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-semibold">YT → 1080x1920</h1>
        <label className="block">
          <span className="text-sm">URL de YouTube</span>
          <input className="mt-1 w-full border rounded px-3 py-2" value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm">Inicio (segundos)</span>
            <input type="number" className="mt-1 w-full border rounded px-3 py-2" value={start} onChange={(e)=>setStart(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm">Fin (segundos)</span>
            <input type="number" className="mt-1 w-full border rounded px-3 py-2" value={end} onChange={(e)=>setEnd(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="text-sm">Título</span>
          <input className="mt-1 w-full border rounded px-3 py-2" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Mi clip" />
        </label>
        <button onClick={processVideo} className="w-full bg-black text-white rounded py-2">Procesar</button>
        {status && <p className="text-sm">{status}</p>}
        {downloadUrl && (
          <div className="space-y-2">
            <a className="block w-full text-center bg-green-600 text-white rounded py-2" href={downloadUrl}>Descargar video</a>
            <button onClick={cleanup} className="w-full text-sm text-zinc-600 underline">Borrar temporales</button>
          </div>
        )}
      </div>
    </div>
  );
}
