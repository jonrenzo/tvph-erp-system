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
}: PoIssuedEmailProps) {
  return (
    <EmailLayout preview={`Purchase Order ${poNumber} from TVPH`}>
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
