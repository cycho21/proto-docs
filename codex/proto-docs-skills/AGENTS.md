# Codex Proto Docs Skill Instructions

When working on Proto documentation in this repository:

- Read `docs/proto-docs/usage.md`, `docs/proto-docs/agent-flow.md`, and `docs/proto-docs/approval-policy.md`.
- Treat `docs/dictionary/word-dictionary.json` as protected.
- Create missing semantic entries only under `docs/dictionary/candidates/`.
- Do not call LLM APIs, GitHub APIs, or network services.
- Do not add GitHub Actions workflow files for this implementation.
- Run `npm test` and `npm run proto-docs -- verify` before completion.

Reusable flow:

```text
scan -> generate-candidates -> comment edits -> guard-ast -> lint-comments -> guard-dictionary -> generate-docs -> check-freshness -> verify
```
