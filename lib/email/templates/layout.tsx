import * as React from "react";
import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// ---------------------------------------------------------------------------
// Brand + asset configuration
// All links/assets MUST be absolute and on the sending domain to avoid the
// SpamAssassin URI_PHISH penalty (link/domain mismatch). No placeholder
// (example.com) or relative URLs.
// ---------------------------------------------------------------------------
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";

// Display name shown in copy. Matches the EMAIL_FROM display name.
export const BRAND = "TVPH";

const LOGO_URL = `${BASE_URL}/logo.png`;

// Optional decorative hero image. Placeholder for now — replace with a hosted
// asset (or leave empty to render no hero). A broken image hurts deliverability,
// so this is only rendered when a non-empty URL is supplied.
export const HERO_IMAGE_URL = "";

// CAN-SPAM requires a real postal address in the footer. TODO: confirm address.
const COMPANY_ADDRESS = [
  "Unit 1811, North Tower, Park Triangle Corporate Plaza",
  "32nd Street cor. 11th Ave, BGC, Taguig City",
];

const COMPANY_BLURB =
  "This message was sent by TVPH regarding your account and active transactions with us.";

// ---------------------------------------------------------------------------
// theme.md design tokens
// ---------------------------------------------------------------------------
const COLORS = {
  primary: "#0a5c3b",
  primaryLight: "#0c6a43",
  page: "#f8fafc",
  card: "#ffffff",
  fg: "#0f172a",
  fg2: "#475569",
  fg3: "#94a3b8",
  border: "#e2e8f0",
  cardMuted: "#f1f5f9",
};

const HEADING_FONT =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const BODY_FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const main: React.CSSProperties = {
  backgroundColor: COLORS.page,
  fontFamily: BODY_FONT,
  margin: 0,
  padding: "24px 0",
};

const container: React.CSSProperties = {
  backgroundColor: COLORS.card,
  borderRadius: "14px",
  margin: "0 auto",
  maxWidth: "640px",
  overflow: "hidden",
  border: `1px solid ${COLORS.border}`,
};

const header: React.CSSProperties = {
  padding: "24px 32px 8px",
};

const content: React.CSSProperties = { padding: "20px 32px 32px" };

const footer: React.CSSProperties = { padding: "0 32px 28px" };

const footerText: React.CSSProperties = {
  color: COLORS.fg3,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 8px",
  fontFamily: BODY_FONT,
};

/**
 * Shared wrapper for all transactional emails, skinned with the TelcoVantage
 * design system (theme.md): logo header, optional hero slot, content card, and
 * a minimal transactional footer (no marketing/unsubscribe chrome).
 */
export function EmailLayout({
  preview,
  heroImageUrl = HERO_IMAGE_URL,
  footerQuestionText = "Questions? Just reply to this email and our team will help.",
  children,
}: {
  preview: string;
  heroImageUrl?: string;
  footerQuestionText?: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Plus Jakarta Sans"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU79TBg.woff2",
            format: "woff2",
          }}
          fontWeight={700}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={LOGO_URL} alt={BRAND} height="32" style={{ display: "block" }} />
          </Section>

          {heroImageUrl ? (
            <Section style={{ padding: "8px 32px 0" }}>
              <Img
                src={heroImageUrl}
                alt=""
                width={576}
                style={{ display: "block", width: "100%", maxWidth: "576px", borderRadius: "10px" }}
              />
            </Section>
          ) : null}

          <Section style={content}>{children}</Section>

          <Hr style={{ borderColor: COLORS.border, margin: "0 32px" }} />
          <Section style={footer}>
            <Text style={footerText}>{COMPANY_BLURB}</Text>
            <Text style={footerText}>
              {COMPANY_ADDRESS[0]}
              <br />
              {COMPANY_ADDRESS[1]}
            </Text>
            <Text style={{ ...footerText, margin: 0 }}>{footerQuestionText}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Shared inline styles for template bodies, aligned to theme.md.
export const styles = {
  heading: {
    color: COLORS.fg,
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: "30px",
    margin: "0 0 16px",
    fontFamily: HEADING_FONT,
  } as React.CSSProperties,
  paragraph: {
    color: COLORS.fg2,
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 16px",
    fontFamily: BODY_FONT,
  } as React.CSSProperties,
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 600,
    padding: "12px 22px",
    textDecoration: "none",
    fontFamily: BODY_FONT,
  } as React.CSSProperties,
  meta: {
    color: COLORS.fg3,
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0 0 4px",
    fontFamily: BODY_FONT,
  } as React.CSSProperties,
  listItem: {
    color: COLORS.fg2,
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 6px",
    fontFamily: BODY_FONT,
  } as React.CSSProperties,
  // Muted inset panel used for PO meta / checklists.
  panel: {
    backgroundColor: COLORS.cardMuted,
    borderRadius: "10px",
    padding: "16px 20px",
    margin: "0 0 16px",
  } as React.CSSProperties,
};
