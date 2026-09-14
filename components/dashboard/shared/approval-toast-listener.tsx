"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { Avatar } from "@/components/ui/avatar";

type ApprovalTable = "purchase_orders" | "purchase_requests";

type ApprovalAudienceRow = {
  submitted_for_approval_by?: string | null;
  approval_requested_from?: string[] | null;
  finance_approval_requested_from?: string[] | null;
};

type DetailRow = ApprovalAudienceRow & {
  id: string;
  status?: string | null;
  po_number?: string | null;
  pr_number?: string | null;
  amount?: number | null;
  vendors?: { name?: string | null } | null;
  projects?: { name?: string | null } | null;
  approved_by_user_id?: string | null;
  finance_approved_by_user_id?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
};

// Pure audience gate. Superadmins and the submitter see every status change
// on a row; approvers only see their own stage. Defaults to the submission
// status so callers that only care about pending_approval stay unchanged.
export function shouldShowApprovalToast(
  currentUserId: string,
  currentRole: string,
  row: ApprovalAudienceRow,
  status: string = "pending_approval",
): boolean {
  if (currentRole === "superadmin") return true;
  if (row.submitted_for_approval_by === currentUserId) return true;
  switch (status) {
    case "pending_approval":
      return row.approval_requested_from?.includes(currentUserId) ?? false;
    case "pending_finance":
      if (row.finance_approval_requested_from?.includes(currentUserId)) return true;
      return currentRole === "finance";
    default:
      // Admin-approve, finance-approve, issue, reject, cancel, paid… only the
      // submitter and superadmins need the toast; the actor already acted.
      return false;
  }
}

type StatusMeta = {
  actor?: keyof DetailRow;
  verb: string;
  hint?: (isSubmitter: boolean) => string;
};

const STATUS_META: Record<string, StatusMeta> = {
  pending_approval: {
    actor: "submitted_for_approval_by",
    verb: "submitted {code} for approval",
    hint: (isSubmitter) => (isSubmitter ? "Awaiting your approvers" : "Requires your approval"),
  },
  pending_finance: {
    actor: "approved_by_user_id",
    verb: "passed the admin stage for {code} — pending finance review",
    hint: (isSubmitter) => (isSubmitter ? "Admin approval done — awaiting finance" : "Finance review required"),
  },
  approved: {
    actor: "finance_approved_by_user_id",
    verb: "approved {code} at the finance stage",
  },
  issued: {
    actor: "finance_approved_by_user_id",
    verb: "approved {code} at the finance stage — PO issued",
  },
  draft: {
    actor: "rejected_by",
    verb: "rejected {code} — back to draft",
  },
  converted: { verb: "{code} was converted into a PO" },
  cancelled: { verb: "{code} was cancelled" },
  partially_paid: { verb: "{code} was marked partially paid" },
  paid: { verb: "{code} was marked paid" },
  overpaid: { verb: "{code} was marked overpaid" },
};

const pendingKeys = new Set(["pending_approval", "pending_finance"]);
const actorColumns = new Set(
  Object.keys(STATUS_META).flatMap((k) => (STATUS_META[k].actor ? [STATUS_META[k].actor as string] : [])),
);

// Toasts whenever a PO/PR leaves its previous status, to the people who need
// to know: the submitter, the approver(s) whose stage just opened, finance for
// the budget check, and superadmins. Renders nothing. Offline users are covered
// by the existing bell + email.
export function ApprovalToastListener() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, { table: ApprovalTable; id: string }>>({});

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function start() {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || disposed) return;
      const uid: string = userId;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      const role: string = profile?.role ?? "user";
      if (disposed) return;

      channel = supabase
        .channel("approval-toasts")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "purchase_orders" },
          (payload: any) => enqueue(payload, "purchase_orders"),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "purchase_requests" },
          (payload: any) => enqueue(payload, "purchase_requests"),
        )
        .subscribe();

      function enqueue(
        payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
        table: ApprovalTable,
      ) {
        const record = payload.new as Record<string, unknown>;
        const prev = payload.old as Record<string, unknown> | null;
        const status = String(record.status ?? "");
        // Only real status transitions toast, not ordinary row edits.
        if (prev?.status === status) return;
        const key = `${table}-${String(record.id)}`;
        if (pendingRef.current[key]) return;
        pendingRef.current[key] = { table, id: String(record.id) };
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          const entries = Object.values(pendingRef.current);
          pendingRef.current = {};
          entries.forEach((e) => void notify(e.table, e.id));
        }, 300);
      }

      async function notify(table: ApprovalTable, id: string) {
        if (disposed) return;
        const { data: row } = await supabase
          .from(table)
          .select(
            table === "purchase_orders"
              ? "po_number, amount, status, submitted_for_approval_by, approval_requested_from, finance_approval_requested_from, approved_by_user_id, finance_approved_by_user_id, rejected_by, rejection_reason, vendors(name)"
              : "pr_number, status, projects(name), submitted_for_approval_by, approval_requested_from, finance_approval_requested_from, approved_by_user_id, finance_approved_by_user_id, rejected_by, rejection_reason",
          )
          .eq("id", id)
          .maybeSingle<DetailRow>();

        const status = row?.status ?? "";
        // A withdrawal back to draft has no rejection_reason; skip the noise.
        if (!row || status === "draft" && !row.rejection_reason) return;
        if (!shouldShowApprovalToast(uid, role, row, status)) return;

        const meta = STATUS_META[status] ?? { verb: `${status} changed the status of {code}` };
        const isSubmitter = row.submitted_for_approval_by === uid;
        const number = table === "purchase_orders" ? row.po_number : row.pr_number;
        const code = `#${number ?? id.slice(0, 8)}`;
        const route = table === "purchase_orders" ? "purchase-orders" : "purchase-requests";
        const detail =
          table === "purchase_orders" && row.vendors?.name
            ? `${row.vendors.name} · ₱${Number(row.amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
            : row.projects?.name;

        let actorProfile: { full_name: string; avatar_url: string | null } | null = null;
        const actorId = meta.actor && actorColumns.has(meta.actor as string) ? row[meta.actor as keyof DetailRow] : undefined;
        if (actorId) {
          const { data } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", actorId)
            .maybeSingle<{ full_name: string; avatar_url: string | null }>();
          actorProfile = data ?? null;
        }

        const verb = meta.verb.replace("{code}", code);
        const label = pendingKeys.has(status) ? "Review" : "View";
        const description =
          (pendingKeys.has(status) && meta.hint?.(isSubmitter)) || undefined;
        const fullDescription = [description, detail].filter(Boolean).join(" · ");

        toast.info(
          <span className="font-medium text-slate-600">
            <span className="font-semibold text-primary">
              {actorProfile ? actorProfile.full_name : "Item"}
            </span>{" "}
            {verb}
          </span>,
          {
            icon: actorProfile ? (
              <Avatar name={actorProfile.full_name} src={actorProfile.avatar_url} />
            ) : undefined,
            description: fullDescription || undefined,
            action: {
              label,
              onClick: () => router.push(`/dashboard/${route}/${id}`),
            },
          },
        );
      }
    }

    void start();

    return () => {
      disposed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}