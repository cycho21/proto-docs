# Proto Docs Claude Hooks

This directory contains Claude Code hook assets that travel with the local skill.

## Files

- `settings.example.json`: example Claude Code hook configuration.
- `proto-docs-post-tool-use.js`: PostToolUse hook that runs skill-local `lint-comments` after `.proto` file edits.

## Install

Copy or merge `settings.example.json` into the target Claude Code settings file, or reference `proto-docs-post-tool-use.js` from an existing PostToolUse hook.

The hook intentionally runs only comment linting. Continue to run the full `verify` command documented in `../SKILL.md` before completion.
