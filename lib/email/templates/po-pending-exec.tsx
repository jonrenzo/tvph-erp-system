import * as React from "react";
import { Link, Text } from "@react-email/components";
import { CenteredLayout, styles } from "./layout-centered";

export interface PoPendingExecEmailProps {
  poNumber: string;
  vendorName: string;
  amountLabel?: string | null;
  downpaymentLabel?: string | null;
  submittedByName?: string | null;
  approvedByName?: string | null;
  execRequiredLabel?: string | null;
  remainingLabel?: string | null;
  reviewUrl: string;
}

/**
 * Sent to CTO/CEO when a PO passes admin approval and needs executive review.
 * T2 (500_001-1M): CTO OR CEO (1-of-2). T3 (>=1_000_001): CTO AND CEO (2-of-2).
 */
export function PoPendingExecEmail({
  poNumber,
  vendorName,
  amountLabel,
  downpaymentLabel,
  submittedByName,
  approvedByName,
  execRequiredLabel,
  remainingLabel,
  reviewUrl,
}: PoPendingExecEmailProps) {
  return (
    <CenteredLayout preview={`PO ${poNumber} needs executive approval`}>
      <Text style={styles.heading}>Purchase Order {poNumber} needs executive approval</Text>
      <Text style={styles.paragraph}>
        This purchase order has passed the admin approval and now requires executive review
        from the CTO/CEO before the finance budget check. Please review it at your earliest convenience.
      </Text>
      <Text style={styles.meta}>
        PO Number: <span style={styles.metaValue}>{poNumber}</span>
      </Text>
      <Text style={styles.meta}>
        Vendor: <span style={styles.metaValue}>{vendorName}</span>
      </Text>
      {amountLabel ? (
        <Text style={styles.meta}>
          Total Amount: <span style={styles.metaValue}>{amountLabel}</span>
        </Text>
      ) : null}
      {execRequiredLabel ? (
        <Text style={styles.meta}>
          Executive requirement: <span style={styles.metaValue}>{execRequiredLabel}</span>
        </Text>
      ) : null}
      {remainingLabel ? (
        <Text style={styles.meta}>
          Awaiting: <span style={styles.metaValue}>{remainingLabel}</span>
        </Text>
      ) : null}
      {downpaymentLabel ? (
        <Text style={styles.meta}>
          Downpayment: <span style={styles.metaValue}>{downpaymentLabel}</span>
        </Text>
      ) : null}
      {submittedByName ? (
        <Text style={styles.meta}>
          Submitted by: <span style={styles.metaValue}>{submittedByName}</span>
        </Text>
      ) : null}
      {approvedByName ? (
        <Text style={styles.meta}>
          Admin approved by: <span style={styles.metaValue}>{approvedByName}</span>
        </Text>
      ) : null}
      <Link href={reviewUrl} style={styles.button}>
        Review &amp; approve
      </Link>
      <Text style={styles.finePrint}>
        Open the purchase order to approve as executive or reject it back to the drafter with a reason.
      </Text>
    </CenteredLayout>
  );
}

export default PoPendingExecEmail;
