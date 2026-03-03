/**
 * Centralized route definitions for the application.
 * Use these constants instead of hardcoding URLs in components.
 */

// App routes
export const ROUTES = {
  // Main navigation
  home: "/",
  albums: "/apps/pixel",
  images: "/apps/images",

  // Album routes
  albumDetail: (albumId: string) => `/albums/${albumId}`,
  albumShare: (albumId: string, token: string) => `/albums/${albumId}?token=${token}`,

  // Image routes
  imageDetail: (imageId: string, from?: string) => {
    const base = `/apps/pixel/${imageId}`;
    if (from) {
      return `${base}?from=${encodeURIComponent(from)}`;
    }
    return base;
  },

  // Mix routes
  mixDetail: (jobId: string, from?: string) => {
    const base = `/apps/pixel/mix/${jobId}`;
    if (from) {
      return `${base}?from=${encodeURIComponent(from)}`;
    }
    return base;
  },
  mixCreate: "/apps/pixel/mix",

  // Auth routes
  login: "/login",
  signup: "/signup",

  // Settings
  settings: "/settings",
  pipelines: "/settings/pipelines",
} as const;

// API routes
export const API_ROUTES = {
  // Auth
  authSignup: "/api/auth/signup",

  // Albums
  albums: "/api/albums",
  albumDetail: (albumId: string) => `/api/albums/${albumId}`,
  albumImages: (albumId: string) => `/api/albums/${albumId}/images`,

  // Images
  imageUpload: "/api/images/upload",
  imageEnhance: "/api/images/enhance",

  // User
  userProfile: "/api/user/profile",
  userTokens: "/api/user/tokens",
} as const;
