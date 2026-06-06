---
name: proto-docs-flow
description: Generate and validate Proto documentation comments using an approved Dictionary without creating new semantics.
---

# Proto Docs Flow

Use this skill when working on `.proto` comments or generated Proto documentation.

## Rules

- Treat `docs/dictionary/word-dictionary.json` as the only approved semantic source.
- Do not edit `docs/dictionary/word-dictionary.json` directly.
- Create missing-term candidates only under `docs/dictionary/candidates/`.
- Change Proto comments only; never change field, message, service, RPC, option, or field number definitions.
- Do not call LLM APIs from repository scripts.

## Flow

1. Run `npm run proto-docs -- scan` to inspect the target Proto.
2. Run `npm run proto-docs -- generate-candidates -- --proto <path>` for missing terms.
3. Add or update comments using only canonical descriptions or approved examples.
4. Run `npm run proto-docs -- guard-ast -- --before <before> --after <after>`.
5. Run `npm run proto-docs -- lint-comments -- --proto <path>`.
6. Run `npm run proto-docs -- verify` before reporting completion.
