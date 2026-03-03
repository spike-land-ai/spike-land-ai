/**
 * Crisis Alert Email Template
 *
 * Sends notifications for crisis detection events.
 *
 * Resolves #588: Create Crisis Detection System
 */

import type { CrisisSeverity } from "@prisma/client";
import { Link, Section, Text } from "@react-email/components";
import { BaseEmail, emailStyles } from "./base";

interface CrisisAlertEmailProps {
  recipientName?: string;
  severity: CrisisSeverity;
  title: string;
  message: string;
  triggerType: string;
  detectedAt: Date;
  affectedAccountCount: number;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

/**
 * Get severity-specific styles
 */
function getSeverityStyles(severity: CrisisSeverity): {
  emoji: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  switch (severity) {
    case "CRITICAL":
      return {
        emoji: "\u{1F6A8}",
        backgroundColor: "#fef2f2",
        borderColor: "#dc2626",
        textColor: "#991b1b",
      };
    case "HIGH":
      return {
        emoji: "\u{1F534}",
        backgroundColor: "#fef2f2",
        borderColor: "#ef4444",
        textColor: "#b91c1c",
      };
    case "MEDIUM":
      return {
        emoji: "\u{1F7E0}",
        backgroundColor: "#fffbeb",
        borderColor: "#f59e0b",
        textColor: "#b45309",
      };
    case "LOW":
    default:
      return {
        emoji: "\u{1F7E1}",
        backgroundColor: "#fefce8",
        borderColor: "#eab308",
        textColor: "#a16207",
      };
  }
}

/**
 * Format trigger type for display
 */
function formatTriggerType(triggerType: string): string {
  return triggerType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function CrisisAlertEmail({
  recipientName,
  severity,
  title,
  message,
  triggerType,
  detectedAt,
  affectedAccountCount,
  dashboardUrl,
  unsubscribeUrl,
}: CrisisAlertEmailProps) {
  const styles = getSeverityStyles(severity);

  const alertStyle = {
    backgroundColor: styles.backgroundColor,
    border: `2px solid ${styles.borderColor}`,
    borderRadius: "8px",
    padding: "24px",
    margin: "24px 0",
  };

  const alertTitleStyle = {
    color: styles.textColor,
    fontSize: "18px",
    fontWeight: "bold" as const,
    margin: "0 0 12px 0",
  };

  const detailsBoxStyle = {
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    padding: "20px",
    margin: "20px 0",
  };

  return (
    <BaseEmail
      preview={`${styles.emoji} ${severity} Crisis Alert: ${formatTriggerType(triggerType)}`}
      heading="Crisis Alert"
      unsubscribeUrl={unsubscribeUrl}
    >
      {recipientName && <Text style={emailStyles.text}>Hi {recipientName},</Text>}

      <Section style={alertStyle}>
        <Text style={alertTitleStyle}>
          {styles.emoji} {severity} SEVERITY: {title}
        </Text>
        <Text
          style={{ ...emailStyles.text, margin: "0", whiteSpace: "pre-line" }}
        >
          {message}
        </Text>
      </Section>

      <Section style={detailsBoxStyle}>
        <Text
          style={{
            ...emailStyles.text,
            fontWeight: "bold",
            margin: "0 0 12px 0",
          }}
        >
          Crisis Details
        </Text>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>
                Trigger Type:
              </td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                {formatTriggerType(triggerType)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>Severity:</td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  color: styles.textColor,
                  fontWeight: "bold",
                }}
              >
                {severity}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>
                Detected At:
              </td>
              <td style={{ padding: "8px 0", textAlign: "right" }}>
                {detectedAt.toLocaleString()}
              </td>
            </tr>
            {affectedAccountCount > 0 && (
              <tr>
                <td style={{ padding: "8px 0", color: "#6b7280" }}>
                  Affected Accounts:
                </td>
                <td style={{ padding: "8px 0", textAlign: "right" }}>
                  {affectedAccountCount}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Text style={emailStyles.text}>
        This crisis requires your immediate attention. Please review the situation and take
        appropriate action as soon as possible.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href={dashboardUrl} style={emailStyles.button}>
          View Crisis Dashboard
        </Link>
      </Section>

      <Text style={{ ...emailStyles.text, color: "#6b7280", fontSize: "14px" }}>
        This is an automated alert from the Orbit Crisis Detection System.
        <br />
        You are receiving this because you are an admin of the affected workspace.
      </Text>
    </BaseEmail>
  );
}
