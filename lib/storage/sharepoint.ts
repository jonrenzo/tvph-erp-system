import type { StorageProvider, UploadOptions } from "./provider";

// ponytail: SharePoint provider mirrors S3 paths so existing file_url values keep resolving.
// Human folders (01_Vendor-Documents, 02_Purchase-Orders) come from a later migration that
// rewrites paths via scripts/migrate-to-sharepoint.ts — no caller change needed now.

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

async function getAppToken(): Promise<string> {
  const tenant = process.env.AZURE_TENANT_ID || process.env.SHAREPOINT_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) throw new Error("SharePoint env missing: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET");
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 60000 > now) return tokenCache.token;
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  if (!res.ok) throw new Error(`Graph token failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}

function driveBase(): { siteId: string; driveId: string } {
  const siteId = process.env.SHAREPOINT_SITE_ID;
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  if (!siteId || !driveId) throw new Error("SharePoint env missing: SHAREPOINT_SITE_ID, SHAREPOINT_DRIVE_ID");
  return { siteId, driveId };
}

function encodePath(path: string): string {
  // Graph needs each segment encoded but slashes preserved.
  return path.split("/").map(encodeURIComponent).join("/");
}

export function createSharePointProvider(bucket: string): StorageProvider {
  // bucket is kept for DB compatibility but SharePoint stores everything in one drive.
  // Physical path is `${bucket}/${path}` so vendor-documents and po-artifacts stay separated.
  const prefix = bucket;

  async function graphFetch(url: string, init: RequestInit = {}) {
    const token = await getAppToken();
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    return res;
  }

  return {
    bucket,
    async upload(path, body, opts) {
      const { driveId } = driveBase();
      const fullPath = `${prefix}/${path}`;
      const encoded = encodePath(fullPath);

      // Determine size for single vs session upload. File/Blob/Buffer all have size-ish.
      let bytes: Uint8Array;
      if (body instanceof Uint8Array) bytes = body;
      else if (body instanceof Buffer) bytes = new Uint8Array(body);
      else if (body instanceof ArrayBuffer) bytes = new Uint8Array(body);
      else if (typeof Blob !== "undefined" && body instanceof Blob) {
        bytes = new Uint8Array(await (body as Blob).arrayBuffer());
      } else if (typeof File !== "undefined" && body instanceof File) {
        bytes = new Uint8Array(await (body as File).arrayBuffer());
      } else {
        // Fallback: string/unknown
        bytes = new Uint8Array(Buffer.from(String(body)));
      }

      const size = bytes.byteLength;
      const contentType = opts?.contentType || "application/octet-stream";

      if (size <= 4 * 1024 * 1024) {
        const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encoded}:/content`;
        const res = await graphFetch(url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: bytes as unknown as BodyInit,
        });
        if (!res.ok) return { error: { message: `SharePoint upload failed: ${res.status} ${await res.text()}` } };
        return { error: null };
      }

      // Upload session for >4MB, chunk at 4MB
      const sessionUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encoded}:/createUploadSession`;
      const sessionRes = await graphFetch(sessionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": opts?.upsert ? "replace" : "fail" } }),
      });
      if (!sessionRes.ok) return { error: { message: `SharePoint session failed: ${sessionRes.status} ${await sessionRes.text()}` } };
      const { uploadUrl } = (await sessionRes.json()) as { uploadUrl: string };
      const chunkSize = 4 * 1024 * 1024;
      for (let offset = 0; offset < size; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, size) - 1;
        const chunk = bytes.slice(offset, end + 1);
        const chunkRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Length": String(chunk.byteLength),
            "Content-Range": `bytes ${offset}-${end}/${size}`,
          },
          body: chunk as unknown as BodyInit,
        });
        if (!chunkRes.ok && chunkRes.status !== 201 && chunkRes.status !== 202) {
          return { error: { message: `SharePoint chunk failed at ${offset}: ${chunkRes.status} ${await chunkRes.text()}` } };
        }
      }
      return { error: null };
    },
    getPublicUrl(path) {
      // SharePoint has no public URL; store a stable graph path URL for DB. The app will
      // turn this into a short-lived sharing link on read via createSignedUrl.
      const { driveId } = driveBase();
      const fullPath = `${prefix}/${path}`;
      return { data: { publicUrl: `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodePath(fullPath)}` } };
    },
    async createSignedUrl(path, _expiresIn) {
      const { driveId } = driveBase();
      const fullPath = `${prefix}/${path}`;
      // Look up driveItem id first, then create sharing link.
      const itemUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodePath(fullPath)}`;
      const itemRes = await graphFetch(itemUrl);
      if (!itemRes.ok) return { data: null, error: { message: `SharePoint item lookup failed: ${itemRes.status}` } };
      const item = (await itemRes.json()) as { id: string };
      const linkUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${item.id}/createLink`;
      const linkRes = await graphFetch(linkUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "view", scope: "organization" }),
      });
      if (!linkRes.ok) return { data: null, error: { message: `SharePoint createLink failed: ${linkRes.status} ${await linkRes.text()}` } };
      const link = (await linkRes.json()) as { link: { webUrl: string } };
      return { data: { signedUrl: link.link.webUrl }, error: null };
    },
    async createSignedUrls(paths, expiresIn) {
      const results: { path: string; signedUrl: string | null; error?: string }[] = [];
      for (const p of paths) {
        try {
          const { data, error } = await this.createSignedUrl(p, expiresIn);
          if (error || !data?.signedUrl) {
            results.push({ path: p, signedUrl: null, error: error?.message });
          } else {
            results.push({ path: p, signedUrl: data.signedUrl });
          }
        } catch (e: any) {
          results.push({ path: p, signedUrl: null, error: e.message });
        }
      }
      return { data: results, error: null };
    },
    async remove(paths) {
      const { driveId } = driveBase();
      for (const p of paths) {
        const fullPath = `${prefix}/${p}`;
        const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodePath(fullPath)}`;
        await graphFetch(url, { method: "DELETE" });
      }
      return { error: null };
    },
    async download(path) {
      const { driveId } = driveBase();
      const fullPath = `${prefix}/${path}`;
      const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodePath(fullPath)}:/content`;
      const res = await graphFetch(url);
      if (!res.ok) return { data: null, error: { message: `SharePoint download failed: ${res.status}` } };
      const blob = await res.blob();
      return { data: blob, error: null };
    },
  };
}
