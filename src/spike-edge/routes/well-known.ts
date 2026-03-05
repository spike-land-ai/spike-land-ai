import { Hono } from "hono";
import type { Env } from "../env.js";

const wellKnown = new Hono<{ Bindings: Env }>();

wellKnown.get("/.well-known/security.txt", (c) => {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  const expiresStr = expires.toISOString();

  const body = `Contact: mailto:security@spike.land
Contact: https://github.com/spike-land-ai/spike-land-ai/security/advisories
Encryption: https://spike.land/pgp.txt
Expires: ${expiresStr}
Preferred-Languages: en
Canonical: https://spike.land/.well-known/security.txt
Policy: https://spike.land/terms
`;

  return c.text(body, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  });
});

export { wellKnown };
