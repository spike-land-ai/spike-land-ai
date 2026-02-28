import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DeviceVerificationContent } from "./device-verification-content";

interface DeviceAuthPageProps {
  searchParams: Promise<{ user_code?: string; }>;
}

export default async function DeviceAuthPage({
  searchParams,
}: DeviceAuthPageProps) {
  const session = await auth();

  const params = await searchParams;
  const userCode = params.user_code;

  if (!session) {
    const callbackUrl = userCode
      ? `/mcp/auth/device?user_code=${encodeURIComponent(userCode)}`
      : "/mcp/auth/device";
    redirect(`/?auth=required&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return <DeviceVerificationContent {...(userCode !== undefined ? { initialUserCode: userCode } : {})} />;
}
