import { Button, Section, Text } from "@react-email/components";
import { BaseEmail, emailStyles } from "./base";

interface GuardrailAlertEmailProps {
  alertType: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  workspaceName: string;
  campaignName?: string;
  metadata?: Record<string, unknown>;
  actionUrl: string;
}

export default function GuardrailAlertEmail({
  alertType = "BUDGET_FLOOR_HIT",
  severity = "WARNING",
  message = "Suggested budget is below floor",
  workspaceName = "My Workspace",
  campaignName = "Summer Campaign",
  metadata = {},
  actionUrl = "https://spike.land",
}: GuardrailAlertEmailProps) {
  const isCritical = severity === "CRITICAL";
  const color = isCritical
    ? "#dc2626"
    : severity === "WARNING"
    ? "#f59e0b"
    : "#3b82f6";

  return (
    <BaseEmail
      heading={`Autopilot Guardrail Alert: ${alertType.replace(/_/g, " ")}`}
      preview={`Guardrail Alert: ${message}`}
    >
      <Section style={emailStyles.alert}>
        <Text
          style={{ ...emailStyles.alertText, color: color, fontWeight: "bold" }}
        >
          Severity: {severity}
        </Text>
        <Text style={emailStyles.text}>
          {message}
        </Text>
      </Section>

      <Section>
        <Text style={emailStyles.text}>
          An autopilot recommendation for <strong>{workspaceName}</strong>
          {campaignName ? ` (Campaign: ${campaignName})` : ""} was blocked or flagged.
        </Text>

        {Object.keys(metadata).length > 0 && (
          <Section style={emailStyles.code}>
            <Text style={{ margin: 0 }}>
              {JSON.stringify(metadata, null, 2)}
            </Text>
          </Section>
        )}

        <Section style={{ marginTop: "24px", textAlign: "center" }}>
          <Button style={emailStyles.button} href={actionUrl}>
            View Alerts
          </Button>
        </Section>
      </Section>
    </BaseEmail>
  );
}
