"use server";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export async function extractDocumentMetadata(
  fileBufferBase64: string,
  mimeType: string,
  docType: string,
) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error("GOOGLE_GENERATIVE_AI_API_KEY is not defined.");
    return { error: "AI service not configured on server" };
  }

  let prompt = "";
  if (docType === "signed_nda") {
    prompt = `Extract the following details from this Signed NDA:
    {
      "company_name": "Name of the second party or partner signing the NDA",
      "signing_date": "Date of signature in YYYY-MM-DD format",
      "governing_law": "Governing jurisdiction listed (e.g. Philippines, Singapore)"
    }`;
  } else if (docType === "pcab_license") {
    prompt = `Extract the following details from this PCAB License:
    {
      "license_number": "The PCAB license number",
      "expiry_date": "The expiration or validity end date in YYYY-MM-DD format",
      "principal_classification": "Principal classification (e.g. General Building, General Engineering)",
      "category": "License category (e.g. AAA, AA, A, B, C, D)"
    }`;
  } else if (docType === "sec_registration") {
    prompt = `Extract the following details from this SEC Registration:
    {
      "company_name": "Official registered name",
      "registration_number": "SEC registration or certificate number",
      "registration_date": "Date of incorporation/registration in YYYY-MM-DD format"
    }`;
  } else if (docType === "audited_financial_statements") {
    prompt = `Extract the following details from this Audited Financial Statement:
    {
      "fiscal_year": "The year of the financial statements",
      "total_assets": "Total assets value (numeric)",
      "total_liabilities": "Total liabilities value (numeric)",
      "net_income": "Net income value (numeric)",
      "auditor_name": "Name of the auditing firm or CPA"
    }`;
  } else if (docType === "vendor_invoice") {
    prompt = `Extract the following details from this vendor invoice or receipt:
    {
      "invoice_number": "The invoice or receipt number",
      "amount": "The total amount due or payable (numeric only, no currency symbols or commas)",
      "invoice_date": "The invoice issue date in YYYY-MM-DD format",
      "due_date": "The payment due date in YYYY-MM-DD format, or null if not stated",
      "vendor_name": "The name of the vendor or issuing company",
      "vendor_tin": "The vendor's Tax Identification Number (TIN), or null if not found",
      "po_number": "A purchase order number referenced on the invoice, or null if absent"
    }`;
  } else {
    prompt = `Extract standard document details:
    {
      "company_name": "Name of the company or vendor",
      "document_number": "Invoice, permit, or certificate number if visible",
      "tin": "Tax Identification Number (TIN)",
      "expiry_date": "Any expiration, validity, or due date in YYYY-MM-DD format",
      "amount": "Any financial amount or total if applicable (numeric)"
    }`;
  }

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      system: "You are an advanced enterprise document OCR and data extraction engine. Extract metadata from the uploaded document. Return JSON ONLY matching the requested schema. If a field cannot be found, return null. Do not include markdown code block formatting in your response — return ONLY the raw JSON string.",
      messages: [{
        role: "user",
        content: [
          { type: "file", data: fileBufferBase64, mediaType: mimeType },
          { type: "text", text: prompt },
        ],
      }],
    });

    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanText);

    return { success: true, metadata: parsed };
  } catch (error: any) {
    console.error("Gemini OCR extraction error:", error);
    return { error: error.message || "Failed to parse document with Gemini AI" };
  }
}
