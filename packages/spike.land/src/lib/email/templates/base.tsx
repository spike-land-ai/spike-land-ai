import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface BaseEmailProps {
  preview: string;
  heading: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
}

export function BaseEmail({ preview, heading, children, unsubscribeUrl }: BaseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={logo}>Spike Land</Heading>
            <Text style={tagline}>Pixel - AI Image Enhancement</Text>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>{heading}</Heading>
            {children}
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Spike Land. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href="https://spike.land" style={link}>
                Visit Website
              </Link>
              {" · "}
              <Link href="https://spike.land/privacy" style={link}>
                Privacy Policy
              </Link>
              {" · "}
              <Link href="https://spike.land/terms" style={link}>
                Terms of Service
              </Link>
            </Text>
            {unsubscribeUrl && (
              <Text style={footerText}>
                <Link href={unsubscribeUrl} style={link}>
                  Unsubscribe
                </Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header = {
  padding: "32px 24px",
  textAlign: "center" as const,
  borderBottom: "1px solid #e5e7eb",
};

const logo = {
  color: "#00E5FF", // Pixel Cyan
  fontSize: "32px",
  fontWeight: "bold",
  fontFamily: "'Montserrat', system-ui, sans-serif",
  margin: "0",
  padding: "0",
};

const tagline = {
  color: "#A0A0C0", // Text Muted
  fontSize: "14px",
  margin: "8px 0 0",
  padding: "0",
};

const content = {
  padding: "32px 24px",
};

const h1 = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0 0 24px",
  padding: "0",
};

const footer = {
  padding: "0 24px",
  textAlign: "center" as const,
  borderTop: "1px solid #e5e7eb",
  marginTop: "32px",
  paddingTop: "24px",
};

const footerText = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "24px",
  margin: "0",
};

const link = {
  color: "#00E5FF", // Pixel Cyan
  textDecoration: "underline",
};

// Export styles for use in other templates
export const emailStyles = {
  main,
  container,
  header,
  logo,
  tagline,
  content,
  h1,
  footer,
  footerText,
  link,
  // Common reusable styles
  text: {
    color: "#374151",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "16px 0",
  },
  button: {
    backgroundColor: "#00E5FF", // Pixel Cyan
    borderRadius: "8px",
    color: "#08081C", // Deep Space for contrast
    display: "inline-block",
    fontSize: "16px",
    fontWeight: "bold",
    padding: "12px 24px",
    textDecoration: "none",
    textAlign: "center" as const,
  },
  code: {
    backgroundColor: "#f3f4f6",
    borderRadius: "4px",
    color: "#1f2937",
    fontFamily: "monospace",
    fontSize: "14px",
    padding: "2px 6px",
  },
  divider: {
    borderBottom: "1px solid #e5e7eb",
    margin: "24px 0",
  },
  alert: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "16px",
    margin: "16px 0",
  },
  alertText: {
    color: "#991b1b",
    fontSize: "14px",
    margin: "0",
  },
  success: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "8px",
    padding: "16px",
    margin: "16px 0",
  },
  successText: {
    color: "#166534",
    fontSize: "14px",
    margin: "0",
  },
};
