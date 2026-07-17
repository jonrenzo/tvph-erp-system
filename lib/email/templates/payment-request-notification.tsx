import * as React from "react";
import { Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface PaymentRequestNotificationProps {
  poNumber: string;
  vendorName: string;
  amount: string;
  dueInDays: number;
  notes: string | null;
  poLink: string;
  creatorName: string;
}

export function PaymentRequestNotificationEmail({
  poNumber,
  vendorName,
  amount,
  dueInDays,
  notes,
  poLink,
  creatorName,
}: PaymentRequestNotificationProps) {
  return (
    <EmailLayout
      preview={`Payment Request — ${vendorName} (PO ${poNumber})`}
    >
      <Text style={styles.heading}>Payment Request Created</Text>
      <Text style={styles.paragraph}>
        <strong>{creatorName}</strong> has created a payment request for{" "}
        <strong>{vendorName}</strong> under PO <strong>{poNumber}</strong>.
      </Text>
      <Section style={styles.panel}>
        <Text style={styles.meta}>Vendor: {vendorName}</Text>
        <Text style={styles.meta}>PO Number: {poNumber}</Text>
        <Text style={styles.meta}>Amount: ₱{amount}</Text>
        <Text style={styles.meta}>Due In: {dueInDays} days</Text>
        {notes ? <Text style={styles.meta}>Notes: {notes}</Text> : null}
      </Section>
      <Text style={styles.paragraph}>
        <a href={poLink} style={styles.button}>
          Review Payment Request
        </a>
      </Text>
      <Text style={styles.paragraph}>
        Please log in to the system to approve or review the payment request.
      </Text>
      <Text style={styles.paragraph}>
        Best regards,
        <br />
        TVPH System
      </Text>
    </EmailLayout>
  );
}

export default PaymentRequestNotificationEmail;
