import { describe, expect, it } from "vitest";

import { API_ROUTES, ROUTES } from "./routes";

describe("ROUTES", () => {
  it("has correct static routes", () => {
    expect(ROUTES.home).toBe("/");
    expect(ROUTES.login).toBe("/login");
    expect(ROUTES.signup).toBe("/signup");
    expect(ROUTES.settings).toBe("/settings");
    expect(ROUTES.mixCreate).toBe("/apps/pixel/mix");
  });

  it("albumDetail generates correct path", () => {
    expect(ROUTES.albumDetail("abc-123")).toBe("/albums/abc-123");
  });

  it("albumShare generates correct path with token", () => {
    expect(ROUTES.albumShare("abc", "tok")).toBe("/albums/abc?token=tok");
  });

  it("imageDetail generates path without from param", () => {
    expect(ROUTES.imageDetail("img-1")).toBe("/apps/pixel/img-1");
  });

  it("imageDetail generates path with from param (URL-encoded)", () => {
    expect(ROUTES.imageDetail("img-1", "/albums/abc")).toBe(
      "/apps/pixel/img-1?from=%2Falbums%2Fabc",
    );
  });

  it("mixDetail generates path without from param", () => {
    expect(ROUTES.mixDetail("job-1")).toBe("/apps/pixel/mix/job-1");
  });

  it("mixDetail generates path with from param", () => {
    expect(ROUTES.mixDetail("job-1", "/gallery")).toBe("/apps/pixel/mix/job-1?from=%2Fgallery");
  });
});

describe("API_ROUTES", () => {
  it("has correct static API routes", () => {
    expect(API_ROUTES.authSignup).toBe("/api/auth/signup");
    expect(API_ROUTES.albums).toBe("/api/albums");
    expect(API_ROUTES.imageUpload).toBe("/api/images/upload");
    expect(API_ROUTES.imageEnhance).toBe("/api/images/enhance");
    expect(API_ROUTES.userProfile).toBe("/api/user/profile");
    expect(API_ROUTES.userTokens).toBe("/api/user/tokens");
  });

  it("albumDetail generates correct API path", () => {
    expect(API_ROUTES.albumDetail("xyz")).toBe("/api/albums/xyz");
  });

  it("albumImages generates correct API path", () => {
    expect(API_ROUTES.albumImages("xyz")).toBe("/api/albums/xyz/images");
  });
});
