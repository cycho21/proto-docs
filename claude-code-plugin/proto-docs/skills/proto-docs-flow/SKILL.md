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
- Create missing-field candidates only under `.proto-docs/dictionary/candidates/`.
- Change Proto comments only; never change field, message, service, RPC, option, or field number definitions.
- Do not call LLM APIs from repository scripts or hooks.
- Prefer the bundled plugin CLI over project-local scripts.

## Commands

Run from the repository root with the bundled plugin CLI.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts scan \
  --proto samples/proto/asset.proto

# generate-candidates 는 4단계 흐름을 따른다 — /generate-candidates 커맨드 참조
# 1. LLM 도메인 추론  2. CLI scaffold  3. LLM 설명 개선  4. 검토 요약 제시
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts generate-candidates \
  --proto samples/proto/unmapped.proto \
  --dictionary .proto-docs/dictionary/word-dictionary.json \
  --candidates .proto-docs/dictionary/candidates

node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts lint-comments \
  --proto samples/proto/asset.proto \
  --dictionary .proto-docs/dictionary/word-dictionary.json

# AST 체크: proto 편집 전 HEAD 버전을 저장하고 편집 후 비교
# (PostToolUse hook이 자동으로 수행함 — 수동 실행시만 필요)
git show HEAD:samples/proto/asset.proto > /tmp/asset-before.proto
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts guard-ast \
  --before /tmp/asset-before.proto \
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
5. Run `guard-ast` (--before HEAD 버전, --after 현재 파일) to ensure only comments changed. PostToolUse hook이 자동 수행하니 수동 실행은 필요 시에만.
6. Run `lint-comments` to validate comment wording against the Dictionary.
7. Run `guard-dictionary` if Dictionary files changed.
8. Run `verify` before reporting completion. verify는 lint / dictionary guard / freshness만 확인한다. AST는 guard-ast로 별도 실행한다.
