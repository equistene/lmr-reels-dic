import { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  console.log("📥 [API] Download request received");
  
  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  const workDir = url.searchParams.get("workDir");
  const cleanup = url.searchParams.get("cleanup") === "1";
  
  console.log("📄 [API] Download parameters:", { file, workDir, cleanup });
  
  if (!file) {
    const error = "Missing file parameter";
    console.error("❌ [API] Download error:", error);
    return new Response(JSON.stringify({ error }), { 
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  try {
    const stream = createReadStream(file);
    
    console.log("✅ [API] File stream created successfully");

    if (cleanup && workDir) {
      console.log("🗑️ [API] Cleanup scheduled after download");
      
      const finish = async () => {
        console.log("🧹 [API] Starting cleanup...");
        try { 
          await rm(file, { force: true }); 
          console.log("✅ [API] File deleted:", file);
        } catch (e) {
          console.error("❌ [API] Error deleting file:", e);
        }
        try { 
          await rm(workDir, { recursive: true, force: true }); 
          console.log("✅ [API] Work directory deleted:", workDir);
        } catch (e) {
          console.error("❌ [API] Error deleting work directory:", e);
        }
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
  } catch (e: any) {
    const errorMessage = `Failed to create file stream: ${e.message || String(e)}`;
    console.error("💥 [API] Download stream error:", {
      error: e,
      message: errorMessage,
      file,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}

export async function DELETE(req: NextRequest) {
  console.log("🗑️ [API] Manual cleanup request received");
  
  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  const workDir = url.searchParams.get("workDir");
  
  console.log("📄 [API] Cleanup parameters:", { file, workDir });
  
  if (!file || !workDir) {
    const error = "Missing file or workDir parameters";
    console.error("❌ [API] Cleanup error:", error);
    return new Response(JSON.stringify({ error }), { 
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }
  
  try {
    console.log("🧹 [API] Starting manual cleanup...");
    await rm(file, { force: true });
    console.log("✅ [API] File deleted:", file);
    
    await rm(workDir, { recursive: true, force: true });
    console.log("✅ [API] Work directory deleted:", workDir);
    
    console.log("✅ [API] Manual cleanup completed successfully");
  } catch (e: any) {
    console.error("❌ [API] Manual cleanup error:", {
      error: e,
      message: e.message || String(e),
      file,
      workDir,
      timestamp: new Date().toISOString()
    });
  }
  
  return new Response(null, { status: 204 });
}
