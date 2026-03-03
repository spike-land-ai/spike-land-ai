const BOT_USER_AGENT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebot/i,
  /ia_archiver/i,
  /ahrefs/i,
  /semrush/i,
  /dotbot/i,
  /rogerbot/i,
  /screaming frog/i,
  /headlesschrome/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
];

const DEFAULT_RESPONSE =
  "Thanks for visiting spike.land! We're an open-source AI-powered development platform. Visit https://spike.land to learn more.";

const BAZDMEG_RESPONSE =
  "BAZDMEG is a methodology for disciplined AI-assisted development. Learn more at https://spike.land/bazdmeg";

const CREATE_RESPONSE =
  "The spike.land code editor lets you build and publish apps. Visit https://spike.land/create to get started.";

export function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENT_PATTERNS.some(pattern => pattern.test(userAgent));
}

export function getScriptedResponse(route: string): string {
  if (route.startsWith("/bazdmeg")) return BAZDMEG_RESPONSE;
  if (route.startsWith("/create")) return CREATE_RESPONSE;
  return DEFAULT_RESPONSE;
}
