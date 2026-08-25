/**
 * Unit tests for signPortalPO — required signed-PDF/image upload and status handling.
 */

import { signPortalPO } from "@/app/portal/actions";

jest.mock("@/utils/supabase/service", () => ({
  createServiceRoleClient: jest.fn(),
}));
jest.mock("@/utils/notifications", () => ({
  createNotification: jest.fn(async () => {}),
}));
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(), refresh: jest.fn(),
}));
jest.mock("@/lib/pdf/combineImagesToPdf", () => ({
  combineImagesToPdf: jest.fn(async () => new Uint8Array([1, 2, 3, 4])),
}));

const { createServiceRoleClient } = require("@/utils/supabase/service") as {
  createServiceRoleClient: jest.Mock;
};

function mockClient(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    is: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    ...overrides,
  };
  const bucket = {
    upload: jest.fn(async () => ({ error: null })),
    getPublicUrl: jest.fn((path: string) => ({
      data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/po-artifacts/${path}` },
    })),
  };
  const client = {
    from: jest.fn(() => chain),
    storage: {
      from: jest.fn(() => bucket),
    },
  };
  createServiceRoleClient.mockReturnValue(client);
  return { chain, client };
}

const MAGIC = {
  id: "magic-1",
  entity_type: "po",
  entity_id: "po-1",
  expires_at: new Date(Date.now() + 86400000).toISOString(),
};
const PO = { id: "po-1", po_number: "PO-1", status: "pending_signature", vendors: { name: "Acme" } };
const PDF_FILE = { name: "signed.pdf", type: "application/pdf", arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
const JPG_FILE = { name: "page1.jpg", type: "image/jpeg", arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
const PNG_FILE = { name: "page2.png", type: "image/png", arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;

describe("signPortalPO", () => {
  it("rejects a missing file", async () => {
    const { chain } = mockClient();
    chain.maybeSingle.mockResolvedValue({ data: MAGIC, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });

    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", null as unknown as File);
    expect(res).toEqual({
      error: "Please upload the signed purchase order PDF or up to 3 images to complete signing.",
    });
  });

  it("rejects a non-PDF non-image file", async () => {
    const { chain } = mockClient();
    chain.maybeSingle.mockResolvedValue({ data: MAGIC, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });

    const doc = { ...PDF_FILE, type: "text/plain" } as unknown as File;
    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", doc);
    expect(res).toEqual({ error: "Only PDF or JPEG/PNG images are accepted for the signed purchase order." });
  });

  it("rejects mixed PDF and images", async () => {
    const { chain } = mockClient();
    chain.maybeSingle.mockResolvedValue({ data: MAGIC, error: null });

    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", [PDF_FILE, JPG_FILE] as unknown as File[]);
    expect(res).toEqual({ error: "Please upload either a single PDF or up to 3 images, not both." });
  });

  it("rejects more than 3 images", async () => {
    const { chain } = mockClient();
    chain.maybeSingle.mockResolvedValue({ data: MAGIC, error: null });
    const files = [JPG_FILE, JPG_FILE, JPG_FILE, PNG_FILE] as unknown as File[];
    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", files);
    expect(res).toEqual({
      error: "Up to 3 images are accepted. Please combine additional pages into the same images.",
    });
  });

  it("uploads the file, inserts the signature, and moves the PO to signed_received", async () => {
    const { chain, client } = mockClient();
    chain.maybeSingle
      .mockResolvedValueOnce({ data: MAGIC, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });
    const upload = client.storage.from("po-artifacts").upload;
    upload.mockResolvedValue({ error: null });
    chain.insert.mockResolvedValue({ error: null });
    chain.update.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", PDF_FILE);

    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^po\/po-1\/signed-\d+\.pdf$/),
      expect.any(Buffer),
      { contentType: "application/pdf", upsert: false },
    );
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ po_id: "po-1", signer_name: "Jane Doe", signer_title: "MD", ip_address: "1.2.3.4" }),
    );
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "signed_received", signed_doc_status: "pending_approval" }),
      { count: "exact" },
    );
    expect(res).toHaveProperty("success", true);
  });

  it("combines up to 3 images into a PDF and uploads", async () => {
    const { chain, client } = mockClient();
    chain.maybeSingle
      .mockResolvedValueOnce({ data: MAGIC, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });
    const upload = client.storage.from("po-artifacts").upload;
    upload.mockResolvedValue({ error: null });
    chain.insert.mockResolvedValue({ error: null });
    chain.update.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    const { combineImagesToPdf } = require("@/lib/pdf/combineImagesToPdf") as { combineImagesToPdf: jest.Mock };
    combineImagesToPdf.mockClear();

    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", [JPG_FILE, PNG_FILE] as unknown as File[]);

    expect(combineImagesToPdf).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ mimeType: "image/jpeg" }),
        expect.objectContaining({ mimeType: "image/png" }),
      ]),
    );
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^po\/po-1\/signed-\d+\.pdf$/),
      expect.any(Buffer),
      { contentType: "application/pdf", upsert: false },
    );
    expect(res).toHaveProperty("success", true);
  });

  it("shortens the link expiry to ~15 mins after a successful upload", async () => {
    const { chain, client } = mockClient();
    chain.maybeSingle
      .mockResolvedValueOnce({ data: MAGIC, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });
    const upload = client.storage.from("po-artifacts").upload;
    upload.mockResolvedValue({ error: null });
    chain.insert.mockResolvedValue({ error: null });
    const updateMock = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) }));
    chain.update = updateMock;

    await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", PDF_FILE);

    const graceCall = updateMock.mock.calls.find((c: unknown[]) => (c[0] as Record<string, unknown>).expires_at);
    expect(graceCall).toBeDefined();
    const expiresAt = new Date((graceCall![0] as Record<string, string>).expires_at).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(expiresAt).toBeLessThan(Date.now() + 16 * 60 * 1000);
  });

  it("rejects a re-upload when the PO is already signed", async () => {
    const { chain } = mockClient();
    chain.maybeSingle
      .mockResolvedValueOnce({ data: MAGIC, error: null })
      .mockResolvedValueOnce({ data: { id: "sig-1" }, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });

    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", PDF_FILE);
    expect(res).toEqual({
      error:
        "This purchase order has already been signed. This link has been retired. Please request a new link from your TelcoVantage contact if a correction is needed.",
    });
  });
});
