# Proto Docs Claude Hooks

This directory contains Claude Code hook assets that travel with the local skill.

## Files

- `settings.example.json`: example Claude Code hook configuration.
- `proto-docs-post-tool-use.js`: PostToolUse hook that runs skill-local `lint-comments` and, when possible, `guard-ast` after `.proto` file edits.
- `proto-docs-dictionary-post-tool-use.js`: PostToolUse hook that validates approved Dictionary edits and blocks mismatched baseline hashes.

## Install

Copy or merge `settings.example.json` into the target Claude Code settings file, or reference `proto-docs-post-tool-use.js` from an existing PostToolUse hook.

Hooks are local reminders and guardrails for the LLM. They intentionally fail with `[PROTO DOCS REMINDER]` messages when the agent must repair behavior instead of inventing semantics.

Continue to run the full `verify` command documented in `../SKILL.md` before completion.
