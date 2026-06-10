import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface DocExpiryEmailProps {
  vendorName: string;
  vendorContact?: string | null;
  documentLabel: string;
  expiryDate: string;
  daysUntilExpiry: number;
  portalUrl: string;
}

/**
 * Sent to a vendor when one of their accreditation documents is approaching
 * (or has reached) its expiry date. Includes a magic-link to the upload portal.
 */
export function DocExpiryEmail({
  vendorName,
  vendorContact,
  documentLabel,
  expiryDate,
  daysUntilExpiry,
  portalUrl,
}: DocExpiryEmailProps) {
  const expiredAlready = daysUntilExpiry <= 0;
  const headline = expiredAlready
    ? `Action needed: your ${documentLabel} has expired`
    : `Reminder: your ${documentLabel} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;

  return (
    <EmailLayout preview={headline}>
      <Text style={styles.heading}>{headline}</Text>
      <Text style={styles.paragraph}>Dear {vendorContact || vendorName},</Text>
      <Text style={styles.paragraph}>
        {expiredAlready
          ? `Our records show that your ${documentLabel} expired on ${expiryDate}. To remain compliant and eligible for new purchase orders, please submit an updated copy as soon as possible.`
          : `This is a friendly reminder that your ${documentLabel} on file with TVPH will expire on ${expiryDate}. Please submit a renewed copy before then to keep your accreditation active.`}
      </Text>
      <Section style={{ margin: "0 0 20px" }}>
        <Button href={portalUrl} style={styles.button}>
          Upload updated document
        </Button>
      </Section>
      <Text style={styles.meta}>
        This secure upload link is valid for 7 days. If it expires, please
        contact your TVPH procurement representative for a new one.
      </Text>
    </EmailLayout>
  );
}

export default DocExpiryEmail;
