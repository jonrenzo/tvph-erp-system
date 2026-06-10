import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface DocRequestEmailProps {
  vendorName: string;
  vendorContact?: string | null;
  documentLabels: string[];
  portalUrl: string;
  senderName?: string | null;
  note?: string | null;
}

/**
 * Sent on-demand by staff to ask a vendor to submit/update a set of documents.
 * Renders a checklist and a magic-link to the upload portal.
 */
export function DocRequestEmail({
  vendorName,
  vendorContact,
  documentLabels,
  portalUrl,
  senderName,
  note,
}: DocRequestEmailProps) {
  return (
    <EmailLayout preview={`TVPH is requesting ${documentLabels.length} document(s)`}>
      <Text style={styles.heading}>Document submission request</Text>
      <Text style={styles.paragraph}>Dear {vendorContact || vendorName},</Text>
      <Text style={styles.paragraph}>
        To keep your accreditation with TVPH up to date, please submit the
        following document{documentLabels.length === 1 ? "" : "s"}:
      </Text>
      <Section style={styles.panel}>
        {documentLabels.map((label, i) => (
          <Text key={i} style={styles.listItem}>
            • {label}
          </Text>
        ))}
      </Section>
      {note ? <Text style={styles.paragraph}>{note}</Text> : null}
      <Section style={{ margin: "0 0 20px" }}>
        <Button href={portalUrl} style={styles.button}>
          Upload documents
        </Button>
      </Section>
      <Text style={styles.meta}>
        This secure upload link is valid for 7 days.
      </Text>
      <Text style={styles.paragraph}>
        Thank you,
        <br />
        {senderName || "TVPH Procurement"}
      </Text>
    </EmailLayout>
  );
}

export default DocRequestEmail;
