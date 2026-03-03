/**
 * Codespace ID generation.
 *
 * Produces random IDs in the format "adjective.noun.verb.suffix"
 * used when creating new apps.
 */

export const ADJECTIVES = [
  "swift",
  "bright",
  "cosmic",
  "digital",
  "clever",
  "stellar",
  "nimble",
  "sleek",
  "vibrant",
  "dynamic",
  "agile",
  "bold",
  "smart",
  "rapid",
  "fresh",
];

export const NOUNS = [
  "forge",
  "spark",
  "wave",
  "pulse",
  "flow",
  "nexus",
  "orbit",
  "prism",
  "grid",
  "core",
  "hub",
  "vault",
  "bridge",
  "beacon",
  "studio",
];

export const VERBS = [
  "launch",
  "build",
  "craft",
  "sync",
  "boost",
  "stream",
  "dash",
  "snap",
  "blend",
  "shift",
  "link",
  "push",
  "rise",
  "glow",
  "zoom",
];

export function generateCodespaceId(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const verb = VERBS[Math.floor(Math.random() * VERBS.length)];
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${adj}.${noun}.${verb}.${suffix}`;
}
