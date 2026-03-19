#!/usr/bin/env bash
set -euo pipefail

# Package VeroHub HubSpot skills for distribution
# Produces: dist/vero-hubspot-skills.zip

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$REPO_ROOT/dist"
PKG="$DIST/vero-hubspot-skills"

echo "=== Packaging VeroHub HubSpot Skills ==="
echo "Source: $REPO_ROOT"

# Clean previous build
rm -rf "$PKG" "$DIST/vero-hubspot-skills.zip"
mkdir -p "$PKG/claude-skills" "$PKG/hubspot-reference" "$PKG/connector"

# 1. CLAUDE.md
cp "$REPO_ROOT/CLAUDE.md" "$PKG/CLAUDE.md"
echo "  + CLAUDE.md"

# 2. Claude skills (.claude/skills/)
for f in "$REPO_ROOT/.claude/skills/"*.md; do
  [ -f "$f" ] && cp "$f" "$PKG/claude-skills/"
done
echo "  + claude-skills/ ($(ls "$PKG/claude-skills/" | wc -l | tr -d ' ') files)"

# 3. HubSpot reference docs (.agents/skills/hubspot-integration/)
for f in "$REPO_ROOT/.agents/skills/hubspot-integration/"*; do
  [ -f "$f" ] && cp "$f" "$PKG/hubspot-reference/"
done
echo "  + hubspot-reference/ ($(ls "$PKG/hubspot-reference/" | wc -l | tr -d ' ') files)"

# 4. Connector docs
cp "$REPO_ROOT/.claude/connector-plugin.md" "$PKG/connector/"
cp "$REPO_ROOT/.claude/connector-setup.md" "$PKG/connector/"
echo "  + connector/ (2 files)"

# 5. Install script
cat > "$PKG/install.sh" << 'INSTALL_EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "=== VeroHub HubSpot Skills Installer ==="
echo ""

# Determine target directory
if [ -n "${1:-}" ]; then
  TARGET="$1"
else
  echo "Usage: ./install.sh /path/to/your/project"
  echo ""
  echo "This will install skills and reference docs into your project's"
  echo "Claude Code configuration directories."
  echo ""
  echo "Files will be copied to:"
  echo "  <project>/CLAUDE.md"
  echo "  <project>/.claude/skills/"
  echo "  <project>/.claude/connector-plugin.md"
  echo "  <project>/.claude/connector-setup.md"
  echo "  <project>/.agents/skills/hubspot-integration/"
  exit 1
fi

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$(cd "$TARGET" && pwd)"

echo "Target project: $TARGET"
echo ""

# Check for existing CLAUDE.md
if [ -f "$TARGET/CLAUDE.md" ]; then
  echo "WARNING: $TARGET/CLAUDE.md already exists."
  read -p "Overwrite? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping CLAUDE.md (keeping existing)"
  else
    cp "$SCRIPT_DIR/CLAUDE.md" "$TARGET/CLAUDE.md"
    echo "  + CLAUDE.md"
  fi
else
  cp "$SCRIPT_DIR/CLAUDE.md" "$TARGET/CLAUDE.md"
  echo "  + CLAUDE.md"
fi

# Install Claude skills
mkdir -p "$TARGET/.claude/skills"
cp "$SCRIPT_DIR/claude-skills/"*.md "$TARGET/.claude/skills/"
echo "  + .claude/skills/ ($(ls "$SCRIPT_DIR/claude-skills/"*.md | wc -l | tr -d ' ') files)"

# Install connector docs
mkdir -p "$TARGET/.claude"
cp "$SCRIPT_DIR/connector/connector-plugin.md" "$TARGET/.claude/"
cp "$SCRIPT_DIR/connector/connector-setup.md" "$TARGET/.claude/"
echo "  + .claude/connector-plugin.md"
echo "  + .claude/connector-setup.md"

# Install HubSpot reference docs
mkdir -p "$TARGET/.agents/skills/hubspot-integration"
cp "$SCRIPT_DIR/hubspot-reference/"* "$TARGET/.agents/skills/hubspot-integration/"
echo "  + .agents/skills/hubspot-integration/ ($(ls "$SCRIPT_DIR/hubspot-reference/"* | wc -l | tr -d ' ') files)"

echo ""
echo "=== Installation complete ==="
echo ""
echo "Next steps:"
echo "  1. Review CLAUDE.md and update owner IDs / portal ID if needed"
echo "  2. Update .claude/connector-setup.md with your MCP_API_KEY"
echo "  3. Open a Claude Code session in your project — CLAUDE.md loads automatically"
INSTALL_EOF
chmod +x "$PKG/install.sh"
echo "  + install.sh"

# 6. README
cat > "$PKG/README.md" << 'README_EOF'
# VeroHub HubSpot Skills Package

Everything Claude needs to manage HubSpot CRM portals — skills, reference docs, API runbook, and connector setup.

## What's Inside

```
CLAUDE.md              → Project-level instructions (auto-loaded by Claude Code)
claude-skills/         → 9 operational skill docs
hubspot-reference/     → 13 API reference docs + workflow templates + runbook
connector/             → MCP connector plugin + setup guide
install.sh             → Automated installer
```

### Skills (claude-skills/)
- **Master Orchestrator** — Routes requests to the correct skill
- **Workflow Drafts** — Workflow creation with v4 API format
- **Property/Pipeline/List/Template/Bulk Drafts** — CRUD patterns for each resource type
- **Meeting Analysis** — Converts meeting notes into HubSpot actions
- **Architecture Overview** — How skills connect and flow

### Reference Docs (hubspot-reference/)
- Workflow automation reference + ready-to-deploy JSON templates
- Contacts, Deals, Properties, Associations, Custom Objects APIs
- OAuth authentication patterns
- Rate limits and usage guidelines
- Anti-patterns and common mistakes
- **Operational Runbook** — API gotchas discovered through testing

### Connector (connector/)
- Full tool reference with usage examples
- Setup guide for adding MCP to any project

## Installation

### Automated
```bash
./install.sh /path/to/your/project
```

### Manual
1. Copy `CLAUDE.md` to your project root
2. Copy `claude-skills/*.md` to `<project>/.claude/skills/`
3. Copy `hubspot-reference/*` to `<project>/.agents/skills/hubspot-integration/`
4. Copy `connector/*` to `<project>/.claude/`

### Claude Desktop (global install)
```bash
mkdir -p ~/.claude/skills
cp claude-skills/*.md ~/.claude/skills/
```

## After Installation

1. **Update CLAUDE.md** — Set your portal ID, owner IDs, and naming conventions
2. **Update connector-setup.md** — Add your `APP_BASE_URL` and `MCP_API_KEY`
3. **Add MCP server** — Copy the `.mcp.json` config from `connector-setup.md` into your project
4. **Start a Claude session** — CLAUDE.md is loaded automatically; skills are available

## Sharing with Teammates

Just send them this zip file. They run `./install.sh /their/project` and they're set up.
README_EOF
echo "  + README.md"

# Build zip
cd "$DIST"
zip -rq "vero-hubspot-skills.zip" "vero-hubspot-skills/"
echo ""
echo "=== Done ==="
echo "Package: $DIST/vero-hubspot-skills.zip"
echo "Size: $(du -h "$DIST/vero-hubspot-skills.zip" | cut -f1)"
echo ""
echo "Contents:"
unzip -l "$DIST/vero-hubspot-skills.zip" | tail -n +4 | head -n -2
