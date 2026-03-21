#!/usr/bin/env bash
set -euo pipefail

# Package each .claude/skills/<skill-name>/ into an individual zip
# suitable for upload to claude.ai / Claude Desktop.
#
# Output: dist/skills/<skill-name>.zip (one per skill)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/.claude/skills"
DIST="$REPO_ROOT/dist/skills"

echo "=== Packaging Skills for claude.ai ==="
echo "Source: $SKILLS_DIR"
echo ""

# Clean previous build
rm -rf "$DIST"
mkdir -p "$DIST"

count=0
for skill_dir in "$SKILLS_DIR"/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name=$(basename "$skill_dir")

  # Skip if no SKILL.md
  if [ ! -f "$skill_dir/SKILL.md" ]; then
    echo "  SKIP $skill_name (no SKILL.md)"
    continue
  fi

  # Create zip from the skill directory
  (cd "$SKILLS_DIR" && zip -rq "$DIST/$skill_name.zip" "$skill_name/")
  size=$(du -h "$DIST/$skill_name.zip" | cut -f1)
  file_count=$(unzip -l "$DIST/$skill_name.zip" 2>/dev/null | grep -c "  [0-9]" || echo "?")
  echo "  + $skill_name.zip ($size, $file_count files)"
  count=$((count + 1))
done

echo ""
echo "=== Done ==="
echo "Output: $DIST/"
echo "Skills packaged: $count"
echo ""
echo "To upload to claude.ai:"
echo "  1. Go to claude.ai → Customize → Skills"
echo "  2. Click '+' to add a skill"
echo "  3. Upload the .zip file for each skill you want to enable"
echo ""
echo "To link with your remote MCP server:"
echo "  Your MCP tools are already available via the connector at:"
echo "  https://vero-hubspot-operator-production.up.railway.app/api/mcp"
echo "  Skills reference MCP tools by name — they'll work automatically"
echo "  once both the connector and skills are set up."
