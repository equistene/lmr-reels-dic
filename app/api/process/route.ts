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
  try {
    const { url, start, end, title } = await req.json();
    if (!url || start == null || end == null || !title) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }
    const workDir = await mkdtemp(join(tmpdir(), "ytclip-"));
    const inFile = join(workDir, "input.mp4");
    const clipFile = join(workDir, "clip.mp4");
    const outFile = join(workDir, "output_1080x1920.mp4");

    // Download with yt-dlp
    {
      const args = [
        url,
        "-f",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4",
        "-o",
        inFile,
      ];
      const r = await run("yt-dlp", args);
      if (r.code !== 0) throw new Error("yt-dlp failed: " + r.stderr);
    }

    // Extract clip with ffmpeg
    {
      const duration = Math.max(0, Number(end) - Number(start));
      if (!isFinite(duration) || duration <= 0) throw new Error("Invalid time range");
      const args = [
        "-y",
        "-ss",
        String(start),
        "-i",
        inFile,
        "-t",
        String(duration),
        "-c",
        "copy",
        clipFile,
      ];
      const r = await run("ffmpeg", args);
      if (r.code !== 0) throw new Error("ffmpeg clip failed: " + r.stderr);
    }

    // Convert to 1080x1920 with title text overlay
    {
      const text = String(title).replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/"/g, '\\"');
      const filter = `scale=-1:1920:flags=lanczos,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2,drawtext=text='${text}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=50:shadowx=2:shadowy=2`;
      const args = [
        "-y",
        "-i",
        clipFile,
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
      const r = await run("ffmpeg", args);
      if (r.code !== 0) throw new Error("ffmpeg convert failed: " + r.stderr);
    }

    return new Response(
      JSON.stringify({ ok: true, outFile, workDir }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
}
