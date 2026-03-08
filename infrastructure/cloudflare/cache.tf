# Cache rules
resource "cloudflare_ruleset" "cache_rules" {
  zone_id     = var.zone_id
  name        = "spike.land cache rules"
  description = "Cache settings for static assets, JS/CSS/fonts, and HTML routes"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules = [
    {
      # Rule 0: esm.spike.land versioned packages — 1 year immutable cache
      action = "set_cache_settings"
      action_parameters = {
        cache = true
        edge_ttl = {
          mode    = "override_origin"
          default = 31536000
        }
        browser_ttl = {
          mode    = "override_origin"
          default = 31536000
        }
      }
      expression  = "(http.host eq \"esm.spike.land\" and http.request.uri.path contains \"@\")"
      description = "esm.spike.land versioned packages — 1 year immutable cache"
      enabled     = true
    },
    {
      # Rule 1: Hashed assets — long-lived cache
      action = "set_cache_settings"
      action_parameters = {
        cache = true
        edge_ttl = {
          mode    = "override_origin"
          default = 31536000
        }
        browser_ttl = {
          mode    = "override_origin"
          default = 31536000
        }
      }
      expression  = "(http.request.uri.path matches \"^/assets/.*[-.][A-Za-z0-9_-]{8,}\\.(js|css|woff2|png|jpg|jpeg|svg|webp)$\")"
      description = "/assets/* with Vite-style hashed filenames — 1 year cache"
      enabled     = true
    },
    {
      # Rule 2: Non-hashed JS, CSS, WOFF2 — short cache
      # Hashed assets are already covered by Rule 1 (1-year immutable)
      action = "set_cache_settings"
      action_parameters = {
        cache = true
        edge_ttl = {
          mode    = "override_origin"
          default = 3600
        }
        browser_ttl = {
          mode    = "override_origin"
          default = 300
        }
      }
      expression  = "(http.request.uri.path.extension in {\"js\" \"css\" \"woff2\"} and not http.request.uri.path matches \"[-.][A-Za-z0-9_-]{8,}\\.\")"
      description = "Non-hashed *.js, *.css, *.woff2 — 1h edge / 5min browser"
      enabled     = true
    },
    {
      # Rule 3: HTML routes — bypass cache
      action = "set_cache_settings"
      action_parameters = {
        cache = false
      }
      expression  = "(http.request.uri.path.extension eq \"html\" or not http.request.uri.path contains \".\")"
      description = "HTML routes — bypass cache"
      enabled     = true
    }
  ]
}

# Tiered caching (smart topology)
resource "cloudflare_tiered_cache" "spike_land" {
  zone_id = var.zone_id
  value   = "on"
}
