# Agent Flow for LLM-based Proto Documentation

## Shared flow

```text
Dictionary Skill
  -> Comment Skill
  -> Proto AST Guard
  -> Doc Comment Linter
  -> Dictionary Guard
  -> Human Approval Evidence
  -> Buf Doc Generation
  -> Freshness Check
```

## Agent rules

1. Agents must read `.proto-docs/dictionary/word-dictionary.json` as the semantic source of truth.
2. Agents must not edit `.proto-docs/dictionary/word-dictionary.json` directly.
3. Agents may create files under `.proto-docs/dictionary/candidates/` for missing terms.
4. Agents may edit Proto comments only.
5. Agents must run `npm run proto-docs -- verify` before reporting completion.
6. Agents must not call LLM APIs from this repository workflow.
7. Agents must not use GitHub API approval lookup in this implementation.

## Claude Code

Load the Claude Code plugin from `claude-code-plugin/proto-docs`.

```bash
claude --plugin-dir ./claude-code-plugin/proto-docs
```

Invoke `proto-docs-dictionary` when creating or maintaining Dictionary entries, and `proto-docs-flow` when generating or validating Proto comments.
