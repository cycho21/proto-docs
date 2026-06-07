---
name: proto-docs-flow
description: Generate and validate Proto documentation comments using an approved Dictionary without creating new semantics.
---

# Proto Docs Flow

Use this skill when working on `.proto` comments or generated Proto documentation.

This skill is packaged inside the Proto Docs Claude Code plugin. Runtime assets live at the plugin root:

- `${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/`: local validation and documentation CLI
- `${CLAUDE_PLUGIN_ROOT}/hooks/`: Claude Code hook guardrails
- `.proto-docs/dictionary/`: target-project approved Dictionary, baseline hash, and candidate entries

## Rules

- Treat `.proto-docs/dictionary/word-dictionary.json` in the target project as the approved semantic source.
- Resolve Dictionary entries in this order: first `Message.field`, then `field`.
- Use field-level entries for shared semantics, and `Message.field` entries only when a message-specific override is needed.
- If neither `Message.field` nor `field` exists, stop. Do not invent a comment. Ask the user/domain owner for meaning or create a candidate under `.proto-docs/dictionary/candidates/`.
- Reuse existing approved Dictionary entries. Do not regenerate or submit the full Dictionary for re-approval.
- Do not edit `.proto-docs/dictionary/word-dictionary.json` directly.
- Create missing-term candidates only under `.proto-docs/dictionary/candidates/`.
- Change Proto comments only; never change field, message, service, RPC, option, or field number definitions.
- Do not call LLM APIs from repository scripts or hooks.
- Prefer the bundled plugin CLI over project-local scripts.

## Commands

Run from the repository root with the bundled plugin CLI.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts scan \
  --proto samples/proto/asset.proto

node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts generate-candidates \
  --proto samples/proto/unmapped.proto \
  --dictionary .proto-docs/dictionary/word-dictionary.json \
  --candidates .proto-docs/dictionary/candidates

node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts lint-comments \
  --proto samples/proto/asset.proto \
  --dictionary .proto-docs/dictionary/word-dictionary.json

node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts guard-ast \
  --before samples/proto/asset.proto \
  --after samples/proto/asset.proto

node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts guard-dictionary \
  --dictionary .proto-docs/dictionary/word-dictionary.json \
  --dictionary-baseline-hash .proto-docs/dictionary/word-dictionary.sha256

node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts verify \
  --proto samples/proto/asset.proto \
  --dictionary .proto-docs/dictionary/word-dictionary.json \
  --candidates .proto-docs/dictionary/candidates \
  --dictionary-baseline-hash .proto-docs/dictionary/word-dictionary.sha256
```

## Flow

1. Run `scan` to inspect the target Proto.
2. For each field, look up `Message.field`; if absent, look up `field`.
3. If both mappings are absent, do not proceed with comment generation for that field. Run `generate-candidates` and ask the user/domain owner for the intended meaning.
4. Add or update comments using only canonical descriptions or approved examples.
5. Run `guard-ast` to ensure only comments changed.
6. Run `lint-comments` to validate comment wording against the Dictionary.
7. Run `guard-dictionary` if Dictionary files changed.
8. Run `verify` before reporting completion.
