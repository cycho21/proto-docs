# Proto Docs Claude Code Plugin

Claude Code plugin for Proto Dictionary candidate generation, approved Dictionary promotion, Proto comment application, and mechanical guardrails.

## Contents

- `.claude-plugin/plugin.json`: Claude Code plugin manifest.
- `skills/`: Proto Docs skills.
- `commands/`: slash-command guidance for candidate generation, promotion, and comment application.
- `hooks/hooks.json`: PostToolUse hook registration.
- `hooks/*.js`: automatic guards for Proto files, approved Dictionary files, schemas, and candidates.
- `scripts/proto-docs/`: local CLI used by commands and hooks.
- `dictionary/`: schema contracts bundled with the plugin.

## Install

Install or enable this folder as a Claude Code plugin. From the repository root, start Claude Code with this plugin directory:

```bash
claude --plugin-dir ./claude-code-plugin/proto-docs
```

This loads the plugin manifest, including bundled commands, skills, and hooks.

The manifest is at:

```text
.claude-plugin/plugin.json
```

Once enabled, hooks are loaded from:

```text
hooks/hooks.json
```

## Project expectations

Target projects should contain:

```text
docs/dictionary/word-dictionary.json
docs/dictionary/word-dictionary.sha256
docs/dictionary/candidates/
```

The plugin provides scripts and schemas, but approved Dictionary data remains project-owned.

## Common commands

Generate candidates:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts generate-candidates --proto samples/proto/workflow --dictionary docs/dictionary/word-dictionary.json --candidates docs/dictionary/candidates
```

Validate candidates:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts validate-candidates --candidates docs/dictionary/candidates
```

Apply comments:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts apply-comments --proto path/to/file.proto --dictionary docs/dictionary/word-dictionary.json --out path/to/file.proto
```
