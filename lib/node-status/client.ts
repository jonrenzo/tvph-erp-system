import "server-only";
import { env } from "@/lib/env";

export const NODE_STATUS_API_BASE = "https://asbuilt.telcovantage.com/api/v1";

export type NodeStatus = "pending" | "in_progress" | "completed";

export type NodeSummary = {
  node_id: string;
  site: string | null;
  status: NodeStatus;
  date_start: string | null;
  due_date: string | null;
  date_finished: string | null;
  progress_percentage: number;
  poles_collected: number;
  poles_total: number;
};

export type VendorNodesResponse = {
  vendor_subcon: string;
  nodes: NodeSummary[];
};

export type Collectable = { expected: number; actual: number };
export type NodeCollectables = Record<string, Collectable>;

export type Pole = {
  pole_code: string;
  sequence: number;
  latitude: number | null;
  longitude: number | null;
  status: string;
  cleared_at: string | null;
};

export type NodeDetailResponse = VendorNodesResponse & {
  node_id: string;
  team: string | null;
  collectables: NodeCollectables;
  poles: { total: number; collected: number; list: Pole[] };
};

export type NodeStatusError =
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "invalid_request" }
  | { kind: "http"; status: number; message: string }
  | { kind: "network"; message: string };

export type NodeStatusResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: NodeStatusError };

const DEFAULT_RETRIES = 2; // 3 total attempts, per the twinbackend guide

function backoffMs(attempt: number) {
  return 2000 * 2 ** attempt; // 2s, 4s
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function request<T>(
  path: string,
  vendorName: string,
  retries = DEFAULT_RETRIES,
): Promise<NodeStatusResult<T>> {
  const apiKey = env.TWINBACKEND_ERP_KEY;
  if (!apiKey) {
    return { ok: false, error: { kind: "network", message: "TWINBACKEND_ERP_KEY is not configured" } };
  }

  const url = `${NODE_STATUS_API_BASE}${path}?subcon=${encodeURIComponent(vendorName)}`;
  let lastErr: NodeStatusError = { kind: "network", message: "Request failed" };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "X-ERP-Key": apiKey },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });

      if (res.status === 200) {
        return { ok: true, data: (await res.json()) as T };
      }
      if (res.status === 401) {
        return { ok: false, error: { kind: "unauthorized" } };
      }
      if (res.status === 404) {
        return { ok: false, error: { kind: "not_found" } };
      }
      if (res.status === 422) {
        return { ok: false, error: { kind: "invalid_request" } };
      }
      // 403 (transient throttling) and 5xx retry with backoff; the guide's
      // explicit no-retry list is 401/404/422 only.
      if (res.status === 403 || res.status >= 500) {
        lastErr = { kind: "http", status: res.status, message: (await safeText(res)).slice(0, 300) };
        if (attempt < retries) await sleep(backoffMs(attempt));
        continue;
      }
      lastErr = { kind: "http", status: res.status, message: `HTTP ${res.status}` };
      break;
    } catch (e) {
      lastErr = { kind: "network", message: e instanceof Error ? e.message : String(e) };
      if (attempt < retries) await sleep(backoffMs(attempt));
    }
  }

  return { ok: false, error: lastErr };
}

/** List every node assigned to a vendor (used by the scheduled/manual sync). */
export function fetchVendorNodes(vendorName: string, retries = DEFAULT_RETRIES) {
  return request<VendorNodesResponse>("/integrations/erp/nodes", vendorName, retries);
}

/** Full pole-by-pole + collectable detail for one node (on-demand drill-down). */
export function fetchNodeDetail(nodeId: string, vendorName: string, retries = DEFAULT_RETRIES) {
  return request<NodeDetailResponse>(
    `/integrations/erp/nodes/${encodeURIComponent(nodeId)}`,
    vendorName,
    retries,
  );
}
