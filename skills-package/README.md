# Vero HubSpot Operator — Skills Package

## How to Install in Claude Desktop

### Option A: Copy to Claude Skills Directory (Recommended)

1. Open Finder
2. Press `Cmd + Shift + G` and paste: `~/.claude/skills/`
3. Copy all the folders from this `skills-package/` directory into `~/.claude/skills/`
4. Restart Claude Desktop
5. Go to **Customize → Skills** — you should see all the HubSpot skills listed

### Option B: Add via Claude Desktop UI

1. Open Claude Desktop
2. Go to **Customize → Skills**
3. Click the **+** button
4. For each skill folder in this package:
   - Set the **Name** to the folder name (e.g., `hubspot-connector`)
   - Copy the **description** from the SKILL.md frontmatter
   - Paste the full **content** of the SKILL.md file
5. Toggle the skill **on**

## How to Share with a Teammate

1. Zip this entire `skills-package/` folder
2. Send the zip to your teammate
3. They follow **Option A** above to install

## MCP Server Setup (Required for Tools)

The skills tell Claude **how** to use HubSpot, but the MCP server provides the **tools**.

Your teammate also needs the MCP server configured in Claude Desktop:

1. Open: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add this to the `mcpServers` section:

```json
{
  "hubspot-operator": {
    "command": "/opt/homebrew/bin/node",
    "args": [
      "/path/to/Vero HubSpot Operator/node_modules/.bin/tsx",
      "--tsconfig",
      "/path/to/Vero HubSpot Operator/tsconfig.mcp.json",
      "/path/to/Vero HubSpot Operator/mcp-server.ts"
    ],
    "env": {
      "APP_BASE_URL": "https://vero-hubspot-operator-production.up.railway.app",
      "MCP_API_KEY": "<your-api-key>"
    }
  }
}
```

3. Update the paths to match your local setup
4. Restart Claude Desktop

## What's Included

| Skill | Description |
|-------|-------------|
| `hubspot-connector` | Tool reference — all 35+ MCP tools, usage patterns, shortcuts |
| `hubspot-master-orchestrator` | Central coordinator — routes multi-step requests |
| `hubspot-operational-runbook` | API gotchas — known failures, working patterns |
| `hubspot-workflow-drafts` | Create workflows — v4 API format, action types, branching |
| `hubspot-property-drafts` | Create properties — type/fieldType matrix, validation |
| `hubspot-pipeline-drafts` | Create pipelines — deal/ticket stages, metadata |
| `hubspot-list-drafts` | Create lists — filter structure, operators |
| `hubspot-meeting-analysis` | Analyse meeting notes → implementation plan |
| `hubspot-template-drafts` | Create CRM templates — bundle multiple resources |
| `hubspot-bulk-drafts` | Create bulk scripts — data cleanup, mass updates |
| `hubspot-architecture` | Visual architecture map — data flow diagrams |
| `hubspot-reference-docs` | API reference — OAuth, CRM, associations, webhooks |
| `hubspot-integration` | Integration patterns — SDK usage, rate limiting |
| `hubspot-portal-config` | Portal-specific config — owner IDs, naming conventions |
| `hubspot-learnings` | **⚡ Self-improving** — learns from failures, appends new patterns automatically |
# Last synced: 2026-03-18T14:05:00Z
