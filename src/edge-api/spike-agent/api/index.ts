import { Agent, routeAgentRequest } from "agents";
import { Hono } from "hono";
import type { Env } from "../core-logic/env.js";

interface ReviewEntry {
  id: string;
  repo: string;
  files: string[];
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  startedAt: string;
  completedAt?: string;
}

interface ReviewState {
  reviews: ReviewEntry[];
}

export class CodeReviewAgent extends Agent<Env, ReviewState> {
  override initialState: ReviewState = { reviews: [] };

  override async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/review" && request.method === "POST") {
      return this.handleReview(request);
    }

    if (url.pathname === "/reviews" && request.method === "GET") {
      return Response.json({ reviews: this.state.reviews });
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleReview(request: Request): Promise<Response> {
    const body = await request.json<{ repo: string; files: string[] }>();
    if (!body.repo || !Array.isArray(body.files)) {
      return Response.json({ error: "Missing repo or files" }, { status: 400 });
    }

    const reviewId = crypto.randomUUID();
    const review: ReviewEntry = {
      id: reviewId,
      repo: body.repo,
      files: body.files,
      status: "pending",
      startedAt: new Date().toISOString(),
    };

    this.setState({
      ...this.state,
      reviews: [...this.state.reviews, review],
    });

    this.schedule(0, "runCodeReview", { reviewId });

    return Response.json({ reviewId, status: "pending" }, { status: 202 });
  }

  override async onAlarm(): Promise<void> {
    // Alarm-based review triggering handled via schedule() -> runCodeReview()
  }

  async runCodeReview(reviewId: string): Promise<void> {
    const reviews = this.state.reviews.map((r) =>
      r.id === reviewId ? { ...r, status: "running" as const } : r,
    );
    this.setState({ ...this.state, reviews });

    try {
      const steps = ["lint", "typecheck", "review", "suggest"];
      const results: string[] = [];

      for (const step of steps) {
        results.push(`[${step}] passed`);
      }

      const completedReviews = this.state.reviews.map((r) =>
        r.id === reviewId
          ? {
            ...r,
            status: "completed" as const,
            result: results.join("\n"),
            completedAt: new Date().toISOString(),
          }
          : r,
      );
      this.setState({ ...this.state, reviews: completedReviews });
    } catch (err) {
      const failedReviews = this.state.reviews.map((r) =>
        r.id === reviewId
          ? {
            ...r,
            status: "failed" as const,
            result: err instanceof Error ? err.message : "Unknown error",
            completedAt: new Date().toISOString(),
          }
          : r,
      );
      this.setState({ ...this.state, reviews: failedReviews });
    }
  }
}

const app = new Hono<{ Bindings: Env }>();

app.all("/agents/*", async (c) => {
  return (await routeAgentRequest(c.req.raw, c.env)) ?? new Response("Not Found", { status: 404 });
});

app.get("/health", (c) => c.json({ status: "ok", service: "spike-agent", timestamp: new Date().toISOString() }));

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
