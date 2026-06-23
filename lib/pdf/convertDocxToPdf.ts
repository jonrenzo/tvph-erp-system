import "server-only";

export async function convertDocxToPdf(
  docx: Buffer,
  filename: string,
): Promise<Buffer> {
  const secret = process.env.CONVERTAPI_SECRET;
  if (!secret) throw new Error("CONVERTAPI_SECRET is not set");

  const form = new FormData();
  form.append(
    "File",
    new Blob([new Uint8Array(docx)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    filename,
  );
  form.append("StoreFile", "true");

  const res = await fetch("https://as-v2.convertapi.com/convert/docx/to/pdf", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ConvertAPI error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const url: string | undefined = json?.Files?.[0]?.Url;
  if (!url) throw new Error(`ConvertAPI returned no file URL: ${JSON.stringify(json)}`);

  const pdfRes = await fetch(url);
  if (!pdfRes.ok) throw new Error(`ConvertAPI file download error ${pdfRes.status}`);

  return Buffer.from(await pdfRes.arrayBuffer());
}
