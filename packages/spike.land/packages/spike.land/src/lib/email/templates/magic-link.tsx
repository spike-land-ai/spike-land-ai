import { BaseEmail, emailStyles } from "./base";
import { Button, Section, Text } from "@react-email/components";

interface MagicLinkEmailProps {
  url: string;
  host: string;
}

export function MagicLinkEmail({ url, host }: MagicLinkEmailProps) {
  return (
    <BaseEmail
      preview={`Sign in to ${host}`}
      heading="Sign in to Spike Land"
    >
      <Text style={emailStyles.text}>
        Click the button below to sign in. This link expires in 10 minutes.
      </Text>
      <Section style={{ textAlign: "center", margin: "32px 0" }}>
        <Button style={emailStyles.button} href={url}>
          Sign in to Spike Land
        </Button>
      </Section>
      <Text style={{ ...emailStyles.text, fontSize: "14px", color: "#6b7280" }}>
        If the button doesn't work, copy and paste this URL into your browser:
      </Text>
      <Text
        style={{ ...emailStyles.text, fontSize: "12px", wordBreak: "break-all", color: "#6b7280" }}
      >
        {url}
      </Text>
      <Text style={{ ...emailStyles.text, fontSize: "12px", color: "#9ca3af", marginTop: "32px" }}>
        If you didn't request this email, you can safely ignore it.
      </Text>
    </BaseEmail>
  );
}

export default MagicLinkEmail;
