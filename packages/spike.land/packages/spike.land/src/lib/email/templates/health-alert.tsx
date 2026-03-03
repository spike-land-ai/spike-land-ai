/**
 * Health Alert Email Template
 *
 * Sends notifications for account health issues.
 *
 * Resolves #586: Implement Account Health Monitor
 */

import type { AccountHealthStatus } from "@prisma/client";
import { Link, Section, Text } from "@react-email/components";

import { BaseEmail, emailStyles } from "./base";

interface HealthAlertEmailProps {
  recipientName?: string;
  accountName: string;
  platform: string;
  healthScore: number;
  status: AccountHealthStatus;
  issue: string;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

/**
 * Get status-specific styles
 */
function getStatusStyles(status: AccountHealthStatus): {
  emoji: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  switch (status) {
    case "CRITICAL":
      return {
        emoji: "\u{1F6A8}",
        backgroundColor: "#fef2f2",
        borderColor: "#dc2626",
        textColor: "#991b1b",
      };
    case "UNHEALTHY":
      return {
        emoji: "\u{26A0}\u{FE0F}",
        backgroundColor: "#fef2f2",
        borderColor: "#ef4444",
        textColor: "#b91c1c",
      };
    case "DEGRADED":
      return {
        emoji: "\u{1F7E1}",
        backgroundColor: "#fffbeb",
        borderColor: "#f59e0b",
        textColor: "#b45309",
      };
    case "HEALTHY":
    default:
      return {
        emoji: "\u{2705}",
        backgroundColor: "#ecfdf5",
        borderColor: "#10b981",
        textColor: "#047857",
      };
  }
}

/**
 * Get score color
 */
function getScoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  if (score >= 20) return "#ef4444";
  return "#dc2626";
}

export function HealthAlertEmail({
  recipientName,
  accountName,
  platform,
  healthScore,
  status,
  issue,
  dashboardUrl,
  unsubscribeUrl,
}: HealthAlertEmailProps) {
  const styles = getStatusStyles(status);

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
      preview={`${styles.emoji} Account Health Alert: ${accountName}`}
      heading="Account Health Alert"
      unsubscribeUrl={unsubscribeUrl}
    >
      {recipientName && <Text style={emailStyles.text}>Hi {recipientName},</Text>}

      <Section style={alertStyle}>
        <Text style={alertTitleStyle}>
          {styles.emoji} {issue}
        </Text>
        <Text style={{ ...emailStyles.text, margin: "0" }}>
          Your {platform} account <strong>{accountName}</strong> requires attention.
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
          Account Details
        </Text>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>Account:</td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                {accountName}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>Platform:</td>
              <td style={{ padding: "8px 0", textAlign: "right" }}>
                {platform}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>
                Health Score:
              </td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  color: getScoreColor(healthScore),
                  fontWeight: "bold",
                }}
              >
                {healthScore}/100
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>Status:</td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  color: styles.textColor,
                  fontWeight: "bold",
                }}
              >
                {status}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Text style={emailStyles.text}>
        Please review your account status and take appropriate action to resolve any issues.
      </Text>

      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Link href={dashboardUrl} style={emailStyles.button}>
          View Account Health
        </Link>
      </Section>

      <Text style={{ ...emailStyles.text, color: "#6b7280", fontSize: "14px" }}>
        This is an automated alert from the Orbit Account Health Monitor.
        <br />
        You are receiving this because you are an admin of the affected workspace.
      </Text>
    </BaseEmail>
  );
}
