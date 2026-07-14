# Payment Reminder Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement issues #25–#27: per-PO terms, invoice due reminders, vendor deadline reminders, and informational penalties.

**Architecture:** Retain the invoice cron route and add a vendor-deadline route. Put only Manila date arithmetic and penalty math in a small shared helper; preserve existing actions, forms, templates, settings, and cron conventions.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Postgres/RLS/pg_cron/pg_net, Resend, Jest.

## Global Constraints

- A PO is one deliverable; its `due_date` is the deadline.
- An approved 100% completion certificate or cancellation stops vendor reminders.
- Use calendar dates in `Asia/Manila`.
- Penalty rates are decimals: `0.1` means 10%; allow only 0–1.
- PO-linked invoices derive their due date on the server; unlinked invoices keep manual/Net-30 behavior.
- Invoice emails go to active finance, admin, and superadmin users; vendor emails go only to `vendors.contact_email`.
- Only draft POs may edit terms. Only POs with `terms_configured_at` enter new vendor automation.
- Penalties are informational. Monthly penalties are daily-prorated; finance/admin may override a peso amount with a reason.
- Add no dependencies. Preserve `CRON_SECRET`, audit manual mutations, and dedupe only successful email-log milestones.

## File Map

| File | Responsibility |
| --- | --- |
| `lib/payment-terms.ts` | Manila date and pure penalty helpers. |
| `supabase/migrations/20260714_payment_reminder_engine.sql` | Schema, RLS/grants, indexes, email kinds, vendor schedule. |
| `app/dashboard/purchase-orders/actions.ts` | Persist/edit terms and penalty override. |
| `components/dashboard/purchase-orders/create-po-form.tsx` | Create-time terms inputs. |
| `app/dashboard/purchase-orders/[id]/page.tsx`, `components/dashboard/purchase-orders/po-terms-card.tsx` | Read/edit terms and show penalty. |
| `app/dashboard/invoices/actions.ts`, `new/page.tsx`, `create-invoice-form.tsx` | Authoritative linked-invoice due date and preview. |
| `app/api/cron/invoice-due-reminders/route.ts` | Finance/admin milestones and project flag. |
| `app/api/cron/vendor-deadline-reminders/route.ts` | Vendor warnings, overdue repeats, penalty accrual. |
| `lib/email/send.ts`, `lib/email/templates/*.tsx`, `utils/notifications.ts` | New email kinds/templates and null cron actor. |
| `app/dashboard/settings/{page,actions}.ts`, `components/dashboard/settings/settings-tabs.tsx` | Independent reminder settings. |
| `__tests__/{lib,supabase,app}/**` | Pure helper, migration, action, settings, and cron regression coverage. |

---

### Task 1: Add payment-term calculations

**Files:**

- Create: `lib/payment-terms.ts`
- Test: `__tests__/lib/payment-terms.test.ts`

**Interfaces:**

- Produces: `manilaDateString(now?: Date): string`, `addCalendarDays(date, days): string`, `calculatePaymentDueDate(submittedAt, netDays): string`, `calculatePenaltyAmount(input): number`.
- Consumed by: invoice create action and both cron routes.

- [ ] **Step 1: Write the failing tests**

```ts
import { calculatePaymentDueDate, calculatePenaltyAmount } from "@/lib/payment-terms";

it("uses Manila's submission date", () => {
  expect(calculatePaymentDueDate(new Date("2026-07-14T17:00:00.000Z"), 30)).toBe("2026-08-14");
});
it("prorates monthly penalty daily", () => {
  expect(calculatePenaltyAmount({ amount: 100000, rate: 0.1, type: "monthly", overdueDays: 3 })).toBe(1000);
});
it("applies fixed penalty once", () => {
  expect(calculatePenaltyAmount({ amount: 100000, rate: 0.1, type: "fixed", overdueDays: 12 })).toBe(10000);
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest __tests__/lib/payment-terms.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the helper**

```ts
export type PenaltyType = "monthly" | "fixed";

export function manilaDateString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
export function calculatePaymentDueDate(submittedAt: Date, netDays: number): string {
  return addCalendarDays(manilaDateString(submittedAt), netDays);
}
export function calculatePenaltyAmount({ amount, rate, type, overdueDays }: {
  amount: number; rate: number; type: PenaltyType; overdueDays: number;
}): number {
  return Math.round(amount * rate * (type === "fixed" ? 1 : Math.max(0, overdueDays) / 30) * 100) / 100;
}
```

- [ ] **Step 4: Verify and commit**

Run: `npx jest __tests__/lib/payment-terms.test.ts`

Expected: PASS

```bash
git add lib/payment-terms.ts __tests__/lib/payment-terms.test.ts
git commit -m "feat: add payment terms calculations"
```

### Task 2: Add schema, RLS, and vendor cron scheduling

**Files:**

- Create: `supabase/migrations/20260714_payment_reminder_engine.sql`
- Test: `__tests__/supabase/payment-reminder-engine-migration.test.ts`

**Interfaces:**

- Produces: PO terms, `po_penalties`, reminder settings, email kinds, and `trigger_vendor_deadline_reminders()`.
- Consumed by: Tasks 3–7.

- [ ] **Step 1: Write a static migration test**

```ts
import fs from "node:fs";
import path from "node:path";
const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260714_payment_reminder_engine.sql"), "utf8");

it("protects penalties and schedules the vendor route", () => {
  expect(migration).toContain("alter table public.po_penalties enable row level security");
  expect(migration).toContain("create unique index if not exists po_penalties_po_id_idx");
  expect(migration).toContain("/api/cron/vendor-deadline-reminders");
});
```

- [ ] **Step 2: Generate the migration and add the schema**

Run: `supabase migration new payment_reminder_engine`

Expected: a generated SQL migration under `supabase/migrations/`; retain the project filename `20260714_payment_reminder_engine.sql`.

```sql
alter table public.purchase_orders
  add column if not exists net_days integer not null default 30 check (net_days > 0),
  add column if not exists dp_due_days integer check (dp_due_days >= 0),
  add column if not exists penalty_rate numeric(5,4) check (penalty_rate between 0 and 1),
  add column if not exists penalty_type text check (penalty_type in ('monthly', 'fixed')),
  add column if not exists terms_configured_at timestamptz;

create table if not exists public.po_penalties (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  calculated_amount numeric(14,2) not null default 0,
  override_amount numeric(14,2),
  override_reason text,
  first_overdue_on date not null,
  last_calculated_on date not null,
  overridden_by uuid references public.profiles(id),
  overridden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((override_amount is null and override_reason is null) or
    (override_amount is not null and length(trim(override_reason)) > 0))
);
create unique index if not exists po_penalties_po_id_idx on public.po_penalties (po_id);
create index if not exists purchase_orders_terms_due_idx
  on public.purchase_orders (due_date) where terms_configured_at is not null and deleted_at is null;

alter table public.po_penalties enable row level security;
grant select, insert, update on public.po_penalties to authenticated;
create policy "staff can read PO penalties" on public.po_penalties for select to authenticated
  using (public.is_staff((select auth.uid())));
create policy "staff can write PO penalties" on public.po_penalties for all to authenticated
  using (public.is_staff((select auth.uid()))) with check (public.is_staff((select auth.uid())));

alter table public.email_settings
  add column if not exists invoice_due_reminder_days integer not null default 7 check (invoice_due_reminder_days > 0),
  add column if not exists vendor_deadline_warning_days integer[] not null default array[7, 5],
  add column if not exists vendor_overdue_repeat_days integer not null default 7 check (vendor_overdue_repeat_days > 0);
```

- [ ] **Step 3: Extend email kinds and schedule the route**

```sql
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind = any (array[
  'po_issued', 'doc_reminder', 'doc_request', 'invoice_due_reminder',
  'invoice_due_date', 'vendor_deadline_reminder'
]));

create or replace function public.trigger_vendor_deadline_reminders()
returns void language plpgsql security definer set search_path = public, vault, net as $$
declare base_url text; secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if base_url is null or secret is null then return; end if;
  perform net.http_post(
    url := base_url || '/api/cron/vendor-deadline-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb
  );
end;
$$;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'vendor-deadline-reminders') then
    perform cron.unschedule('vendor-deadline-reminders');
  end if;
  perform cron.schedule('vendor-deadline-reminders', '0 0 * * *',
    $cron$ select public.trigger_vendor_deadline_reminders(); $cron$);
end $$;
```

- [ ] **Step 4: Verify and commit**

Run: `npx jest __tests__/supabase/payment-reminder-engine-migration.test.ts`

Expected: PASS

```bash
git add supabase/migrations/20260714_payment_reminder_engine.sql __tests__/supabase/payment-reminder-engine-migration.test.ts
git commit -m "feat: add payment reminder schema"
```

### Task 3: Capture and manage PO terms

**Files:**

- Modify: `app/dashboard/purchase-orders/actions.ts`
- Modify: `components/dashboard/purchase-orders/create-po-form.tsx`
- Modify: `app/dashboard/purchase-orders/[id]/page.tsx`
- Create: `components/dashboard/purchase-orders/po-terms-card.tsx`
- Test: `__tests__/app/dashboard/purchase-orders/payment-terms.test.ts`

**Interfaces:**

- Produces: `updatePurchaseOrderTerms(poId, formData)` and `overridePurchaseOrderPenalty(poId, formData)`.

- [ ] **Step 1: Write failing authorization/validation tests**

```ts
it("rejects a rate outside 0..1", async () => {
  const form = new FormData(); form.set("penalty_rate", "1.1");
  await expect(updatePurchaseOrderTerms("po-1", form)).resolves.toEqual({ error: "Penalty rate must be between 0 and 1." });
});
it("requires a reason for a peso override", async () => {
  const form = new FormData(); form.set("override_amount", "2500");
  await expect(overridePurchaseOrderPenalty("po-1", form)).resolves.toEqual({ error: "Provide a reason for the penalty override." });
});
```

- [ ] **Step 2: Add terms to creation and the draft-only action**

```ts
interface CreatePOInput {
  // existing fields
  net_days?: number; dp_due_days?: number; penalty_rate?: number; penalty_type?: "monthly" | "fixed";
}
const net_days = input.net_days ?? 30;
if (!Number.isInteger(net_days) || net_days <= 0) return { error: "Net days must be a positive whole number." };
if (input.penalty_rate !== undefined && (input.penalty_rate < 0 || input.penalty_rate > 1)) {
  return { error: "Penalty rate must be between 0 and 1." };
}
// add to the existing purchase_orders insert
net_days, dp_due_days: input.dp_due_days ?? null, penalty_rate: input.penalty_rate ?? null,
penalty_type: input.penalty_type ?? null, terms_configured_at: new Date().toISOString(),
```

```ts
export async function updatePurchaseOrderTerms(poId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, error } = await requireCapability("po.write", supabase);
  if (error || !user) return { error: error || "Unauthorized" };
  const { data: po } = await supabase.from("purchase_orders").select("status").eq("id", poId).single();
  if (po?.status !== "draft") return { error: "Terms can only be edited while the PO is a draft." };
  const netDays = Number(formData.get("net_days"));
  const rate = formData.get("penalty_rate") === "" ? null : Number(formData.get("penalty_rate"));
  if (!Number.isInteger(netDays) || netDays <= 0) return { error: "Net days must be a positive whole number." };
  if (rate !== null && (rate < 0 || rate > 1)) return { error: "Penalty rate must be between 0 and 1." };
  await supabase.from("purchase_orders").update({ net_days: netDays, penalty_rate: rate, terms_configured_at: new Date().toISOString() }).eq("id", poId);
  await recordAuditLog({ entity_type: "purchase_order", entity_id: poId, action: "UPDATE", changes: { after: { net_days: netDays, penalty_rate: rate } }, performed_by: user.id });
  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  return { success: true };
}
```

- [ ] **Step 3: Add native form controls and the PO card**

```tsx
<input name="net_days" type="number" min="1" step="1" defaultValue="30" required />
<input name="dp_due_days" type="number" min="0" step="1" />
<input name="penalty_rate" type="number" min="0" max="1" step="0.0001" placeholder="0.1" />
<select name="penalty_type" defaultValue="monthly">
  <option value="monthly">Monthly (prorated daily)</option>
  <option value="fixed">Fixed</option>
</select>
<p className="text-xs text-slate-500">Enter 0.1 for a 10% penalty rate.</p>
```

Load `po_penalties` with the PO page query; pass it to `PoTermsCard`. Render read-only terms for everyone, the terms form only for a draft PO with `po.write`, and the override form only for finance/admin/superadmin. Upsert override amount/reason with the current user, audit it, and revalidate the PO path.

- [ ] **Step 4: Verify and commit**

Run: `npx jest __tests__/app/dashboard/purchase-orders/payment-terms.test.ts __tests__/app/dashboard/purchase-orders/create-po-core.test.ts`

Expected: PASS

```bash
git add app/dashboard/purchase-orders/actions.ts components/dashboard/purchase-orders/create-po-form.tsx app/dashboard/purchase-orders/[id]/page.tsx components/dashboard/purchase-orders/po-terms-card.tsx __tests__/app/dashboard/purchase-orders/payment-terms.test.ts
git commit -m "feat: manage purchase order payment terms"
```

### Task 4: Make linked invoice dates authoritative

**Files:**

- Modify: `app/dashboard/invoices/actions.ts`
- Modify: `app/dashboard/invoices/new/page.tsx`
- Modify: `components/dashboard/invoices/create-invoice-form.tsx`
- Test: `__tests__/app/dashboard/invoices/payment-due-date.test.ts`

**Interfaces:** consumes PO `net_days`; stores a due date derived from the actual server submission time.

- [ ] **Step 1: Write failing linked/unlinked tests**

```ts
it("uses the linked PO's net days", async () => {
  await createInvoice(null, linkedInvoiceFormData());
  expect(invoiceInsert).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-08-14" }));
});
it("retains an unlinked manual due date", async () => {
  await createInvoice(null, unlinkedInvoiceFormData("2026-07-20"));
  expect(invoiceInsert).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-07-20" }));
});
```

- [ ] **Step 2: Update the action and UI**

```ts
const submittedAt = new Date();
const finalDueDate = po_id
  ? calculatePaymentDueDate(submittedAt, Number(po?.net_days ?? 30))
  : due_date || calculatePaymentDueDate(submittedAt, 30);
// insert: due_date: finalDueDate, submitted_at: submittedAt.toISOString()
```

Extend the PO query and form `PO` type with `net_days`. When a PO is selected, preview `addCalendarDays(manilaDateString(), selectedPO.net_days)` in a read-only due-date input; leave the existing editable input only for unlinked invoices.

- [ ] **Step 3: Verify and commit**

Run: `npx jest __tests__/app/dashboard/invoices/payment-due-date.test.ts __tests__/app/dashboard/invoices/po-amount-guard-with-cert.test.ts`

Expected: PASS

```bash
git add app/dashboard/invoices/actions.ts app/dashboard/invoices/new/page.tsx components/dashboard/invoices/create-invoice-form.tsx __tests__/app/dashboard/invoices/payment-due-date.test.ts
git commit -m "feat: derive linked invoice due dates from PO terms"
```

### Task 5: Correct invoice-due cron behavior

**Files:**

- Modify: `app/api/cron/invoice-due-reminders/route.ts`
- Modify: `lib/email/send.ts`, `lib/email/templates/invoice-due.tsx`, `utils/notifications.ts`
- Test: `__tests__/app/api/cron/invoice-due-reminders/route.test.ts`

**Interfaces:** consumes configurable lead days and active internal recipients; writes a successful-only email milestone.

- [ ] **Step 1: Write failing route tests**

```ts
it("emails active finance/admin recipients at the lead-time milestone", async () => {
  await POST(cronRequest());
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
    to: ["finance@tvph.test", "admin@tvph.test"], meta: expect.objectContaining({ milestone: 7 }),
  }));
});
it("flags an incomplete project on due day", async () => {
  await POST(cronRequest());
  expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
    message: expect.stringContaining("not complete"),
  }));
});
```

- [ ] **Step 2: Implement recipients, milestones, and successful-only dedup**

```ts
const today = manilaDateString();
const { data: settings } = await supabase.from("email_settings")
  .select("invoice_due_reminder_days").eq("id", 1).maybeSingle();
const leadDays = settings?.invoice_due_reminder_days ?? 7;
const dateToMilestone = new Map([[addCalendarDays(today, leadDays), leadDays], [today, 0]]);
const { data: recipients } = await supabase.from("profiles").select("email")
  .in("role", ["finance", "admin", "superadmin"]).eq("employment_status", "active");
const to = (recipients ?? []).map(({ email }) => email).filter(Boolean);
```

Query statuses `received`, `under_review`, `approved`, and `partially_paid`; join PO/project completion data. Check `email_log.kind`, `ref_id`, `meta->>milestone`, and `status = 'sent'` before sending. Use `invoice_due_reminder` for the lead milestone and `invoice_due_date` for day 0. Make `created_by` optional/null in `createNotification`; the due-day template receives `projectIncomplete`.

- [ ] **Step 3: Verify and commit**

Run: `npx jest __tests__/app/api/cron/invoice-due-reminders/route.test.ts`

Expected: PASS

```bash
git add app/api/cron/invoice-due-reminders/route.ts lib/email/send.ts lib/email/templates/invoice-due.tsx utils/notifications.ts __tests__/app/api/cron/invoice-due-reminders/route.test.ts
git commit -m "fix: send internal invoice due reminders"
```

### Task 6: Add vendor reminders and penalty accrual

**Files:**

- Create: `app/api/cron/vendor-deadline-reminders/route.ts`
- Create: `lib/email/templates/vendor-overdue.tsx`
- Test: `__tests__/app/api/cron/vendor-deadline-reminders/route.test.ts`

**Interfaces:** consumes confirmed, unfinished POs and reminder settings; sends vendor notices and upserts current penalty data.

- [ ] **Step 1: Write failing eligibility/repeat tests**

```ts
it("warns the primary vendor contact seven days before due", async () => {
  await POST(cronRequest());
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
    to: ["vendor@vendor.test"], meta: expect.objectContaining({ milestone: "before:7" }),
  }));
});
it("skips a PO with an approved 100% completion certificate", async () => {
  await POST(cronRequest());
  expect(sendEmail).not.toHaveBeenCalled();
});
it("does not overwrite a manual override", async () => {
  await POST(cronRequest());
  expect(penaltyUpsert).toHaveBeenCalledWith(expect.not.objectContaining({ override_amount: expect.anything() }));
});
```

- [ ] **Step 2: Create the vendor email template**

```tsx
export function VendorOverdueEmail({ vendorContact, poNumber, dueDate, overdue, penaltyAmount }: {
  vendorContact?: string | null; poNumber: string; dueDate: string; overdue: boolean; penaltyAmount?: string;
}) {
  return <EmailLayout preview={overdue ? `PO ${poNumber} is overdue` : `PO ${poNumber} deadline reminder`}>
    <Text style={styles.heading}>{overdue ? `PO ${poNumber} is overdue` : `Reminder: PO ${poNumber} deadline is approaching`}</Text>
    <Text style={styles.paragraph}>Dear {vendorContact || "Vendor"},</Text>
    <Text style={styles.paragraph}>The deliverable due date is {dueDate}.</Text>
    {overdue && penaltyAmount && <Text style={styles.paragraph}>Recorded contractual penalty to date: ₱{penaltyAmount}.</Text>}
  </EmailLayout>;
}
```

- [ ] **Step 3: Implement route milestones and upsert**

```ts
const today = manilaDateString();
const warningDays = settings?.vendor_deadline_warning_days ?? [7, 5];
const daysUntilDue = Math.round((
  Date.parse(po.due_date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")
) / 86400000);
const overdueDays = Math.max(0, -daysUntilDue);
const shouldSend = warningDays.includes(daysUntilDue) ||
  (overdueDays > 0 && (overdueDays - 1) % (settings?.vendor_overdue_repeat_days ?? 7) === 0);
const milestone = overdueDays > 0 ? `overdue:${overdueDays}` : `before:${daysUntilDue}`;
```

Select non-deleted POs with `terms_configured_at`, a due date, and status in `issued`, `partially_paid`, `paid`, or `overpaid`; exclude cancelled POs and approved 100% certificates. Deduplicate successful `vendor_deadline_reminder` milestones. On overdue runs, calculate with `calculatePenaltyAmount` and upsert only `calculated_amount`, `first_overdue_on`, and `last_calculated_on` so override fields remain unchanged. Create an internal notification for every trigger.

- [ ] **Step 4: Verify and commit**

Run: `npx jest __tests__/app/api/cron/vendor-deadline-reminders/route.test.ts`

Expected: PASS

```bash
git add app/api/cron/vendor-deadline-reminders/route.ts lib/email/templates/vendor-overdue.tsx __tests__/app/api/cron/vendor-deadline-reminders/route.test.ts
git commit -m "feat: send vendor deadline reminders"
```

### Task 7: Expose independent reminder settings

**Files:**

- Modify: `app/dashboard/settings/page.tsx`
- Modify: `app/dashboard/settings/actions.ts`
- Modify: `components/dashboard/settings/settings-tabs.tsx`
- Test: `__tests__/app/dashboard/settings/reminder-settings.test.ts`

**Interfaces:** produces validated `email_settings` reminder values.

- [ ] **Step 1: Write a failing settings validation test**

```ts
it("rejects a non-positive invoice reminder lead time", async () => {
  const form = new FormData(); form.set("invoice_due_reminder_days", "0");
  await expect(updateReminderSettings(form)).resolves.toEqual({
    error: "Invoice reminder days must be a positive whole number.",
  });
});
```

- [ ] **Step 2: Extend read, parse, and upsert behavior**

```ts
const parsePositiveDays = (value: FormDataEntryValue | null) => Array.from(new Set(
  String(value ?? "").split(",").map((day) => Number(day.trim())).filter((day) => Number.isInteger(day) && day > 0),
)).sort((a, b) => b - a);
const invoice_due_reminder_days = Number(formData.get("invoice_due_reminder_days"));
const vendor_overdue_repeat_days = Number(formData.get("vendor_overdue_repeat_days"));
const vendor_deadline_warning_days = parsePositiveDays(formData.get("vendor_deadline_warning_days"));
if (!Number.isInteger(invoice_due_reminder_days) || invoice_due_reminder_days <= 0) {
  return { error: "Invoice reminder days must be a positive whole number." };
}
await supabase.from("email_settings").upsert({
  id: 1, invoice_due_reminder_days, vendor_deadline_warning_days, vendor_overdue_repeat_days,
  updated_at: new Date().toISOString(), updated_by: user.id,
});
```

Fetch/pass all three fields in the settings page. Add native controls to the existing Reminders tab: invoice lead days, comma-separated vendor warning days, and overdue repeat days. Preserve the document-expiry setting unchanged.

- [ ] **Step 3: Verify and commit**

Run: `npx jest __tests__/app/dashboard/settings/reminder-settings.test.ts`

Expected: PASS

```bash
git add app/dashboard/settings/page.tsx app/dashboard/settings/actions.ts components/dashboard/settings/settings-tabs.tsx __tests__/app/dashboard/settings/reminder-settings.test.ts
git commit -m "feat: configure payment reminder schedules"
```

### Task 8: Verify the integrated change

**Files:**

- Modify only when focused test, lint, or build output identifies a defect.

- [ ] **Step 1: Run focused coverage**

```bash
npx jest __tests__/lib/payment-terms.test.ts __tests__/supabase/payment-reminder-engine-migration.test.ts __tests__/app/dashboard/purchase-orders/payment-terms.test.ts __tests__/app/dashboard/invoices/payment-due-date.test.ts __tests__/app/api/cron/invoice-due-reminders/route.test.ts __tests__/app/api/cron/vendor-deadline-reminders/route.test.ts __tests__/app/dashboard/settings/reminder-settings.test.ts
```

Expected: PASS

- [ ] **Step 2: Run release checks**

```bash
npm run lint
npm run test
npm run build
supabase migration list --local
git diff --check
```

Expected: every command exits 0.

## Self-Review

- Issues #25, #26, and #27 are respectively covered by Tasks 2–3, 1/4–5/7, and 1–3/6–7.
- The plan has no unresolved business decisions: dates, recipients, rollout, formula, and override behavior are explicit.
- Every calculator and cron branch has focused test coverage before implementation.





