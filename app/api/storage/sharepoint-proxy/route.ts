import { NextRequest, NextResponse } from "next/server";
import { createSharePointProvider } from "@/lib/storage/sharepoint";

export async function PUT(request: NextRequest) {
  const bucket = request.nextUrl.searchParams.get("bucket");
  const path = request.nextUrl.searchParams.get("path");
  if (!bucket || !path) return NextResponse.json({ error: "bucket and path required" }, { status: 400 });

  const provider = createSharePointProvider(bucket);
  const buffer = Buffer.from(await request.arrayBuffer());
  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const { error } = await provider.upload(path, buffer, { contentType, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = provider.getPublicUrl(path);
  return NextResponse.json({ publicUrl: data.publicUrl });
}
