---
description: Generate Proto Docs Dictionary candidates for a proto path.
---

Generate candidates for the requested Proto path.

Use:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts generate-candidates --proto <proto-path> --dictionary .proto-docs/dictionary/word-dictionary.json --candidates .proto-docs/dictionary/candidates
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts validate-candidates --candidates .proto-docs/dictionary/candidates
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts review-candidates --candidates .proto-docs/dictionary/candidates
```

Rules:

- Create `.proto-docs/dictionary/candidates/word-dictionary.json` first.
- Create message candidates under `.proto-docs/dictionary/candidates/messages/`.
- Do not edit `.proto-docs/dictionary/word-dictionary.json` directly.
