---
description: Promote approved Dictionary candidate scopes into the approved Dictionary.
---

Promote only human-approved candidate scopes.

Use:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/proto-docs-dictionary/scripts/dictionary-manager.js promote-candidates \
  --candidates docs/dictionary/candidates \
  --dictionary docs/dictionary/word-dictionary.json \
  --approval-manifest docs/dictionary/approval-manifest.json

node ${CLAUDE_PLUGIN_ROOT}/skills/proto-docs-dictionary/scripts/dictionary-manager.js validate \
  --dictionary docs/dictionary/word-dictionary.json

node ${CLAUDE_PLUGIN_ROOT}/skills/proto-docs-dictionary/scripts/dictionary-manager.js hash \
  --dictionary docs/dictionary/word-dictionary.json \
  --hash docs/dictionary/word-dictionary.sha256 \
  --approval-manifest docs/dictionary/approval-manifest.json
```

Rules:

- `dictionaryChanges[].approvedScopes` must list every promoted scope.
- Field-level scopes should be promoted before message-specific overrides.
