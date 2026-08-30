import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { fetchVendorNodes } from "@/lib/node-status/client";

export type SyncOutcome = {
  vendorId: string;
  vendorName: string;
  status: "ok" | "unmatched" | "failed";
  nodesSynced: number;
  error?: string;
};

export type SyncSummary = {
  synced: number;
  unmatched: number;
  failed: number;
  outcomes: SyncOutcome[];
};

function formatError(
  e: { kind: string; status?: number; message?: string },
): string {
  if (e.kind === "unauthorized") return "Unauthorized — check TWINBACKEND_ERP_KEY";
  if (e.kind === "invalid_request") return "Invalid request sent to twinbackend";
  return e.message || e.kind;
}

async function setSyncState(
  supabase: SupabaseClient,
  vendorId: string,
  fields: {
    last_status: "ok" | "unmatched" | "failed";
    last_error?: string | null;
    last_synced_at?: string;
    last_ok_at?: string;
  },
) {
  await supabase.from("vendor_sync_state").upsert(
    { vendor_id: vendorId, ...fields, updated_at: new Date().toISOString() },
    { onConflict: "vendor_id" },
  );
}

/**
 * Reconcile a vendor's local snapshot with twinbackend: delete any node_status
 * row the vendor no longer has upstream. `keepIds` holds the current node ids;
 * pass `null` when the vendor is gone entirely (404) to drop every local row.
 *
 * Uses a read + `in` delete rather than `not.in`: supabase-js emits unquoted
 * values for `not("node_id", "in", …)` which PostgREST cannot parse, while the
 * plain `in` filter quotes correctly.
 */
async function reconcileNodes(
  supabase: SupabaseClient,
  vendorId: string,
  keepIds: string[] | null,
) {
  if (!keepIds || keepIds.length === 0) {
    return supabase.from("node_status").delete().eq("vendor_id", vendorId);
  }
  const { data: local } = await supabase
    .from("node_status")
    .select("node_id")
    .eq("vendor_id", vendorId);
  const staleIds = (local ?? [])
    .map((r) => r.node_id as string)
    .filter((id) => !keepIds.includes(id));
  if (staleIds.length === 0) {
    return { error: null };
  }
  return supabase
    .from("node_status")
    .delete()
    .eq("vendor_id", vendorId)
    .in("node_id", staleIds);
}

/**
 * Pull one vendor's nodes from twinbackend and upsert the latest snapshot into
 * node_status. `project_id` is deliberately NOT written during the upsert and
 * only auto-filled where it is still NULL (vendor with exactly one
 * project_vendors link) — so manual node→project assignments survive re-syncs.
 */
export async function syncVendor(
  vendorId: string,
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<SyncOutcome> {
  const { data: vendor, error: vendorErr } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("id", vendorId)
    .is("deleted_at", null)
    .maybeSingle();

  if (vendorErr || !vendor?.name) {
    return {
      vendorId,
      vendorName: vendor?.name ?? "",
      status: "failed",
      nodesSynced: 0,
      error: vendorErr?.message ?? "Vendor not found",
    };
  }

  const result = await fetchVendorNodes(vendor.name);

  if (!result.ok) {
    if (result.error.kind === "not_found") {
      await setSyncState(supabase, vendorId, {
        last_status: "unmatched",
        last_error: "Vendor name not found on twinbackend",
      });
      // Vendor no longer exists upstream — drop its whole local snapshot.
      const { error: delErr } = await reconcileNodes(supabase, vendorId, null);
      if (delErr) {
        await setSyncState(supabase, vendorId, {
          last_status: "failed",
          last_error: delErr.message,
        });
        return {
          vendorId,
          vendorName: vendor.name,
          status: "failed",
          nodesSynced: 0,
          error: delErr.message,
        };
      }
      return { vendorId, vendorName: vendor.name, status: "unmatched", nodesSynced: 0 };
    }
    await setSyncState(supabase, vendorId, {
      last_status: "failed",
      last_error: formatError(result.error),
    });
    return {
      vendorId,
      vendorName: vendor.name,
      status: "failed",
      nodesSynced: 0,
      error: formatError(result.error),
    };
  }

  const { data: links } = await supabase
    .from("project_vendors")
    .select("project_id")
    .eq("vendor_id", vendorId);
  const projectId =
    links && links.length === 1 ? (links[0].project_id as string | null) : null;

  const now = new Date().toISOString();
  const rows = (result.data.nodes ?? []).map((n) => ({
    vendor_id: vendorId,
    node_id: n.node_id,
    site: n.site,
    status: n.status,
    date_start: n.date_start,
    due_date: n.due_date,
    date_finished: n.date_finished,
    progress_percentage: n.progress_percentage,
    poles_collected: n.poles_collected,
    poles_total: n.poles_total,
    last_synced_at: now,
    updated_at: now,
  }));

  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from("node_status")
      .upsert(rows, { onConflict: "vendor_id,node_id" });
    if (upsertErr) {
      await setSyncState(supabase, vendorId, {
        last_status: "failed",
        last_error: upsertErr.message,
      });
      return { vendorId, vendorName: vendor.name, status: "failed", nodesSynced: 0, error: upsertErr.message };
    }
  }

  // Drop node_status rows the vendor no longer has upstream (including all rows
  // when the API returned an empty list). Run before auto-fill so removed nodes
  // don't receive a fresh project_id.
  const { error: delErr } = await reconcileNodes(
    supabase,
    vendorId,
    rows.map((r) => r.node_id),
  );
  if (delErr) {
    await setSyncState(supabase, vendorId, {
      last_status: "failed",
      last_error: delErr.message,
    });
    return { vendorId, vendorName: vendor.name, status: "failed", nodesSynced: 0, error: delErr.message };
  }

  // Auto-fill project_id only where unassigned, so manual overrides persist.
  if (projectId) {
    const { error: assignErr } = await supabase
      .from("node_status")
      .update({ project_id: projectId, updated_at: now })
      .eq("vendor_id", vendorId)
      .is("project_id", null);
    if (assignErr) {
      await setSyncState(supabase, vendorId, {
        last_status: "failed",
        last_error: assignErr.message,
      });
      return { vendorId, vendorName: vendor.name, status: "failed", nodesSynced: 0, error: assignErr.message };
    }
  }

  await setSyncState(supabase, vendorId, {
    last_status: "ok",
    last_error: null,
    last_synced_at: now,
    last_ok_at: now,
  });

  return { vendorId, vendorName: vendor.name, status: "ok", nodesSynced: rows.length };
}

/** Sync every vendor that is linked to at least one project (the cron entry). */
export async function syncProjectLinkedVendors(
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<SyncSummary> {
  const { data: pv } = await supabase.from("project_vendors").select("vendor_id");
  const vendorIds = [...new Set((pv ?? []).map((r) => r.vendor_id as string))];

  // ponytail: batched concurrency 5, was serial
  const outcomes: SyncOutcome[] = [];
  for (let i = 0; i < vendorIds.length; i += 5) {
    const batch = vendorIds.slice(i, i + 5);
    const res = await Promise.all(batch.map((id) => syncVendor(id, supabase)));
    outcomes.push(...res);
  }

  return {
    synced: outcomes.filter((o) => o.status === "ok").length,
    unmatched: outcomes.filter((o) => o.status === "unmatched").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    outcomes,
  };
}
