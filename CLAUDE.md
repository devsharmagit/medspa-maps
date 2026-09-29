@AGENTS.md

---

## Claude Code specifics

Your on-disk memory store at
`~/.claude/projects/-Users-devsharma-Developer-medspa-map/memory/` is **local to this machine and
this tool** — it survives an account switch, but it does not travel to another machine or to
Antigravity/Cursor/Copilot. Keep using it, but anything another assistant would need belongs in
the shared vault.

A verbatim mirror lives at `05-claude-memories/` in the vault. Re-sync it with:

```bash
VAULT="/Users/devsharma/Documents/Obsidian Vault/medspa-maps"
cp ~/.claude/projects/-Users-devsharma-Developer-medspa-map/memory/*.md "$VAULT/05-claude-memories/"
mv "$VAULT/05-claude-memories/MEMORY.md" "$VAULT/05-claude-memories/_MEMORY-INDEX.md"
```
