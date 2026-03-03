import { Md5 } from "ts-md5";
import type { ICodeSession } from "./types";

export function md5(input: object | string): string {
  if (!input) input = "empty";
  const strInput = typeof input === "string" ? input : JSON.stringify(input);

  // Simple MD5 hash as a hex string (similar to what ts-md5 provides)
  return Md5.hashStr(strInput).toString();
}

/**
 * Computes a unique hash for a session.
 * @param session The session to hash
 * @returns The computed hash string
 */
export function computeSessionHash(session: ICodeSession): string {
  const { codeSpace, code, html, css, transpiled } = session;
  const hashObj = {
    codeSpace,
    code: md5(code),
    html: md5(html),
    css: md5(css),
    transpiled: md5(transpiled),
  };
  return md5(JSON.stringify(hashObj));
}
