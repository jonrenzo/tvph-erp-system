import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveStorageKind } from "@/lib/storage/provider";

// Direct upload for under 100MB. Browser asks for an url, then PUTs bytes straight to
// storage (S3 signed url or SharePoint upload session) without buffering in Next.js.

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { bucket?: string; path?: string; size?: number; contentType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bucket = body.bucket?.trim();
  const path = body.path?.trim();
  const size = body.size;
  const contentType = body.contentType || "application/octet-stream";

  if (!bucket || !path) return NextResponse.json({ error: "bucket and path required" }, { status: 400 });
  if (!size || size <= 0 || size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: "size must be between 1 and 100MB" }, { status: 400 });
  }

  const kind = resolveStorageKind(bucket);

  if (kind === "sharepoint") {
    // For SharePoint we mint a session url server side. Small files use single PUT.
    // Reuse the sharepoint provider logic by returning a session descriptor the client can use.
    // To keep this route simple, we create the session here when needed.
    const tenant = process.env.AZURE_TENANT_ID || process.env.SHAREPOINT_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const siteId = process.env.SHAREPOINT_SITE_ID;
    const driveId = process.env.SHAREPOINT_DRIVE_ID;
    if (!tenant || !clientId || !clientSecret || !siteId || !driveId) {
      return NextResponse.json({ error: "SharePoint not configured" }, { status: 500 });
    }

    if (size <= 4 * 1024 * 1024) {
      // Single PUT — client can PUT to graph directly with token fetched via this route.
      // Instead of leaking token, we return a proxy url that forwards the PUT.
      return NextResponse.json({
        kind: "sharepoint-single",
        bucket,
        path: `${bucket}/${path}`,
        chunkSize: size,
        // Client will PUT to this api route which proxies to Graph, keeping token server only.
        uploadUrl: `/api/storage/sharepoint-proxy?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`,
        contentType,
      });
    }

    // Session — proxy url as above, client will send chunks to proxy.
    return NextResponse.json({
      kind: "sharepoint-session",
      bucket,
      path: `${bucket}/${path}`,
      chunkSize: 4 * 1024 * 1024,
      uploadUrl: `/api/storage/sharepoint-proxy?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`,
      contentType,
      size,
    });
  }

  // Supabase S3 — create a signed upload url (service role). Keep token server only,
  // so we proxy too — client POSTs to the proxy with the file bytes.
  return NextResponse.json({
    kind: "supabase",
    bucket,
    path,
    chunkSize: size,
    uploadUrl: `/api/storage/supabase-proxy?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`,
    contentType,
  });
}
