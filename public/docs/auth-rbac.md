# Auth and RBAC

## Authentication

Supabase Auth handles sign-in. The app supports email/password login and Microsoft/Azure OAuth callback handling when configured in Supabase.

New Microsoft SSO users default to `viewer`. If Telegram is configured, admins receive a role-assignment notification.

## Roles

Roles are defined in `lib/auth/roles.ts`.

| Role | Intended use |
| --- | --- |
| `superadmin` | Developer/root role with every capability, including destructive controls. |
| `admin` | Business admin/director role with broad management access. |
| `finance` | Invoices, payments, accounting, client billing. |
| `operations` | Vendors, POs, projects, CRM, contracts, assets. |
| `viewer` | Read-focused access. |
| `cto` | Executive approval role for PO thresholds. |
| `ceo` | Executive approval role for PO thresholds. |

## Capability enforcement

Capabilities are mapped in `CAPABILITY_ROLES`. Protected server code should call `requireCapability()` from `lib/auth/permissions.ts`.

Common capability groups:

- Audit: `audit.read`
- Vendors: `vendor.write`, `vendor.status`, `vendor.delete`
- Documents: `document.write`, `document.approve`
- Purchase requests: `pr.create`, `pr.status`, `pr.approve`, `pr.approve_finance`, `pr.delete`
- Purchase orders: `po.create`, `po.write`, `po.status`, `po.approve`, `po.approve_finance`, `po.approve_exec`, `po.delete`
- Invoices and payments: `invoice.write`, `invoice.pay`, `invoice.override`
- Client billing: `client_po.write`, `client_invoice.write`, `client_invoice.pay`
- Payment requests: `payment_request.create`, `payment_request.approve`
- Settings/users: `settings.manage`, `user.manage`

## Developer rule

Never treat hidden UI as permission. Server Actions and Route Handlers must check capabilities before changing data or returning privileged information.

