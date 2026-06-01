"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const CUSTOMER_FIELDS = [
  { field: "company_name", description: "The name of the company or customer" },
  { field: "registered_address", description: "The official registered address of the customer" },
  { field: "tin", description: "Tax Identification Number (TIN) or Tax ID" },
  { field: "status", description: "The status of the customer (e.g. Active, Lead, Inactive)" },
  { field: "primary_site_location", description: "Primary physical location or site of the company" },
  { field: "industry_note", description: "Description or note of the industry they belong to" },
  { field: "notes", description: "General notes or comments about the customer" },
  { field: "full_name", description: "The full name of the primary contact person" },
  { field: "job_title", description: "The job title or position of the primary contact person" },
  { field: "email", description: "The email address of the primary contact person" },
  { field: "phone", description: "The phone or mobile number of the primary contact person" },
  { field: "fax", description: "The fax number of the primary contact person" },
];

const VENDOR_FIELDS = [
  { field: "name", description: "The name of the vendor company" },
  { field: "address", description: "The address of the vendor" },
  { field: "tin", description: "Tax Identification Number (TIN) or Tax ID of the vendor" },
  { field: "contact_person", description: "The primary contact person's name at the vendor" },
  { field: "contact_email", description: "The email address of the vendor or contact person" },
  { field: "contact_phone", description: "The phone number of the vendor or contact person" },
  { field: "contact_fax", description: "The fax number of the vendor" },
  { field: "bank_name", description: "The bank name for vendor payments" },
  { field: "bank_account_number", description: "The bank account number for vendor payments" },
  { field: "bank_account_name", description: "The name on the vendor's bank account" },
  { field: "payment_terms", description: "Payment terms (e.g. Net 30, COD, Immediate)" },
  { field: "currency", description: "The currency used for transactions (e.g. PHP, USD, EUR)" },
  { field: "notes", description: "General notes or comments about the vendor" },
  { field: "status", description: "The status of the vendor (e.g. Active, Inactive)" },
];

export async function suggestColumnMapping(
  unmappedHeaders: string[],
  importType: "Customers" | "Vendors"
) {
  if (!unmappedHeaders || unmappedHeaders.length === 0) {
    return { mappings: {} };
  }

  const fields = importType === "Customers" ? CUSTOMER_FIELDS : VENDOR_FIELDS;
  
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_GENERATIVE_AI_API_KEY is not defined.");
    return { mappings: {}, error: "AI service not configured on server" };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: "You are a high-speed schema-mapping engine. Map user headers to target database fields. Return JSON only with key 'mappings'. Do not include extra text. Only map if confident; otherwise omit the key.",
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `Type: ${importType}\nFields:\n${JSON.stringify(fields)}\nHeaders to map:\n${JSON.stringify(unmappedHeaders)}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    return { mappings: parsed.mappings || {} };
  } catch (error: any) {
    console.error("Gemini mapping error:", error);
    return { mappings: {}, error: error.message || "Failed to process mapping with AI" };
  }
}
