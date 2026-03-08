# API Best Practices Documentation

This directory contains comprehensive guides for building production-ready APIs
and services.

## Files

### app-store-performance.md

**Performance Budgets For spike.land App Store Apps**

Covers latency targets, edge cache strategy, cold-start expectations, and
operational SLAs for hosted, cross-origin, and offline-capable MCP apps.

### offline-first.md

**Offline-First Patterns For MCP Apps**

Covers IndexedDB-backed persistence, service worker asset caching, sync queues,
and packaging requirements for browser bundles that must keep working without a
network connection.

### api-design.md

**Complete REST API Design Best Practices Guide**

A comprehensive, implementation-ready guide covering:

- **URL Design** - Resource naming conventions, versioning strategies, hierarchy
  management
- **HTTP Methods** - GET, POST, PUT, PATCH, DELETE with proper semantics and
  idempotency
- **Response Formats** - Status codes, error handling (RFC 9457), pagination
  strategies
- **Authentication** - API Keys, JWT, OAuth 2.0, OpenID Connect with security
  best practices
- **Rate Limiting** - Algorithms (Token Bucket, Leaky Bucket, Sliding Window),
  implementation strategies
- **API Documentation** - OpenAPI 3.1.x specification with real-world examples
- **Advanced Patterns** - HATEOAS, async operations, conditional requests, batch
  operations

**Size**: 1,590 lines | **Format**: Markdown with code examples

## Key Takeaways

### URL Design Highlights

- Use nouns for resources, HTTP verbs for actions
- Plural nouns for collections (`/products`, `/orders`)
- Lowercase with hyphens (`/device-management`)
- No trailing slashes or file extensions
- Use query parameters for filtering/sorting/pagination
- Limit nesting depth to 2 levels

### HTTP Methods Guidelines

| Method | Idempotent | Safe | Use Case                |
| ------ | ---------- | ---- | ----------------------- |
| GET    | Yes        | Yes  | Retrieve data           |
| POST   | No         | No   | Create new resource     |
| PUT    | Yes        | No   | Replace entire resource |
| PATCH  | Sometimes  | No   | Partial updates         |
| DELETE | Yes        | No   | Remove resource         |

### Status Code Quick Reference

- **2xx**: Success (200 OK, 201 Created, 202 Accepted, 204 No Content)
- **4xx**: Client error (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404
  Not Found, 429 Rate Limited)
- **5xx**: Server error (500 Internal Server Error, 503 Service Unavailable)

### Authentication Methods Comparison

| Method    | Security | Complexity | Best For                         |
| --------- | -------- | ---------- | -------------------------------- |
| API Keys  | Medium   | Low        | Public APIs, server-to-server    |
| JWT       | High     | Medium     | SPAs, mobile apps, microservices |
| OAuth 2.0 | High     | High       | Third-party integration          |
| OIDC      | Highest  | High       | Enterprise SSO, identity         |

### Rate Limiting Best Practices

- Implement at API gateway level for consistency
- Use Token Bucket algorithm for flexibility
- Include rate limit info in response headers (X-RateLimit-*)
- Return 429 Too Many Requests when exceeded
- Provide clear Retry-After header
- Document policies clearly to users

### API Documentation Standards

- Use OpenAPI 3.1.x specification (current standard)
- Include comprehensive examples
- Document authentication schemes
- Specify rate limits
- Keep docs synchronized with code
- Auto-generate from source code when possible
- Provide interactive testing via Swagger UI

## Research Methodology

This documentation was created through comprehensive research of industry
standards and best practices from:

- **API Design Standards**: RESTful API standards and architectural guidelines
- **HTTP Specifications**: RFC standards including RFC 9457 (Problem Details),
  RFC 6902 (JSON Patch), RFC 6585 (HTTP Status Code 429)
- **Authentication Standards**: OAuth 2.0, OpenID Connect, JWT specifications
- **Industry Guidelines**: Azure Architecture Center, GitHub API practices,
  Stripe API design patterns
- **Rate Limiting Expertise**: Cloudflare, Kong, Tyk, and other API management
  platforms
- **Documentation Standards**: OpenAPI 3.1.x specification and Swagger best
  practices

## Usage

Use this documentation as a reference when:

- Designing new REST APIs
- Reviewing API design for compliance with best practices
- Implementing authentication and rate limiting
- Writing API documentation
- Troubleshooting API design issues

## Related Resources

- [OpenAPI Specification](https://spec.openapis.org/)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [JWT Standard](https://jwt.io/)
- [RESTful API Tutorial](https://restfulapi.net/)

---

**Last Updated**: December 6, 2025 **Format**: Markdown with code examples
**License**: Available for Spike Land platform documentation
