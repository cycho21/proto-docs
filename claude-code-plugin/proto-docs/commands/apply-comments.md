---
description: Apply approved Dictionary comments to Proto fields.
---

Apply approved Dictionary comments to a Proto file, then verify lint and AST safety.

Use:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts apply-comments --proto <proto-path> --dictionary .proto-docs/dictionary/word-dictionary.json --out <proto-path>
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts lint-comments --proto <proto-path> --dictionary .proto-docs/dictionary/word-dictionary.json
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts guard-ast --before <before-path> --after <proto-path>
```

Rules:

- Use only approved Dictionary text.
- Do not change Proto structure.
