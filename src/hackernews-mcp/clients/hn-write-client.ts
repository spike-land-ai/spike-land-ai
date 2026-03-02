/**
 * HN Write Client — Web scraping for login, submit, vote, comment.
 * All methods accept injected fetch + session cookie for testability.
 */

import type { FetchFn, HNErrorCode } from "../types.js";
import { HN_WEB_BASE } from "../types.js";
import type { SessionManager } from "../session/session-manager.js";

export type WriteResult =
  | { success: true }
  | { success: false; error: HNErrorCode; message: string };

export class HNWriteClient {
  private readonly fetchFn: FetchFn;
  private readonly session: SessionManager;

  constructor(session: SessionManager, fetchFn: FetchFn = globalThis.fetch) {
    this.fetchFn = fetchFn;
    this.session = session;
  }

  async login(username: string, password: string): Promise<WriteResult> {
    const body = new URLSearchParams({
      acct: username,
      pw: password,
      goto: "news",
    });

    const resp = await this.fetchFn(`${HN_WEB_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      redirect: "manual",
    });

    const setCookie = resp.headers.get("set-cookie");
    const html = await resp.text();

    // Successful login: redirect or cookie set
    if (setCookie && setCookie.includes("user=")) {
      this.session.login(username, setCookie);
      return { success: true };
    }

    // Check for redirect meta tag (success indicator)
    if (html.includes("URL=news")) {
      // Even without set-cookie header, some environments handle cookies differently
      this.session.login(username, `user=${username}`);
      return { success: true };
    }

    if (html.includes("Bad login")) {
      return {
        success: false,
        error: "AUTH_FAILED",
        message: "Invalid username or password",
      };
    }

    return { success: false, error: "AUTH_FAILED", message: "Login failed" };
  }

  async submitStory(title: string, url?: string, text?: string): Promise<WriteResult> {
    const authCheck = this.requireAuth();
    if (authCheck) return authCheck;

    // Step 1: GET /submit to extract fnid CSRF token
    const fnid = await this.extractFnid();
    if (!fnid.success) return fnid;

    // Step 2: POST /r with fnid + story data
    const body = new URLSearchParams({ fnid: fnid.token, title });
    if (url) body.set("url", url);
    if (text) body.set("text", text);

    const resp = await this.fetchFn(`${HN_WEB_BASE}/r`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: this.session.getCookie()!,
      },
      body: body.toString(),
      redirect: "manual",
    });

    const html = await resp.text();

    if (this.isRateLimited(html)) {
      return {
        success: false,
        error: "RATE_LIMITED",
        message: "Rate limited — wait before retrying",
      };
    }

    if (html.includes("URL=newest") || html.includes("URL=new") || resp.status === 302) {
      return { success: true };
    }

    // CSRF expired — retry once
    if (html.includes("Unknown") || html.includes("expired")) {
      const retryFnid = await this.extractFnid();
      if (!retryFnid.success) {
        return {
          success: false,
          error: "CSRF_EXPIRED",
          message: "CSRF token expired and retry failed",
        };
      }

      const retryBody = new URLSearchParams({ fnid: retryFnid.token, title });
      if (url) retryBody.set("url", url);
      if (text) retryBody.set("text", text);

      const retryResp = await this.fetchFn(`${HN_WEB_BASE}/r`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: this.session.getCookie()!,
        },
        body: retryBody.toString(),
        redirect: "manual",
      });

      const retryHtml = await retryResp.text();
      if (
        retryHtml.includes("URL=newest") ||
        retryHtml.includes("URL=new") ||
        retryResp.status === 302
      ) {
        return { success: true };
      }
      return {
        success: false,
        error: "SUBMIT_FAILED",
        message: "Submit failed after CSRF retry",
      };
    }

    return { success: false, error: "SUBMIT_FAILED", message: "Submit failed" };
  }

  async upvote(itemId: number): Promise<WriteResult> {
    const authCheck = this.requireAuth();
    if (authCheck) return authCheck;

    // Step 1: GET item page to extract vote auth token
    const resp = await this.fetchFn(`${HN_WEB_BASE}/item?id=${itemId}`, {
      headers: { Cookie: this.session.getCookie()! },
    });

    if (!resp.ok) {
      return {
        success: false,
        error: "NOT_FOUND",
        message: `Item ${itemId} not found`,
      };
    }

    const html = await resp.text();
    const voteMatch = html.match(/id="up_\d+"\s+href="([^"]+)"/);
    if (!voteMatch) {
      return {
        success: false,
        error: "VOTE_FAILED",
        message: "Could not find vote link — may have already voted",
      };
    }

    // Step 2: GET the vote URL
    const voteUrl = (voteMatch[1] as string).replace(/&amp;/g, "&");
    const voteResp = await this.fetchFn(`${HN_WEB_BASE}/${voteUrl}`, {
      headers: { Cookie: this.session.getCookie()! },
      redirect: "manual",
    });

    const voteHtml = await voteResp.text();

    if (this.isRateLimited(voteHtml)) {
      return {
        success: false,
        error: "RATE_LIMITED",
        message: "Rate limited — wait before retrying",
      };
    }

    // Success: redirect back to item or 302
    if (voteResp.status === 302 || voteHtml.includes("URL=") || voteResp.ok) {
      return { success: true };
    }

    return { success: false, error: "VOTE_FAILED", message: "Vote failed" };
  }

  async postComment(parentId: number, text: string): Promise<WriteResult> {
    const authCheck = this.requireAuth();
    if (authCheck) return authCheck;

    // Step 1: GET item page to extract hmac CSRF token
    const resp = await this.fetchFn(`${HN_WEB_BASE}/item?id=${parentId}`, {
      headers: { Cookie: this.session.getCookie()! },
    });

    if (!resp.ok) {
      return {
        success: false,
        error: "NOT_FOUND",
        message: `Item ${parentId} not found`,
      };
    }

    const html = await resp.text();
    const hmacMatch = html.match(/name="hmac"\s+value="([^"]+)"/);
    if (!hmacMatch) {
      return {
        success: false,
        error: "COMMENT_FAILED",
        message: "Could not find comment form CSRF token",
      };
    }

    // Step 2: POST /comment with hmac + text
    const body = new URLSearchParams({
      parent: String(parentId),
      text,
      hmac: hmacMatch[1] as string,
      goto: `item?id=${parentId}`,
    });

    const commentResp = await this.fetchFn(`${HN_WEB_BASE}/comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: this.session.getCookie()!,
      },
      body: body.toString(),
      redirect: "manual",
    });

    const commentHtml = await commentResp.text();

    if (this.isRateLimited(commentHtml)) {
      return {
        success: false,
        error: "RATE_LIMITED",
        message: "Rate limited — wait before retrying",
      };
    }

    if (
      commentResp.status === 302 ||
      commentHtml.includes("URL=") ||
      commentHtml.includes(`item?id=${parentId}`)
    ) {
      return { success: true };
    }

    // CSRF expired — retry once
    if (commentHtml.includes("Unknown") || commentHtml.includes("expired")) {
      const retryResp = await this.fetchFn(`${HN_WEB_BASE}/item?id=${parentId}`, {
        headers: { Cookie: this.session.getCookie()! },
      });
      const retryPageHtml = await retryResp.text();
      const retryHmac = retryPageHtml.match(/name="hmac"\s+value="([^"]+)"/);
      if (!retryHmac) {
        return {
          success: false,
          error: "CSRF_EXPIRED",
          message: "CSRF token expired and retry failed",
        };
      }

      const retryBody = new URLSearchParams({
        parent: String(parentId),
        text,
        hmac: retryHmac[1] as string,
        goto: `item?id=${parentId}`,
      });

      const retryCommentResp = await this.fetchFn(`${HN_WEB_BASE}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: this.session.getCookie()!,
        },
        body: retryBody.toString(),
        redirect: "manual",
      });

      const retryCommentHtml = await retryCommentResp.text();
      if (retryCommentResp.status === 302 || retryCommentHtml.includes("URL=")) {
        return { success: true };
      }
      return {
        success: false,
        error: "COMMENT_FAILED",
        message: "Comment failed after CSRF retry",
      };
    }

    return {
      success: false,
      error: "COMMENT_FAILED",
      message: "Comment failed",
    };
  }

  private requireAuth(): WriteResult | null {
    if (!this.session.isLoggedIn()) {
      return {
        success: false,
        error: "AUTH_REQUIRED",
        message: "Call hn_login first",
      };
    }
    return null;
  }

  private async extractFnid(): Promise<
    | { success: true; token: string }
    | {
        success: false;
        error: HNErrorCode;
        message: string;
      }
  > {
    const resp = await this.fetchFn(`${HN_WEB_BASE}/submit`, {
      headers: { Cookie: this.session.getCookie()! },
    });

    const html = await resp.text();
    const fnidMatch = html.match(/name="fnid"\s+value="([^"]+)"/);
    if (!fnidMatch) {
      return {
        success: false,
        error: "CSRF_EXPIRED",
        message: "Could not extract CSRF token from submit page",
      };
    }

    return { success: true, token: fnidMatch[1] as string };
  }

  private isRateLimited(html: string): boolean {
    return (
      html.includes("too fast") || html.includes("slow down") || html.includes("limit submissions")
    );
  }
}
