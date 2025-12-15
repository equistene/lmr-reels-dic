import { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  const workDir = url.searchParams.get("workDir");
  const cleanup = url.searchParams.get("cleanup") === "1";
  if (!file) return new Response("Missing file", { status: 400 });

  const stream = createReadStream(file);

  if (cleanup && workDir) {
    const finish = async () => {
      try { await rm(file, { force: true }); } catch {}
      try { await rm(workDir, { recursive: true, force: true }); } catch {}
    };
    stream.on("close", finish);
    stream.on("end", finish);
    stream.on("error", finish);
  }

  return new Response(stream as any, {
    headers: {
      "content-type": "video/mp4",
      "content-disposition": `attachment; filename=output_1080x1920.mp4`,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  const workDir = url.searchParams.get("workDir");
  if (!file || !workDir) return new Response("Missing params", { status: 400 });
  try {
    await rm(file, { force: true });
    await rm(workDir, { recursive: true, force: true });
  } catch {}
  return new Response(null, { status: 204 });
}
