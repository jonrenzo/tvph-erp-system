// Client-safe RBAC definitions (no server-only imports). Shared by server
// helpers in permissions.ts and by client components (sidebar, rbac-view, etc.).

export const ROLES = [
  "superadmin", // devs — full god access
  "admin", // director — runs the business
  "finance", // invoices, payments, accounting, client billing
  "operations", // vendors, POs, projects, CRM, contracts, assets
  "viewer", // read-only
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  finance: "Finance",
  operations: "Operations",
  viewer: "Viewer",
};

export type Capability =
  | "audit.read"
  | "contract.write"
  | "crm.write"
  | "document.approve"
  | "document.write"
  | "email.send"
  | "export.crm"
  | "export.financial"
  | "export.project"
  | "export.vendor"
  | "invoice.pay"
  | "invoice.write"
  | "po.create"
  | "po.delete"
  | "po.status"
  | "po.write"
  | "project.write"
  | "settings.manage"
  | "user.manage"
  | "vendor.delete"
  | "vendor.status"
  | "vendor.write"
  | "hr.read"
  | "hr.write"
  | "accounting.read"
  | "accounting.write"
  | "asset.read"
  | "asset.write"
  | "po.approve"
  | "po.waive_requirements"
  | "po.approve_waiver"
  | "po.approve_completion"
  | "client_po.write"
  | "client_invoice.write"
  | "client_invoice.pay"
  | "payment_reservation.notify"
  | "payment_reservation.acknowledge"
  | "payment_request.create"
  | "payment_request.approve"
  | "invoice.override";

// superadmin is granted on every capability. admin gets everything EXCEPT the
// three superadmin-only items (audit.read, vendor.delete, po.delete).
export const CAPABILITY_ROLES = {
  "audit.read": ["superadmin"],
  "contract.write": ["superadmin", "admin", "operations"],
  "crm.write": ["superadmin", "admin", "operations"],
  "document.approve": ["superadmin", "admin", "operations"],
  "document.write": ["superadmin", "admin"],
  "email.send": ["superadmin", "admin", "operations"],
  "export.crm": ["superadmin", "admin", "operations"],
  "export.financial": ["superadmin", "admin", "finance"],
  "export.project": ["superadmin", "admin", "operations"],
  "export.vendor": ["superadmin", "admin", "operations", "finance"],
  "invoice.pay": ["superadmin", "admin", "finance"],
  "invoice.write": ["superadmin", "admin", "finance"],
  "po.create": ["superadmin", "admin", "operations"],
  "po.delete": ["superadmin"],
  "po.status": ["superadmin", "admin", "operations", "finance"],
  "po.write": ["superadmin", "admin", "operations"],
  "project.write": ["superadmin", "admin", "operations"],
  "settings.manage": ["superadmin", "admin"],
  "user.manage": ["superadmin", "admin"],
  "vendor.delete": ["superadmin"],
  "vendor.status": ["superadmin", "admin", "operations"],
  "vendor.write": ["superadmin", "admin", "operations"],
  "hr.read": ["superadmin", "admin", "finance", "operations", "viewer"],
  "hr.write": ["superadmin", "admin"],
  "accounting.read": ["superadmin", "admin", "finance"],
  "accounting.write": ["superadmin", "admin", "finance"],
  "asset.read": ["superadmin", "admin", "finance", "operations", "viewer"],
  "asset.write": ["superadmin", "admin", "operations"],
  "po.approve": ["superadmin", "admin"],
  "po.waive_requirements": ["superadmin", "admin", "operations"],
  "po.approve_waiver": ["superadmin", "admin"],
  "po.approve_completion": ["superadmin", "admin"],
  "client_po.write": ["superadmin", "admin", "operations"],
  "client_invoice.write": ["superadmin", "admin", "finance"],
  "client_invoice.pay": ["superadmin", "admin", "finance"],
  "payment_reservation.notify": ["superadmin", "admin", "operations"],
  "payment_reservation.acknowledge": ["superadmin", "admin", "finance"],
  "payment_request.create": ["superadmin", "admin", "operations"],
  "payment_request.approve": ["superadmin", "admin", "finance"],
  "invoice.override": ["superadmin", "admin", "finance"],
} as const satisfies Record<Capability, readonly Role[]>;

export function hasCapability(role: string | null | undefined, capability: Capability) {
  return Boolean(role && (CAPABILITY_ROLES[capability] as readonly string[]).includes(role));
}

/** True for the dev god-role only. */
export function isSuperadmin(role: string | null | undefined) {
  return role === "superadmin";
}

/** True for superadmin (dev) or admin (director) — i.e. admin-or-above. */
export function isAdminOrAbove(role: string | null | undefined) {
  return role === "superadmin" || role === "admin";
}
