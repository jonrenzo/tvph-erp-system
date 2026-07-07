import * as React from "react";
import { Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface PoIssuedEmailProps {
  vendorName: string;
  vendorContact?: string | null;
  poNumber: string;
  poDate?: string | null;
  amountLabel?: string | null;
  senderName?: string | null;
  issuerName?: string | null;
  issuerEmail?: string | null;
  issuerPhone?: string | null;
}

export interface IssuerContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export function formatIssuerQuestionLine({ name, email, phone }: IssuerContact) {
  const cleanName = name?.trim();
  const cleanEmail = email?.trim();
  const cleanPhone = phone?.trim();

  if (cleanName && cleanEmail && cleanPhone) {
    return `Questions? Contact ${cleanName} at ${cleanEmail} / ${cleanPhone}.`;
  }
  if (cleanName && cleanEmail) {
    return `Questions? Contact ${cleanName} at ${cleanEmail}.`;
  }
  if (cleanName && cleanPhone) {
    return `Questions? Contact ${cleanName} at ${cleanPhone}.`;
  }
  if (cleanEmail) {
    return `Questions? Contact the person who issued this PO at ${cleanEmail}.`;
  }
  if (cleanPhone) {
    return `Questions? Contact the person who issued this PO at ${cleanPhone}.`;
  }
  if (cleanName) {
    return `Questions? Contact ${cleanName}.`;
  }

  return "Questions? Contact TVPH Procurement.";
}

/**
 * Sent automatically to the vendor's contact when a PO is issued.
 * The PO PDF is attached at the transport layer (see lib/email/send.ts callers).
 */
export function PoIssuedEmail({
  vendorName,
  vendorContact,
  poNumber,
  poDate,
  amountLabel,
  senderName,
  issuerName,
  issuerEmail,
  issuerPhone,
}: PoIssuedEmailProps) {
  return (
    <EmailLayout
      preview={`Purchase Order ${poNumber} from TVPH`}
      footerQuestionText={formatIssuerQuestionLine({
        name: issuerName,
        email: issuerEmail,
        phone: issuerPhone,
      })}
    >
      <Text style={styles.heading}>Purchase Order {poNumber}</Text>
      <Text style={styles.paragraph}>
        Dear {vendorContact || vendorName},
      </Text>
      <Text style={styles.paragraph}>
        Please find attached Purchase Order <strong>{poNumber}</strong> issued by
        TVPH. Kindly review the details and confirm receipt at your earliest
        convenience.
      </Text>
      <Section style={styles.panel}>
        <Text style={styles.meta}>PO Number: {poNumber}</Text>
        {poDate ? <Text style={styles.meta}>Date Issued: {poDate}</Text> : null}
        {amountLabel ? (
          <Text style={styles.meta}>Total Amount: {amountLabel}</Text>
        ) : null}
      </Section>
      <Text style={styles.paragraph}>
        The full purchase order is attached as a PDF.
      </Text>
      <Text style={styles.paragraph}>
        Best regards,
        <br />
        {senderName || "TVPH Procurement"}
      </Text>
    </EmailLayout>
  );
}

export default PoIssuedEmail;
