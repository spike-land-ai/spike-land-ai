/**
 * Generates a cloud-init user-data script for EC2 instances.
 *
 * The script:
 * 1. Runs the devcontainer with noVNC bound to localhost only
 * 2. Installs a lightweight Node.js token-validating reverse proxy
 * 3. Installs cloudflared and creates a tunnel to the proxy
 */
export function generateUserData(
  vncTokenSecret: string,
  tunnelToken: string,
): string {
  const script = `#!/bin/bash
set -euo pipefail

exec > /var/log/user-data.log 2>&1
echo "=== User data script starting at $(date) ==="

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# Wait for Docker to be ready
for i in $(seq 1 30); do
  docker info &>/dev/null && break
  sleep 2
done

# Run devcontainer with noVNC on localhost only
docker run -d \\
  --name devbox \\
  --restart unless-stopped \\
  -p 127.0.0.1:6080:6080 \\
  -e VNC_RESOLUTION=1920x1080 \\
  devimages/bookworm-devcontainer

# Install Node.js (for the token proxy)
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Create the token-validating reverse proxy
mkdir -p /opt/vnc-proxy
cat > /opt/vnc-proxy/package.json << 'PKGJSON'
{
  "name": "vnc-proxy",
  "private": true,
  "dependencies": {
    "jose": "^6.0.0",
    "http-proxy": "^1.18.1"
  }
}
PKGJSON

cd /opt/vnc-proxy && npm install --production

cat > /opt/vnc-proxy/proxy.js << 'PROXYJS'
const http = require("http");
const httpProxy = require("http-proxy");
const { jwtVerify } = require("jose");

const SECRET = new TextEncoder().encode(process.env.VNC_TOKEN_SECRET);
const TARGET = "http://127.0.0.1:6080";

const proxy = httpProxy.createProxyServer({ target: TARGET, ws: true });

proxy.on("error", (err, _req, res) => {
  console.error("Proxy error:", err.message);
  if (res.writeHead) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad Gateway");
  }
});

async function validateToken(url) {
  const parsed = new URL(url, "http://localhost");
  const token = parsed.searchParams.get("token");
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET, { algorithms: ["HS256"], issuer: "spike.land", audience: "vnc-proxy" });
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  if (await validateToken(req.url)) {
    proxy.web(req, res);
  } else {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Unauthorized");
  }
});

server.on("upgrade", async (req, socket, head) => {
  if (await validateToken(req.url)) {
    proxy.ws(req, socket, head);
  } else {
    socket.write("HTTP/1.1 401 Unauthorized\\r\\n\\r\\n");
    socket.destroy();
  }
});

server.listen(8080, "127.0.0.1", () => {
  console.log("VNC token proxy listening on 127.0.0.1:8080");
});
PROXYJS

# Write VNC token secret to an environment file (avoids shell expansion risks)
printf 'VNC_TOKEN_SECRET=%s\\n' '${vncTokenSecret}' > /etc/vnc-proxy.env
chmod 600 /etc/vnc-proxy.env

# Create systemd service for the proxy
cat > /etc/systemd/system/vnc-proxy.service << 'SVCEOF'
[Unit]
Description=VNC Token Proxy
After=network.target docker.service

[Service]
Type=simple
EnvironmentFile=/etc/vnc-proxy.env
WorkingDirectory=/opt/vnc-proxy
ExecStart=/usr/bin/node proxy.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable vnc-proxy
systemctl start vnc-proxy

# Install cloudflared
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o /tmp/cloudflared.deb
dpkg -i /tmp/cloudflared.deb || apt-get install -f -y

# Create cloudflared service using the tunnel token (written to file to avoid shell expansion)
printf '%s' '${tunnelToken}' > /etc/cloudflared-token
chmod 600 /etc/cloudflared-token
cloudflared service install "$(cat /etc/cloudflared-token)"
systemctl enable cloudflared
systemctl start cloudflared

echo "=== User data script completed at $(date) ==="
`;

  return Buffer.from(script).toString("base64");
}
