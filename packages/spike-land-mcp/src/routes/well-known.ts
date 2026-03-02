import { Hono } from "hono";
import type { Env } from "../env";

export const wellKnownRoute = new Hono<{ Bindings: Env }>();

wellKnownRoute.get("/oauth-authorization-server", (c) => {
  const issuer = "https://mcp.spike.land";

  return c.json({
    issuer,
    authorization_endpoint: "https://spike.land/mcp/authorize",
    token_endpoint: `${issuer}/oauth/token`,
    device_authorization_endpoint: `${issuer}/oauth/device`,
    response_types_supported: ["token"],
    grant_types_supported: ["urn:ietf:params:oauth:grant-type:device_code"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  });
});

wellKnownRoute.get("/oauth-protected-resource/mcp", (c) => {
  const issuer = "https://mcp.spike.land";

  return c.json({
    resource: `${issuer}/mcp`,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://spike.land/docs/mcp",
  });
});
