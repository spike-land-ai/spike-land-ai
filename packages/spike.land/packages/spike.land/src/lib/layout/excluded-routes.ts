export const FOOTER_EXCLUDED_PATHS = [
  "/canvas",
  "/storybook",
  "/admin",
  "/learnit",
  "/personas",
  "/auth",
  "/live",
  "/create",
  "/connect",
  "/apps",
  "/onboarding",
  "/share",
];

export function shouldHideFooter(pathname: string | null): boolean {
  return FOOTER_EXCLUDED_PATHS.some(path => pathname?.startsWith(path));
}

/** Alias for shouldHideFooter - hides all chrome (footer, nav) on these paths */
export const shouldHideChrome = shouldHideFooter;
