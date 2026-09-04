import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile, hasCapability } from "@/lib/auth/permissions";
import { defaultTc } from "@/lib/pdf/terms";
import { PoPdfPreview } from "@/components/dashboard/purchase-orders/po-pdf-preview";
import { PoTermsCard } from "@/components/dashboard/purchase-orders/po-terms-card";
import { PODetailsEditor } from "@/components/dashboard/purchase-orders/po-details-editor";
import { POLineItemsEditor } from "@/components/dashboard/purchase-orders/po-line-items-editor";
import { POSiteDetailsEditor } from "@/components/dashboard/purchase-orders/po-site-details-editor";
import { AddDownpayment } from "@/components/dashboard/purchase-orders/po-add-downpayment";
import { PoCcRecipients } from "@/components/dashboard/purchase-orders/po-cc-recipients";

const STEPS = ["CC Recipients", "PO Details", "Line Items", "T&C", "Payment Terms", "Sites & Details"];

export default function POEditorPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-full p-4 lg:p-6 animate-pulse bg-slate-50 dark:bg-[#0a0a0a] rounded-2xl" />}>
      <POEditorContent paramsPromise={props.params} searchParamsPromise={props.searchParams} />
    </Suspense>
  );
}

async function POEditorContent({
  paramsPromise,
  searchParamsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
  searchParamsPromise: Promise<{ step?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();

  const { user: currentUser, role: currentRole } = await getCurrentProfile(supabase);

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*, vendors(name), projects(name)")
    .eq("id", params.id)
    .single();

  const [{ data: lineItems }, { data: siteDetails }, { data: penalty }, { data: profile }] =
    await Promise.all([
      supabase.from("po_line_items").select("*").eq("po_id", po?.id ?? "").order("line_no"),
      supabase.from("po_site_details").select("*").eq("po_id", po?.id ?? "").order("sn"),
      supabase.from("po_penalties").select("calculated_amount, override_amount, override_reason").eq("po_id", po?.id ?? "").maybeSingle(),
      supabase.from("profiles").select("full_name, role").eq("id", po?.created_by ?? "").maybeSingle(),
    ]);

  // Gate: mirrors the detail-page rules — originator may fix draft/pending POs;
  // po.write holders may edit terms/T&C while a draft. Placeholder legacy POs
  // (issued, legacy, amount 0) stay editable so stubs can be completed.
  const isOriginator = !!currentUser && currentUser.id === po?.created_by;
  const isPlaceholderLegacy = po?.source === 'legacy' && Number(po?.amount ?? 0) === 0;
  const isLegacy = po?.source === 'legacy';
  const canEditLegacy = !!isLegacy && (isOriginator || hasCapability(currentRole, 'po.write'));
  const canEditLegacyPlaceholder = !!isPlaceholderLegacy && (isOriginator || hasCapability(currentRole, 'po.write'));
  const canEditDraft = (isOriginator && ["draft", "pending_approval"].includes(po?.status ?? "")) || canEditLegacy;
  const canEditTerms = hasCapability(currentRole, "po.write");
  const editable = canEditDraft || (canEditTerms && po?.status === "draft") || canEditLegacy;
  if (!po || !editable) redirect(`/dashboard/purchase-orders/${params.id}`);

  const currencySymbol = po.currency === "USD" ? "$" : "₱";
  const draftedBy = profile ? `${profile.full_name} (${profile.role})` : "Unknown";
  const approvedBy = po.approved_by_user_id ? "Approved" : "Not yet approved";
  const defaultTcValue = defaultTc();

  const rawStep = Number(searchParams.step);
  const step = Number.isInteger(rawStep) && rawStep >= 1 && rawStep <= STEPS.length ? rawStep : 1;
  const stepUrl = (n: number) => (n === 1 ? `/dashboard/purchase-orders/${po.id}/editor` : `/dashboard/purchase-orders/${po.id}/editor?step=${n}`);

  // ponytail: iframe remounts when this changes — after any save, the editor
  // calls router.refresh(), the page re-renders with fresh props, the key
  // changes, the PDF reloads. No onSaved plumbing in the sections.
  const refreshKey = JSON.stringify([
    po.updated_at,
    po.terms_configured_at,
    po.amount,
    po.dp_amount,
    po.terms_and_conditions,
    lineItems?.length ?? 0,
    siteDetails?.length ?? 0,
  ]);

  return (
    <div className="h-full p-4 lg:p-6">
      <div className="h-full grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0">
        {/* Editing pane (left) — one step at a time */}
        <div className="overflow-y-auto min-h-0 space-y-6 pb-8">
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/purchase-orders/${po.id}`}
              className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Edit {po.po_number}</h1>
              <p className="text-xs text-slate-500">
                Changes save per section — the PDF preview refreshes after each save.
              </p>
            </div>
          </div>

          {/* Step indicator */}
          <nav className="flex items-center gap-1.5 flex-wrap" aria-label="Edit steps">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step;
              return (
                <Link
                  key={label}
                  href={stepUrl(n)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? "bg-primary text-white border-primary"
                      : done
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{n}</span>}
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Current step */}
          {step === 1 && (
            <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50">
                <h2 className="font-semibold text-slate-900 dark:text-white">CC Recipients</h2>
              </div>
              <div className="p-6">
                <PoCcRecipients poId={po.id} initialEmails={(po.cc_emails as string[] | null) || []} />
              </div>
            </div>
          )}

          {step === 2 && (
            <PODetailsEditor
              poId={po.id}
              description={po.description}
              issuedDate={po.issued_date}
              dueDate={po.due_date}
              draftedBy={draftedBy}
              approvedBy={approvedBy}
              canEdit={canEditDraft}
            />
          )}

          {step === 3 && (
            <POLineItemsEditor
              poId={po.id}
              items={lineItems || []}
              currencySymbol={currencySymbol}
              canEdit={canEditDraft}
            />
          )}

          {step === 4 && (
            <PoTermsCard
              poId={po.id}
              status={po.status}
              terms={po}
              penalty={penalty}
              canEdit={canEditTerms && po.status === "draft"}
              canOverride={["finance", "admin", "superadmin"].includes(currentRole || "")}
              defaultTcValue={defaultTcValue}
              section="tc"
            />
          )}

          {step === 5 && (
            <div className="space-y-6">
              <PoTermsCard
                poId={po.id}
                status={po.status}
                terms={po}
                penalty={penalty}
                canEdit={canEditTerms && po.status === "draft"}
                canOverride={["finance", "admin", "superadmin"].includes(currentRole || "")}
                section="payment"
              />
              {(canEditDraft && Number(po.dp_amount || 0) === 0) || (isLegacy && canEditLegacy) ? (
                <AddDownpayment poId={po.id} poAmount={Number(po.amount)} currencySymbol={currencySymbol} initialAmount={Number(po.dp_amount || 0)} />
              ) : null}
            </div>
          )}

          {step === 6 && (
            <POSiteDetailsEditor poId={po.id} sites={siteDetails || []} canEdit={canEditDraft} />
          )}

          {/* Step nav */}
          <div className="flex items-center justify-between pt-2">
            {step > 1 ? (
              <Link href={stepUrl(step - 1)} className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                <ArrowLeft className="h-4 w-4" /> Previous
              </Link>
            ) : (
              <span />
            )}
            {step < STEPS.length ? (
              <Link href={stepUrl(step + 1)} className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95">
                Next: {STEPS[step]} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link href={`/dashboard/purchase-orders/${po.id}`} className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95">
                <Check className="h-4 w-4" /> Done
              </Link>
            )}
          </div>
        </div>

        {/* PDF preview (right, always visible) */}
        <div className="min-h-[60dvh] xl:min-h-0 xl:h-full">
          <PoPdfPreview poId={po.id} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
