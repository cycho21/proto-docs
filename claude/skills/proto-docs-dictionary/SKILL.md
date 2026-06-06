---
name: proto-docs-dictionary
description: Create, add, validate, and maintain Proto Docs word dictionaries for Claude local skills.
---

# Proto Docs Dictionary Management

Use this skill when creating a new `word-dictionary.json`, adding Dictionary entries, reviewing candidate entries, or updating the Dictionary baseline hash.

This skill is for Dictionary lifecycle work. For `.proto` comment editing and generated documentation validation, use `proto-docs-flow`.

## Assets

- `scripts/dictionary-manager.js`: Dictionary lifecycle CLI.
- Target Dictionary paths may be either:
  - this skill's own target path supplied by `--dictionary`, or
  - `claude/skills/proto-docs-flow/dictionary/word-dictionary.json` when maintaining the bundled Proto Docs flow Dictionary.

## Rules

- Do not invent domain meaning. Ask the user/domain owner for canonical descriptions when unclear.
- Dictionary lookup is `Message.field` first, then `field`.
- Prefer field-level entries such as `asset_key` for shared semantics.
- Add `Message.field` entries such as `TransferRequest.asset_key` only for message-specific overrides.
- If neither `Message.field` nor `field` exists, do not proceed with comment generation. Create a candidate and ask the user/domain owner for meaning.
- Prefer `add-candidate` before changing an approved Dictionary.
- Only use `add-approved` after explicit approval evidence exists; the script requires `--approval-manifest`.
- After approved Dictionary changes, run `validate` and then `hash --approval-manifest <path>` to update `word-dictionary.sha256`.
- If approval evidence is missing, the script must fail and remind the LLM to create a candidate or ask the user/domain owner.
- Keep entries UTF-8 JSON with stable two-space indentation.
- Required fields:
  - `term`
  - `scope`
  - `canonical_description`
  - `aliases`
  - `forbidden_aliases`
  - `allowed_contexts`
  - `approved_examples`
  - `status`
  - `version`
  - `owner`
  - `last_reviewed_at`
  - `visibility`

## Commands

Set a variable for readability:

```bash
SKILL=claude/skills/proto-docs-dictionary
FLOW_DICT=claude/skills/proto-docs-flow/dictionary/word-dictionary.json
FLOW_HASH=claude/skills/proto-docs-flow/dictionary/word-dictionary.sha256
FLOW_CANDIDATES=claude/skills/proto-docs-flow/dictionary/candidates
FLOW_APPROVAL=claude/skills/proto-docs-flow/dictionary/approval-manifest.sample.json
```

### Create a new empty Dictionary

```bash
node $SKILL/scripts/dictionary-manager.js init \
  --dictionary path/to/word-dictionary.json \
  --hash path/to/word-dictionary.sha256
```

### Add a candidate entry

Use this when approval is not complete yet. Prefer a field-level `--scope asset_key` when the meaning is shared across messages; use `--scope TransferRequest.asset_key` only for an override.

```bash
node $SKILL/scripts/dictionary-manager.js add-candidate \
  --candidates $FLOW_CANDIDATES \
  --scope Asset.material_id \
  --term material_id \
  --description "Internal key that identifies the asset material." \
  --owner @domain-owner \
  --aliases materialId \
  --forbidden-aliases "item id,token id" \
  --contexts "asset,material" \
  --examples "Internal key that identifies the asset material."
```

### Add an approved entry

Only use after explicit approval evidence exists. Prefer a field-level `--scope asset_key` when the meaning is shared across messages; use `--scope TransferRequest.asset_key` only for an override.

```bash
node $SKILL/scripts/dictionary-manager.js add-approved \
  --dictionary $FLOW_DICT \
  --approval-manifest $FLOW_APPROVAL \
  --scope Asset.material_id \
  --term material_id \
  --description "Internal key that identifies the asset material." \
  --owner @domain-owner \
  --aliases materialId \
  --forbidden-aliases "item id,token id" \
  --contexts "asset,material" \
  --examples "Internal key that identifies the asset material."
```

### Validate a Dictionary

```bash
node $SKILL/scripts/dictionary-manager.js validate \
  --dictionary $FLOW_DICT
```

### Update baseline hash

```bash
node $SKILL/scripts/dictionary-manager.js hash \
  --dictionary $FLOW_DICT \
  --hash $FLOW_HASH \
  --approval-manifest $FLOW_APPROVAL
```

## Review Checklist

Before reporting completion:

1. Candidate or approved entry has a clear owner.
2. `canonical_description` is not a synonym-only phrase.
3. `approved_examples` include the exact preferred comment text.
4. `forbidden_aliases` capture likely ambiguous or unsafe wording.
5. Approved Dictionary changes have approval manifest evidence and a refreshed hash.
6. `validate` passes.
