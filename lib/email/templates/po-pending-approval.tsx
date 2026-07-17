import * as React from "react";
import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface PoPendingApprovalEmailProps {
  poNumber: string;
  vendorName: string;
  amountLabel?: string | null;
  submittedByName?: string | null;
  reviewUrl: string;
}

/**
 * Sent to the admins/superadmins the creator selected when a PO is submitted
 * for approval. Contains a summary + a link to the PO detail page where the
 * approver can Approve/Reject. No PDF attachment — the action lives in-app.
 */
export function PoPendingApprovalEmail({
  poNumber,
  vendorName,
  amountLabel,
  submittedByName,
  reviewUrl,
}: PoPendingApprovalEmailProps) {
  return (
    <EmailLayout
      preview={`PO ${poNumber} is pending your approval`}
      footerQuestionText="Questions? Just reply to this email and our team will help."
    >
      <Text style={styles.heading}>Purchase Order {poNumber} needs your approval</Text>
      <Text style={styles.paragraph}>
        A purchase order has been submitted for approval and requires an admin to
        review it before it can be issued to the vendor. You were selected as an
        approver.
      </Text>
      <Section style={styles.panel}>
        <Text style={styles.meta}>PO Number: {poNumber}</Text>
        <Text style={styles.meta}>Vendor: {vendorName}</Text>
        {amountLabel ? <Text style={styles.meta}>Total Amount: {amountLabel}</Text> : null}
        {submittedByName ? (
          <Text style={styles.meta}>Submitted by: {submittedByName}</Text>
        ) : null}
      </Section>
      <Section style={{ margin: "8px 0 16px" }}>
        <Link href={reviewUrl} style={styles.button}>
          Review &amp; approve
        </Link>
      </Section>
      <Text style={styles.paragraph}>
        Open the purchase order to approve and issue it, or reject it back to the
        drafter with a reason.
      </Text>
    </EmailLayout>
  );
}

export default PoPendingApprovalEmail;
