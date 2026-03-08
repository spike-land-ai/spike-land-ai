# Managed rulesets — Cloudflare Managed + OWASP Core
resource "cloudflare_ruleset" "managed_waf" {
  zone_id     = var.zone_id
  name        = "spike.land managed WAF"
  description = "Cloudflare Managed Ruleset + OWASP Core Ruleset"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules = [
    {
      action = "execute"
      action_parameters = {
        id = "efb7b8c949ac4650a09736fc376e9aee"
      }
      expression  = "true"
      description = "Execute Cloudflare Managed Ruleset"
      enabled     = true
    },
    {
      action = "execute"
      action_parameters = {
        id = "4814384a9e5d4991b9815dcfc25d2f1f"
      }
      expression  = "true"
      description = "Execute OWASP Core Ruleset"
      enabled     = true
    },
    {
      action = "execute"
      action_parameters = {
        id = "c2e184081120413c86c3ab7e14069605"
      }
      expression  = "true"
      description = "Execute Exposed Credentials Check Ruleset"
      enabled     = true
    }
  ]
}

# Rate limiting rules
resource "cloudflare_ruleset" "rate_limiting" {
  zone_id     = var.zone_id
  name        = "spike.land rate limiting"
  description = "Custom rate limiting rules for AI, Stripe, and MCP endpoints"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules = [
    {
      action = "block"
      action_parameters = {
        response = {
          status_code  = 429
          content_type = "application/json"
          content      = "{\"error\":\"Too many requests\"}"
        }
      }
      ratelimit = {
        characteristics     = ["cf.colo.id", "ip.src"]
        period              = 60
        requests_per_period = 30
        mitigation_timeout  = 60
      }
      expression  = "(http.request.uri.path matches \"^/proxy/ai\")"
      description = "Rate limit /proxy/ai — 30 req/min per IP"
      enabled     = true
    },
    {
      action = "block"
      action_parameters = {
        response = {
          status_code  = 429
          content_type = "application/json"
          content      = "{\"error\":\"Too many requests\"}"
        }
      }
      ratelimit = {
        characteristics     = ["cf.colo.id", "ip.src"]
        period              = 60
        requests_per_period = 10
        mitigation_timeout  = 60
      }
      expression  = "(http.request.uri.path matches \"^/proxy/stripe\")"
      description = "Rate limit /proxy/stripe — 10 req/min per IP"
      enabled     = true
    },
    {
      action = "block"
      action_parameters = {
        response = {
          status_code  = 429
          content_type = "application/json"
          content      = "{\"error\":\"Too many requests\"}"
        }
      }
      ratelimit = {
        characteristics     = ["cf.colo.id", "ip.src"]
        period              = 60
        requests_per_period = 120
        mitigation_timeout  = 60
      }
      expression  = "(http.request.uri.path matches \"^/mcp\")"
      description = "Rate limit /mcp — 120 req/min per IP"
      enabled     = true
    },
    {
      action = "block"
      action_parameters = {
        response = {
          status_code  = 429
          content_type = "application/json"
          content      = "{\"error\":\"Too many requests\"}"
        }
      }
      ratelimit = {
        characteristics     = ["cf.colo.id", "ip.src"]
        period              = 60
        requests_per_period = 300
        mitigation_timeout  = 60
      }
      expression  = "(http.host eq \"esm.spike.land\")"
      description = "Rate limit esm.spike.land — 300 req/min per IP"
      enabled     = true
    }
  ]
}

resource "cloudflare_ruleset" "public_browser_exceptions" {
  zone_id     = var.zone_id
  name        = "spike.land public browser exceptions"
  description = "Allow public browser endpoints to bypass managed challenges"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [
    {
      action = "skip"
      action_parameters = {
        phases = [
          "http_request_sbfm",
          "http_request_firewall_managed",
        ]
        products = [
          "bic",
          "securityLevel",
        ]
      }
      expression  = "(http.host eq \"status.spike.land\")"
      description = "Skip managed firewall challenges on the public status host"
      enabled     = true
    },
    {
      action = "skip"
      action_parameters = {
        phases = [
          "http_request_sbfm",
          "http_request_firewall_managed",
        ]
        products = [
          "bic",
          "securityLevel",
        ]
      }
      expression  = "((http.host eq \"spike.land\") and (http.request.method in {\"GET\" \"HEAD\"}) and not starts_with(http.request.uri.path, \"/api/\"))"
      description = "Skip managed firewall challenges on public spike.land page and asset requests"
      enabled     = true
    },
    {
      action = "skip"
      action_parameters = {
        phases = [
          "http_request_sbfm",
          "http_request_firewall_managed",
        ]
        products = [
          "bic",
          "securityLevel",
        ]
      }
      expression = "((((http.host eq \"spike.land\") and starts_with(http.request.uri.path, \"/api/\")) or (http.host eq \"api.spike.land\")) and (any(http.request.headers[\"origin\"][*] matches \"^https://([A-Za-z0-9-]+\\\\.)*spike\\\\.land$\") or any(http.request.headers[\"origin\"][*] matches \"^https?://localhost(:[0-9]+)?$\") or ((http.host eq \"spike.land\") and http.referer matches \"^https://([A-Za-z0-9-]+\\\\.)*spike\\\\.land/\")))"
      description = "Skip managed firewall challenges on edge API requests from spike.land, first-party pages, and localhost origins"
      enabled     = true
    }
  ]
}

# Bot management — requires Bot Management add-on (Enterprise)
# NOTE: Commented out — cf.bot_management.score requires a paid Bot Management plan.
# If you upgrade to Enterprise or add Bot Management, uncomment and apply.
#
# resource "cloudflare_ruleset" "bot_management" {
#   zone_id     = var.zone_id
#   name        = "spike.land bot management"
#   description = "Challenge requests with low bot scores"
#   kind        = "zone"
#   phase       = "http_request_firewall_custom"
#
#   rules = [
#     {
#       action      = "managed_challenge"
#       expression  = "(cf.bot_management.score lt 30)"
#       description = "Challenge bots with score < 30"
#       enabled     = true
#     }
#   ]
# }
