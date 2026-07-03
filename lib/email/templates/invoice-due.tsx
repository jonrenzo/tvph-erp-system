import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface InvoiceDueEmailProps {
  vendorName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  daysUntilDue: number;
  invoiceUrl: string;
}

export function InvoiceDueEmail({
  vendorName,
  invoiceNumber,
  amount,
  dueDate,
  daysUntilDue,
  invoiceUrl,
}: InvoiceDueEmailProps) {
  const overdue = daysUntilDue <= 0;
  const headline = overdue
    ? `Invoice #${invoiceNumber} is overdue`
    : `Reminder: Invoice #${invoiceNumber} is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;

  return (
    <EmailLayout preview={headline}>
      <Text style={styles.heading}>{headline}</Text>
      <Text style={styles.paragraph}>Dear Team,</Text>
      <Text style={styles.paragraph}>
        {overdue
          ? `The following invoice from ${vendorName} was due on ${dueDate} and is now overdue. Please arrange payment at your earliest convenience.`
          : `This is a friendly reminder that the following invoice from ${vendorName} is due on ${dueDate}.`}
      </Text>
      <Section style={styles.panel}>
        <Text style={{ ...styles.paragraph, margin: "0 0 4px" }}>
          <strong>Vendor:</strong> {vendorName}
        </Text>
        <Text style={{ ...styles.paragraph, margin: "0 0 4px" }}>
          <strong>Invoice:</strong> #{invoiceNumber}
        </Text>
        <Text style={{ ...styles.paragraph, margin: "0 0 4px" }}>
          <strong>Amount:</strong> ₱{amount}
        </Text>
        <Text style={{ ...styles.paragraph, margin: 0 }}>
          <strong>Due Date:</strong> {dueDate}
        </Text>
      </Section>
      <Section style={{ margin: "0 0 20px" }}>
        <Button href={invoiceUrl} style={styles.button}>
          View Invoice
        </Button>
      </Section>
      <Text style={styles.meta}>
        This is an automated reminder from TVPH. No action is needed on your part
        if payment has already been processed.
      </Text>
    </EmailLayout>
  );
}

export default InvoiceDueEmail;
