@.claude/CLAUDE.md

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- The graph is code-only (built with `graphify extract . --code-only`, no LLM cost); the design docs live in `.claude/docs/` and `docs/`.
- The graph is refreshed **manually** (no graphify git hooks). Run `graphify update .` (AST-only, no API cost) on the branch before each PR merges, per `.claude/CLAUDE.md`, and commit `graphify-out/` in that same PR, never a separate follow-up PR. If two branches conflict on `graphify-out/graph.json`, don't hand-merge: take either side and rerun `graphify update .`.
