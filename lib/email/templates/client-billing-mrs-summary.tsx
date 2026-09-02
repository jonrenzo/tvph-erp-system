import * as React from "react";
import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface ClientBillingMrsSummaryProps {
  invoiceNumber: string | null;
  invoiceBatch: string | null;
  clientName: string;
  amountLabel: string;
  billingUrl: string;
  nodes: { node_id: string; has_mrs: boolean }[];
}

export function ClientBillingMrsSummaryEmail({ invoiceNumber, invoiceBatch, clientName, amountLabel, billingUrl, nodes }: ClientBillingMrsSummaryProps) {
  const withMrs = nodes.filter(n => n.has_mrs).length;
  const withoutMrs = nodes.length - withMrs;
  return (
    <EmailLayout preview={`New billing for ${clientName} — ${withMrs}/${nodes.length} nodes have MRS`}>
      <Text style={styles.heading}>New Client Billing</Text>
      <Text style={styles.paragraph}>A new billing record has been created for <strong>{clientName}</strong>.</Text>
      <Section style={styles.panel}>
        {invoiceNumber ? <Text style={styles.meta}>Invoice: {invoiceNumber}</Text> : null}
        {invoiceBatch ? <Text style={styles.meta}>Batch: {invoiceBatch}</Text> : null}
        <Text style={styles.meta}>Amount: {amountLabel}</Text>
        <Text style={styles.meta}>Nodes: {nodes.length} — {withMrs} with MRS, {withoutMrs} without MRS</Text>
      </Section>
      <Section style={styles.panel}>
        <Text style={{ ...styles.meta, fontWeight: 700, marginBottom: 8 }}>MRS Breakdown</Text>
        {nodes.map((n, i) => (
          <Text key={i} style={{ ...styles.meta, color: n.has_mrs ? "#16a34a" : "#dc2626" }}>
            {n.node_id || `Node ${i + 1}`}: {n.has_mrs ? "Has MRS" : "No MRS"}
          </Text>
        ))}
      </Section>
      <Section style={{ margin: "8px 0 16px" }}>
        <Link href={billingUrl} style={styles.button}>View billing</Link>
      </Section>
    </EmailLayout>
  );
}

export default ClientBillingMrsSummaryEmail;
