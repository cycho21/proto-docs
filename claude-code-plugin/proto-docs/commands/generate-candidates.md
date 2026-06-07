---
description: Generate Proto Docs Dictionary candidates for a proto path.
---

Generate candidates for the requested Proto path.

Use:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts generate-candidates --proto <proto-path> --dictionary docs/dictionary/word-dictionary.json --candidates docs/dictionary/candidates
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts validate-candidates --candidates docs/dictionary/candidates
```

Rules:

- Create `docs/dictionary/candidates/word-dictionary.json` first.
- Create message candidates under `docs/dictionary/candidates/messages/`.
- Do not edit `docs/dictionary/word-dictionary.json` directly.
