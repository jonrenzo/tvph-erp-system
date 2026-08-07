const ORIGINAL_KEY = process.env.TWINBACKEND_ERP_KEY;
const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ORIGINAL_FETCH = global.fetch;

let mod: typeof import("@/lib/node-status/client");

beforeEach(async () => {
  process.env.TWINBACKEND_ERP_KEY = "test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL ?? "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_ANON ?? "anon";
  jest.resetModules();
  mod = await import("@/lib/node-status/client");
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  process.env.TWINBACKEND_ERP_KEY = ORIGINAL_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_ANON;
  jest.useRealTimers();
});

describe("twinbackend client", () => {
  it("sends X-ERP-Key and encodes the subcon name", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ vendor_subcon: "Innoverge, Inc.", nodes: [] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await mod.fetchVendorNodes("Innoverge, Inc.");

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/integrations/erp/nodes");
    expect(String(url)).toContain(encodeURIComponent("Innoverge, Inc."));
    expect((init as RequestInit).headers).toEqual({ "X-ERP-Key": "test-key" });
  });

it("retries a transient 5xx with backoff then succeeds", async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ status: 500, text: async () => "boom" })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ nodes: [] }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pending = mod.fetchVendorNodes("X");
    await jest.advanceTimersByTimeAsync(2000);
    const result = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("retries a transient 403 then succeeds", async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ status: 403, text: async () => "forbidden" })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ nodes: [] }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pending = mod.fetchVendorNodes("X");
    await jest.advanceTimersByTimeAsync(2000);
    const result = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("does not retry 401", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await mod.fetchVendorNodes("X");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: { kind: "unauthorized" } });
  });

  it("treats 404 as not_found without retrying", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 404,
      json: async () => ({ message: "Unknown subcontractor." }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await mod.fetchVendorNodes("X");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: { kind: "not_found" } });
  });

  it("treats 422 as an invalid request without retrying", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 422,
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await mod.fetchNodeDetail("MR1034", "X");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: { kind: "invalid_request" } });
  });

  it("fails fast when the API key is not configured", async () => {
    delete process.env.TWINBACKEND_ERP_KEY;
    jest.resetModules();
    const client = await import("@/lib/node-status/client");
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await client.fetchVendorNodes("X");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("network");
  });

  it("builds the detail URL with the node id", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        vendor_subcon: "X",
        node_id: "MR-1034",
        team: null,
        collectables: {},
        poles: { total: 0, collected: 0, list: [] },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await mod.fetchNodeDetail("MR-1034", "X");

    expect(result.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `/integrations/erp/nodes/${encodeURIComponent("MR-1034")}`,
    );
  });
});
