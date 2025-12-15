"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("10");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cleanupParams, setCleanupParams] = useState<{ file: string; workDir: string } | null>(null);

  async function processVideo() {
    console.log("🚀 Starting video processing...", { url, start, end, title });
    
    setStatus("Procesando…");
    setError(null);
    setIsProcessing(true);
    setDownloadUrl(null);
    
    try {
      console.log("📡 Sending request to /api/process");
      
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, start: Number(start), end: Number(end), title }),
      });
      
      console.log("📥 Response received:", { status: res.status, ok: res.ok });
      
      const data = await res.json();
      console.log("📄 Response data:", data);
      
      if (!res.ok) {
        const errorMsg = data.error || `HTTP ${res.status}: Error procesando el video`;
        console.error("❌ API Error:", errorMsg);
        throw new Error(errorMsg);
      }
      
      const dUrl = `/api/download?file=${encodeURIComponent(data.outFile)}&workDir=${encodeURIComponent(data.workDir)}&cleanup=1`;
      setDownloadUrl(dUrl);
      setCleanupParams({ file: data.outFile, workDir: data.workDir });
      setStatus("Listo para descargar");
      
      console.log("✅ Video processing completed successfully!", { downloadUrl: dUrl });
      
      if (Notification && Notification.permission === "granted" && document.hidden) {
        new Notification("Video listo", { body: "Tu video 1080x1920 está listo." });
      }
    } catch (e: any) {
      const errorMessage = e.message || "Error procesando el video";
      console.error("💥 Video processing failed:", {
        error: e,
        message: errorMessage,
        stack: e.stack,
        timestamp: new Date().toISOString()
      });
      
      setError(errorMessage);
      setStatus("Error - Revisa la consola para más detalles");
    } finally {
      setIsProcessing(false);
    }
  }

  // Request notification permission on load
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  async function cleanup() {
    if (!cleanupParams) return;
    
    console.log("🧹 Starting cleanup...", cleanupParams);
    
    try {
      const res = await fetch(`/api/download?file=${encodeURIComponent(cleanupParams.file)}&workDir=${encodeURIComponent(cleanupParams.workDir)}`, { method: "DELETE" });
      console.log("🧹 Cleanup response:", { status: res.status, ok: res.ok });
      setCleanupParams(null);
      console.log("✅ Cleanup completed successfully");
    } catch (e) {
      console.error("❌ Cleanup failed:", e);
    }
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
        <button 
          onClick={processVideo} 
          disabled={isProcessing}
          className={`w-full rounded py-2 transition-colors ${
            isProcessing 
              ? "bg-gray-400 cursor-not-allowed text-white" 
              : "bg-black text-white hover:bg-gray-800"
          }`}
        >
          {isProcessing ? "Procesando..." : "Procesar"}
        </button>
        
        {status && (
          <div className={`p-3 rounded ${
            error ? "bg-red-50 border border-red-200" : "bg-blue-50 border border-blue-200"
          }`}>
            <p className={`text-sm ${
              error ? "text-red-700" : "text-blue-700"
            }`}>{status}</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error al procesar</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                  <p className="mt-1 text-xs text-red-600">Revisa la consola del navegador (F12) para más detalles técnicos.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
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
