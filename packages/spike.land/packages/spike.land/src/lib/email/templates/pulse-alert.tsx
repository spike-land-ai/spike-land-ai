/**
 * Pulse Alert Email Template
 *
 * Sends notifications for social media metric anomalies.
 *
 * Resolves #648
 */

import type { SocialPlatform } from "@prisma/client";
import { Link, Section, Text } from "@react-email/components";
import { BaseEmail, emailStyles } from "./base";

interface PulseAlertEmailProps {
  workspaceName?: string;
  accountName: string;
  platform: SocialPlatform;
  metricType: string;
  currentValue: number;
  expectedValue: number;
  percentChange: number;
  severity: "warning" | "critical";
  direction: "spike" | "drop";
  dashboardUrl?: string;
  unsubscribeUrl?: string;
  timestamp?: Date;
}

/**
 * Format a number with appropriate suffixes
 */
function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * Format percent change with sign
 */
function formatPercentChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Get platform display name
 */
function getPlatformName(platform: SocialPlatform): string {
  const names: Record<SocialPlatform, string> = {
    LINKEDIN: "LinkedIn",
    INSTAGRAM: "Instagram",
    FACEBOOK: "Facebook",
    TWITTER: "Twitter/X",
    YOUTUBE: "YouTube",
    TIKTOK: "TikTok",
    DISCORD: "Discord",
    SNAPCHAT: "Snapchat",
    PINTEREST: "Pinterest",
  };
  return names[platform] || platform;
}

/**
 * Get metric type display name
 */
function getMetricName(metricType: string): string {
  const names: Record<string, string> = {
    followers: "Followers",
    following: "Following",
    postsCount: "Posts Count",
    engagementRate: "Engagement Rate",
    impressions: "Impressions",
    reach: "Reach",
  };
  return names[metricType] || metricType;
}

export function PulseAlertEmail({
  workspaceName,
  accountName,
  platform,
  metricType,
  currentValue,
  expectedValue,
  percentChange,
  severity,
  direction,
  dashboardUrl,
  unsubscribeUrl,
  timestamp,
}: PulseAlertEmailProps) {
  const isCritical = severity === "critical";
  const isSpike = direction === "spike";

  const alertStyle = isCritical
    ? {
      backgroundColor: "#fef2f2",
      border: "2px solid #dc2626",
      borderRadius: "8px",
      padding: "24px",
      margin: "24px 0",
    }
    : {
      backgroundColor: "#fffbeb",
      border: "2px solid #f59e0b",
      borderRadius: "8px",
      padding: "24px",
      margin: "24px 0",
    };

  const alertTitleStyle = {
    color: isCritical ? "#dc2626" : "#d97706",
    fontSize: "18px",
    fontWeight: "bold",
    margin: "0 0 12px 0",
  };

  const metricBoxStyle = {
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    padding: "20px",
    margin: "20px 0",
  };

  return (
    <BaseEmail
      preview={`${severity.charAt(0).toUpperCase() + severity.slice(1)} alert: ${
        getMetricName(metricType)
      } ${direction} detected for ${accountName}`}
      heading="Pulse AI Agent Alert"
      unsubscribeUrl={unsubscribeUrl}
    >
      <Section style={alertStyle}>
        <Text style={alertTitleStyle}>
          {isCritical ? "CRITICAL" : "WARNING"}: {getMetricName(metricType)}{" "}
          {isSpike ? "Spike" : "Drop"} Detected
        </Text>
        <Text style={{ ...emailStyles.text, margin: "0" }}>
          A significant change has been detected in your social media metrics that requires your
          attention.
        </Text>
      </Section>

      <Text style={emailStyles.text}>
        <strong>Account:</strong> {accountName} ({getPlatformName(platform)})
        {workspaceName && (
          <>
            <br />
            <strong>Workspace:</strong> {workspaceName}
          </>
        )}
      </Text>

      <Section style={metricBoxStyle}>
        <Text
          style={{
            ...emailStyles.text,
            fontWeight: "bold",
            margin: "0 0 12px 0",
          }}
        >
          {getMetricName(metricType)} Details
        </Text>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>
                Current Value:
              </td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                {formatNumber(currentValue)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>
                Expected Value:
              </td>
              <td style={{ padding: "8px 0", textAlign: "right" }}>
                {formatNumber(expectedValue)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>Change:</td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  color: isSpike ? "#16a34a" : "#dc2626",
                  fontWeight: "bold",
                }}
              >
                {formatPercentChange(percentChange)}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Text style={emailStyles.text}>
        {isSpike
          ? (
            <>
              This represents a <strong>significant increase</strong>{" "}
              compared to your 7-day average. This could indicate viral content, successful
              campaigns, or organic growth spurts.
            </>
          )
          : (
            <>
              This represents a <strong>significant decrease</strong>{" "}
              compared to your 7-day average. This may warrant investigation to understand the cause
              and take appropriate action.
            </>
          )}
      </Text>

      {dashboardUrl && (
        <Section style={{ textAlign: "center", margin: "32px 0" }}>
          <Link href={dashboardUrl} style={emailStyles.button}>
            View Dashboard
          </Link>
        </Section>
      )}

      <Text style={emailStyles.text}>
        The Pulse AI Agent continuously monitors your social media accounts to detect significant
        changes and keep you informed. You can adjust your notification preferences in your
        workspace settings.
      </Text>

      <Text style={{ ...emailStyles.text, color: "#6b7280", fontSize: "14px" }}>
        This alert was generated by the Pulse AI Agent for Orbit.
        <br />
        Detected at: {(timestamp || new Date()).toISOString()}
      </Text>
    </BaseEmail>
  );
}
