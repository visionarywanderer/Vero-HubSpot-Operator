---
name: hubspot-integration
description: "Expert patterns for HubSpot CRM integration. NOTE: For the latest API reference docs, prefer the `hubspot-reference-docs` skill — it is the single source of truth for API docs. This skill covers SDK patterns and code examples."
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# HubSpot Integration

Expert-level HubSpot CRM integration skill covering OAuth, CRM CRUD, associations v4, batch operations, webhooks, workflows, rate limits, and anti-pattern detection for Node.js and Python SDKs.

## Reference Files

The following reference documents are available in this skill directory:

- `hubspot-contacts-reference.md` — Contacts API patterns
- `hubspot-deals-reference.md` — Deals API patterns
- `hubspot-custom-objects-reference.md` — Custom Objects API
- `hubspot-properties-reference.md` — Properties API
- `hubspot-associations-reference.md` — Associations v4 API
- `hubspot-workflows-reference.md` — Workflows API
- `hubspot-usage-and-limits-reference.md` — Rate limits and usage
- `hubspot-authentication-and-oauth-reference.md` — OAuth 2.0 and Private App auth
- `hubspot-webhooks-vs-polling-reference.md` — Webhooks vs polling patterns
- `hubspot-integration-antipatterns-reference.md` — Common anti-patterns to avoid

## Quick Reference

### Authentication
- **Public apps**: Use OAuth 2.0 flow
- **Single-account**: Use Private App tokens
- **Never**: Use deprecated API keys

### Best Practices
- Use batch operations instead of individual requests
- Use webhooks instead of polling for real-time updates
- Handle rate limits (100 requests/10 seconds for OAuth, 500K/day)
- Use associations v4 API (not v3)

### Anti-Patterns
- Using deprecated API keys
- Individual requests instead of batch
- Polling instead of webhooks
- Ignoring rate limits
- Not handling pagination

## Full Specification

See `skill.yaml` for the complete manifest with 18 capabilities, 24 anti-patterns, guardrails, env configs, and 15 test prompts.
