import { headers } from "next/headers";
import { CSP_NONCE_HEADER } from "./csp-nonce";

export async function getNonce(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get(CSP_NONCE_HEADER);
}
