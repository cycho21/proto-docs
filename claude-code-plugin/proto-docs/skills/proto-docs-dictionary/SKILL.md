---
name: proto-docs-dictionary
description: Create, validate, review, and promote Proto Docs dictionary candidates without bypassing approval.
---

# Proto Docs Dictionary Management

Use this skill when creating Dictionary candidates, reviewing candidate entries, promoting approved candidate scopes into `word-dictionary.json`, or updating the Dictionary baseline hash.

## Candidate model

Generate candidates in two layers:

1. Global field-level Dictionary candidate
   - Path: `.proto-docs/dictionary/candidates/word-dictionary.json`
   - Contains one entry per distinct Proto field name.
   - Example: `asset_key` defines the general/original meaning of `asset_key` across messages.

2. Message-level Dictionary candidates
   - Path: `.proto-docs/dictionary/candidates/messages/<MessageName>.json`
   - Contains a `fields` list for the message.
   - Each field uses the global `word-dictionary` entry by default.
   - Example: `SettlementLine.asset_key` uses `asset_key` unless the message context changes the meaning.

## LLM writing rules

- The LLM skill writes draft descriptions and suggests `inference.candidate_override` values.
- Mechanical hooks/scripts validate shape/schema only; they do not decide domain meaning.
- Keep `message_dictionary_override` as `null` unless LLM/domain review determines the message changes the field meaning.
- If an override is needed, promote the reviewed override entry from `inference.candidate_override` to `message_dictionary_override` with `npm run proto-docs -- promote-candidate-override -- --candidates .proto-docs/dictionary/candidates --message <MessageName> --field <field_name>`.
- Do not edit approved `word-dictionary.json` directly without approval evidence.

## Mechanical validation

Run after creating or editing candidates:

```bash
npm run proto-docs -- validate-candidates -- --candidates .proto-docs/dictionary/candidates
```

Promote a message-specific override only after LLM/domain review determines the message context changes the field meaning:

```bash
npm run proto-docs -- promote-candidate-override -- --candidates .proto-docs/dictionary/candidates --message SettlementLine --field asset_key
```

The candidate hook also runs this check after candidate file edits.

## Promotion to approved Dictionary

Only after human/domain approval, promote approved scopes from candidates:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/proto-docs-dictionary/scripts/dictionary-manager.js promote-candidates \
  --candidates .proto-docs/dictionary/candidates \
  --dictionary .proto-docs/dictionary/word-dictionary.json \
  --approval-manifest .proto-docs/dictionary/approval-manifest.json
```

Rules:

- `dictionaryChanges[].approvedScopes` controls exactly which candidate scopes may be promoted.
- Field-level scopes such as `asset_key` should be approved before message-specific overrides.
- Message-specific scopes such as `SettlementLine.asset_key` should be approved only when the message context changes the meaning.
- After promotion, run `validate` and `hash` with the same approval manifest.

## Allowed

- Read `.proto-docs/dictionary/word-dictionary.json`.
- Run `npm run proto-docs -- generate-candidates -- --proto <path>`.
- Run `npm run proto-docs -- validate-candidates -- --candidates .proto-docs/dictionary/candidates`.
- Create or update `.proto-docs/dictionary/candidates/word-dictionary.json` and files under `.proto-docs/dictionary/candidates/messages/`.
- Promote approved candidate scopes using `dictionary-manager.js promote-candidates` with approval evidence.

## Forbidden

- Directly edit `.proto-docs/dictionary/word-dictionary.json` without approval evidence.
- Split message fields into separate `Message.field.json` candidate files.
- Treat generated candidate descriptions as approved Dictionary text without human approval.
- Promote scopes not listed in `dictionaryChanges[].approvedScopes`.
