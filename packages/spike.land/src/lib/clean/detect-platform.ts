export type Platform =
  | "ios-safari"
  | "android-chrome"
  | "desktop-chrome"
  | "desktop-firefox"
  | "desktop-safari"
  | "other";

export function detectPlatform(userAgent?: string): Platform {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");

  // Only use ontouchend heuristic for iPad detection when using real navigator UA
  const hasTouchHeuristic = !userAgent && "ontouchend" in globalThis;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && hasTouchHeuristic);
  const isAndroid = /Android/i.test(ua);
  const isFirefox = /Firefox/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua) && !/Chromium/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);

  if (isIOS && isSafari) return "ios-safari";
  if (isIOS) return "ios-safari"; // All iOS browsers use WebKit
  if (isAndroid) return "android-chrome";
  if (isFirefox) return "desktop-firefox";
  if (isSafari) return "desktop-safari";
  if (isChrome || /Edg/i.test(ua)) return "desktop-chrome";

  return "other";
}

export function getCameraPermissionInstructions(platform: Platform): string {
  switch (platform) {
    case "ios-safari":
      return "Go to Settings \u2192 Safari \u2192 Camera \u2192 Allow";
    case "android-chrome":
      return "Tap the lock icon in the address bar \u2192 Permissions \u2192 Camera \u2192 Allow";
    case "desktop-chrome":
      return "Click the lock/tune icon in the address bar \u2192 Site settings \u2192 Camera \u2192 Allow";
    case "desktop-firefox":
      return "Click the lock icon \u2192 Connection secure \u2192 More information \u2192 Permissions \u2192 Camera";
    case "desktop-safari":
      return "Go to Safari \u2192 Settings \u2192 Websites \u2192 Camera \u2192 Allow for this site";
    case "other":
      return "Check your browser settings to allow camera access for this site";
  }
}
