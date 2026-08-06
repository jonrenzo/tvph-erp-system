import * as React from "react";
import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface PoPendingFinanceEmailProps {
  poNumber: string;
  vendorName: string;
  amountLabel?: string | null;
  downpaymentLabel?: string | null;
  submittedByName?: string | null;
  reviewUrl: string;
}

/**
 * Sent to the finance pool when a PO passes the admin stage and is pending the
 * finance budget check. Once approved, the PO is issued to the vendor. The
 * action lives in-app.
 */
export function PoPendingFinanceEmail({
  poNumber,
  vendorName,
  amountLabel,
  downpaymentLabel,
  submittedByName,
  reviewUrl,
}: PoPendingFinanceEmailProps) {
  return (
    <EmailLayout
      preview={`PO ${poNumber} is pending the finance review`}
      footerQuestionText="Questions? Just reply to this email and our team will help."
    >
      <Text style={styles.heading}>Purchase Order {poNumber} needs the finance review</Text>
      <Text style={styles.paragraph}>
        A purchase order has been approved by the admin and now requires the
        finance budget check before it can be issued to the vendor.
      </Text>
      <Section style={styles.panel}>
        <Text style={styles.meta}>PO Number: {poNumber}</Text>
        <Text style={styles.meta}>Vendor: {vendorName}</Text>
        {amountLabel ? <Text style={styles.meta}>Total Amount: {amountLabel}</Text> : null}
        {downpaymentLabel ? (
          <Text style={styles.meta}>Downpayment: {downpaymentLabel}</Text>
        ) : null}
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
        Open the purchase order to approve and issue it to the vendor, or reject
        it back to the drafter with a reason.
      </Text>
    </EmailLayout>
  );
}

export default PoPendingFinanceEmail;
