#!/usr/bin/env bash
set -euo pipefail

# Install VeroHub HubSpot skills into Claude Desktop's global skills directory
# Each skill becomes a folder with SKILL.md inside, which Claude Desktop picks up

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_SKILLS_DIR="$HOME/.claude/skills"

echo "=== Installing VeroHub Skills into Claude Desktop ==="
echo "Target: $CLAUDE_SKILLS_DIR"
echo ""

mkdir -p "$CLAUDE_SKILLS_DIR"

# Convert flat .md files into folder/SKILL.md structure
install_skill() {
  local src="$1"
  local filename
  filename="$(basename "$src" .md)"

  # Convert filename to folder name (e.g., hubspot-master-orchestrator)
  local folder_name="$filename"

  # Skip SKILL-ARCHITECTURE (it's a meta doc, not a skill)
  if [ "$filename" = "SKILL-ARCHITECTURE" ]; then
    folder_name="hubspot-architecture"
  fi

  local dest_dir="$CLAUDE_SKILLS_DIR/$folder_name"
  mkdir -p "$dest_dir"
  cp "$src" "$dest_dir/SKILL.md"
  echo "  + $folder_name/"
}

# Install the 9 Claude skills
for f in "$REPO_ROOT/.claude/skills/"*.md; do
  [ -f "$f" ] && install_skill "$f"
done

# Install the connector plugin as a skill too
CONNECTOR_DIR="$CLAUDE_SKILLS_DIR/hubspot-connector"
mkdir -p "$CONNECTOR_DIR"
cp "$REPO_ROOT/.claude/connector-plugin.md" "$CONNECTOR_DIR/SKILL.md"
echo "  + hubspot-connector/"

# Install the operational runbook as a skill
RUNBOOK_DIR="$CLAUDE_SKILLS_DIR/hubspot-operational-runbook"
mkdir -p "$RUNBOOK_DIR"

# Add frontmatter to the runbook so Claude Desktop recognises it
cat > "$RUNBOOK_DIR/SKILL.md" << 'EOF'
---
description: "Operational runbook for HubSpot API v4 — known gotchas, working patterns, action types that fail, and correct filter formats. Reference this before deploying any workflow."
---

EOF
cat "$REPO_ROOT/.agents/skills/hubspot-integration/operational-runbook.md" >> "$RUNBOOK_DIR/SKILL.md"
echo "  + hubspot-operational-runbook/"

# Install reference docs as a single bundled skill
REF_DIR="$CLAUDE_SKILLS_DIR/hubspot-reference-docs"
mkdir -p "$REF_DIR"

# Create a SKILL.md that points to the sub-files
cat > "$REF_DIR/SKILL.md" << 'REFEOF'
---
description: "Complete HubSpot API reference library — workflows, contacts, deals, properties, associations, custom objects, authentication, webhooks, rate limits, and anti-patterns. Use when building any HubSpot integration or automation."
---

# HubSpot Reference Library

This skill bundles all HubSpot API reference documentation. See individual files in this directory for detailed guides.

## Available References

| File | Topic |
|------|-------|
| hubspot-workflows-reference.md | Workflow v4 API complete guide |
| hubspot-workflow-templates.md | Ready-to-deploy JSON patterns |
| hubspot-contacts-reference.md | Contact CRUD and batch ops |
| hubspot-deals-reference.md | Deal and pipeline management |
| hubspot-properties-reference.md | Property types and field types |
| hubspot-associations-reference.md | Association v4 API |
| hubspot-custom-objects-reference.md | Custom object schemas |
| hubspot-authentication-and-oauth-reference.md | OAuth 2.0 flows |
| hubspot-webhooks-vs-polling-reference.md | Event handling |
| hubspot-usage-and-limits-reference.md | Rate limits |
| hubspot-integration-antipatterns-reference.md | Common mistakes |
REFEOF

# Copy all reference files alongside the SKILL.md
for f in "$REPO_ROOT/.agents/skills/hubspot-integration/"*.md; do
  [ -f "$f" ] && cp "$f" "$REF_DIR/"
done
for f in "$REPO_ROOT/.agents/skills/hubspot-integration/"*.yaml; do
  [ -f "$f" ] && cp "$f" "$REF_DIR/"
done
echo "  + hubspot-reference-docs/ ($(ls "$REF_DIR/"* | wc -l | tr -d ' ') files)"

echo ""
echo "=== Done! ==="
echo ""
echo "Installed $(ls -d "$CLAUDE_SKILLS_DIR"/hubspot-* 2>/dev/null | wc -l | tr -d ' ') HubSpot skills into Claude Desktop."
echo ""
echo "Now open Claude Desktop → Customize → Skills and you'll see them listed."
echo "Toggle them ON for any project where you want HubSpot capabilities."
