import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function run(cmd: string, args: string[], cwd?: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

export async function POST(req: NextRequest) {
  console.log("🚀 [API] Starting video processing request");
  
  try {
    const body = await req.json();
    const { url, start, end, startTime, endTime, title } = body;
    
    console.log("📄 [API] Request data:", { url, start, end, startTime, endTime, title });
    
    if (!url || start == null || end == null || !title) {
      const error = "Missing required fields: url, start, end, title";
      console.error("❌ [API] Validation error:", error);
      return new Response(JSON.stringify({ error }), { 
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    
    // Validate time range
    const duration = Math.max(0, Number(end) - Number(start));
    if (!isFinite(duration) || duration <= 0) {
      const error = `Invalid time range: start=${start}s, end=${end}s, duration=${duration}s`;
      console.error("❌ [API] Time validation error:", error);
      return new Response(JSON.stringify({ error }), { 
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    
    const workDir = await mkdtemp(join(tmpdir(), "ytclip-"));
    console.log("📁 [API] Created work directory:", workDir);
    
    const extractedFile = join(workDir, "extracted.mp4");
    const outFile = join(workDir, "output_1080x1920.mp4");

    // Download and extract specific time range with yt-dlp
    console.log("📥✂️ [API] Starting yt-dlp download with time extraction...");
    console.log("🕒 [API] Time range:", { 
      startTime: startTime || `${start}s`, 
      endTime: endTime || `${end}s`, 
      duration: `${duration}s` 
    });
    
    {
      const args = [
        url,
        "-f",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4",
        "--download-sections",
        `*${start}-${end}`,
        "-o",
        extractedFile,
      ];
      
      console.log("📄 [API] yt-dlp command:", "yt-dlp", args.join(" "));
      
      const r = await run("yt-dlp", args);
      
      console.log("📄 [API] yt-dlp result:", {
        code: r.code,
        stdoutLength: r.stdout.length,
        stderrLength: r.stderr.length
      });
      
      if (r.code !== 0) {
        const error = `yt-dlp failed (code ${r.code}): ${r.stderr.slice(0, 500)}`;
        console.error("❌ [API] yt-dlp error:", error);
        throw new Error(error);
      }
      
      console.log("✅ [API] yt-dlp extraction completed successfully");
    }

    // Convert to 1080x1920 with title text overlay
    console.log("🎨 [API] Starting ffmpeg conversion to 1080x1920...");
    {
      const text = String(title).replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/"/g, '\\"');
      const filter = `scale=-1:1920:flags=lanczos,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2,drawtext=text='${text}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=50:shadowx=2:shadowy=2`;
      
      console.log("📄 [API] Conversion parameters:", {
        title,
        escapedText: text,
        filterLength: filter.length,
        inputFile: extractedFile
      });
      
      const args = [
        "-y",
        "-i",
        extractedFile,
        "-vf",
        filter,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        outFile,
      ];
      
      console.log("📄 [API] ffmpeg convert command length:", args.join(" ").length, "chars");
      
      const r = await run("ffmpeg", args);
      
      console.log("📄 [API] ffmpeg convert result:", {
        code: r.code,
        stdoutLength: r.stdout.length,
        stderrLength: r.stderr.length
      });
      
      if (r.code !== 0) {
        const error = `ffmpeg convert failed (code ${r.code}): ${r.stderr.slice(0, 500)}`;
        console.error("❌ [API] ffmpeg convert error:", error);
        throw new Error(error);
      }
      
      console.log("✅ [API] ffmpeg conversion completed successfully");
    }

    console.log("✅ [API] Video processing completed successfully!", { outFile, workDir });
    
    return new Response(
      JSON.stringify({ ok: true, outFile, workDir }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    const errorMessage = e?.message || String(e);
    console.error("💥 [API] Processing failed:", {
      error: e,
      message: errorMessage,
      stack: e?.stack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString(),
        details: "Check server console for full error details"
      }), 
      { 
        status: 500,
        headers: { "content-type": "application/json" }
      }
    );
  }
}
