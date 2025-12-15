"use client";
import { useState } from "react";

// Utility functions for time conversion
function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(p => parseInt(p) || 0);
  if (parts.length === 1) return parts[0]; // Just seconds
  if (parts.length === 2) return parts[0] * 60 + parts[1]; // MM:SS
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  return 0;
}

function secondsToTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function validateTimeFormat(timeStr: string): boolean {
  const timeRegex = /^(?:\d{1,2}:)?\d{1,2}:\d{2}$|^\d+$/;
  return timeRegex.test(timeStr);
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:10");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cleanupParams, setCleanupParams] = useState<{ file: string; workDir: string } | null>(null);

  async function processVideo() {
    console.log("🚀 Starting video processing...", { url, startTime, endTime, title });
    
    // Validate time formats
    if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
      const errorMsg = "Formato de tiempo inválido. Usa formato MM:SS o HH:MM:SS (ej: 01:30, 02:45)";
      console.error("❌ Time format validation error:", { startTime, endTime });
      setError(errorMsg);
      setStatus("Error - Formato de tiempo incorrecto");
      return;
    }
    
    // Convert times to seconds
    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    
    console.log("🕒 Time conversion:", { 
      startTime, 
      endTime, 
      startSeconds, 
      endSeconds, 
      duration: endSeconds - startSeconds 
    });
    
    // Validate time range
    if (startSeconds >= endSeconds) {
      const errorMsg = "El tiempo de inicio debe ser menor al tiempo de fin";
      console.error("❌ Time range validation error:", { startSeconds, endSeconds });
      setError(errorMsg);
      setStatus("Error - Rango de tiempo inválido");
      return;
    }
    
    if (endSeconds - startSeconds < 1) {
      const errorMsg = "La duración mínima debe ser de 1 segundo";
      console.error("❌ Duration validation error:", { duration: endSeconds - startSeconds });
      setError(errorMsg);
      setStatus("Error - Duración demasiado corta");
      return;
    }
    
    setStatus("Procesando…");
    setError(null);
    setIsProcessing(true);
    setDownloadUrl(null);
    
    try {
      console.log("📡 Sending request to /api/process");
      
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          url, 
          start: startSeconds, 
          end: endSeconds, 
          startTime,
          endTime,
          title 
        }),
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
            <span className="text-sm">Inicio</span>
            <input 
              type="text" 
              className="mt-1 w-full border rounded px-3 py-2" 
              value={startTime} 
              onChange={(e)=>setStartTime(e.target.value)} 
              placeholder="00:32"
            />
            <span className="text-xs text-gray-500 mt-1 block">Formato: MM:SS o HH:MM:SS</span>
          </label>
          <label className="block">
            <span className="text-sm">Fin</span>
            <input 
              type="text" 
              className="mt-1 w-full border rounded px-3 py-2" 
              value={endTime} 
              onChange={(e)=>setEndTime(e.target.value)} 
              placeholder="02:43"
            />
            <span className="text-xs text-gray-500 mt-1 block">Formato: MM:SS o HH:MM:SS</span>
          </label>
        </div>
        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
          💡 Ejemplos: 01:30 (1 min 30s), 02:45 (2 min 45s), 1:23:45 (1h 23m 45s)
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
