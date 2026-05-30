const VENDOR_FIELDS: { key: string; label: string }[] = [
  { key: "address", label: "Address" },
  { key: "tin", label: "TIN" },
  { key: "contact_person", label: "Contact Person" },
  { key: "contact_email", label: "Contact Email" },
  { key: "contact_phone", label: "Contact Phone" },
  { key: "bank_name", label: "Bank Name" },
  { key: "payment_terms", label: "Payment Terms" },
];

export function isVendorProfileComplete(vendor: Record<string, any>): boolean {
  return VENDOR_FIELDS.every((f) => vendor[f.key]?.trim?.());
}

export function getVendorMissingFields(vendor: Record<string, any>): string[] {
  return VENDOR_FIELDS.filter((f) => !vendor[f.key]?.trim?.()).map((f) => f.label);
}

export function isCustomerProfileComplete(
  customer: Record<string, any>,
  contacts?: any[] | null,
): boolean {
  return getCustomerMissingFields(customer, contacts).length === 0;
}

export function getCustomerMissingFields(
  customer: Record<string, any>,
  contacts?: any[] | null,
): string[] {
  const missing: string[] = [];
  if (!customer.registered_address?.trim()) missing.push("Registered Address");
  if (!customer.tin?.trim()) missing.push("TIN");
  const hasValidContact =
    contacts?.some((c) => c.full_name?.trim() && (c.email?.trim() || c.phone?.trim()));
  if (!hasValidContact) missing.push("Contact (name + email/phone)");
  return missing;
}
