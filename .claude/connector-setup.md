# VeroHub Connector — Setup for Other Projects

## Add to any project's `.mcp.json`:

```json
{
  "mcpServers": {
    "hubspot-operator": {
      "command": "/opt/homebrew/bin/npx",
      "args": ["tsx", "--tsconfig", "tsconfig.mcp.json", "mcp-server.ts"],
      "cwd": "/Users/pietro/Documents/Vero HubSpot Operator",
      "env": {
        "APP_BASE_URL": "https://vero-hubspot-operator-production.up.railway.app",
        "MCP_API_KEY": "bf3213757082f4ae3effb178616e8fe14832de62525dcfcea80190dfe26bc53e"
      }
    }
  }
}
```

## Add the connector plugin as a skill:

Copy `.claude/connector-plugin.md` to the other project's `.claude/` directory, or add a symlink:

```bash
ln -s "/Users/pietro/Documents/Vero HubSpot Operator/.claude/connector-plugin.md" /path/to/other/project/.claude/hubspot-connector.md
```

This gives Claude full instructions on how to use every tool correctly, including critical workflow rules and shortcuts.
