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

1. Agents must read `docs/dictionary/word-dictionary.json` as the semantic source of truth.
2. Agents must not edit `docs/dictionary/word-dictionary.json` directly.
3. Agents may create files under `docs/dictionary/candidates/` for missing terms.
4. Agents may edit Proto comments only.
5. Agents must run `npm run proto-docs -- verify` before reporting completion.
6. Agents must not call LLM APIs from this repository workflow.
7. Agents must not use GitHub API approval lookup in this implementation.

## Claude Code

Install or copy the common skill under `claude/skills/proto-docs-flow/SKILL.md`. Invoke the skill when generating or validating Proto comments.

## Pi

Pi can read the same `SKILL.md` shape. The repository also includes `.pi/skills/proto-docs-flow/SKILL.md` for local project use.

## Codex

Codex reads `AGENTS.md` instructions. Use `codex/proto-docs-skills/AGENTS.md` as the reusable flow reference or copy its contents into the project-level `AGENTS.md` when enabling this workflow for Codex sessions.
