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

Candidate 생성은 `/generate-candidates` 커맨드를 따른다. 핵심 원칙:

1. **CLI 실행 전** proto 파일을 읽고 패키지명 / 서비스 / 메시지 구조를 바탕으로 도메인을 먼저 추론한다.
2. CLI는 구조(field_name, scope, aliases 등) scaffold와 placeholder 설명을 생성한다.
3. LLM이 placeholder(`~ value.` 패턴) 설명을 도메인 맥락에 맞는 예제적 표현으로 직접 재작성한다.
4. `canonical_description` 을 바꿀 때는 반드시 `approved_examples` 도 `[새 canonical_description]` 으로 동기화한다.
5. 메시지 맥락이 필드 의미를 바꾸는 경우에만 `message_dictionary_override` 를 사용한다.
6. 승인된 `word-dictionary.json` 을 직접 편집하지 않는다.
7. Mechanical hooks/scripts는 shape/schema만 검증한다. 도메인 의미는 LLM이 판단한다.

message-specific override 프로모트:

```bash
npm run proto-docs -- promote-candidate-override -- \
  --candidates .proto-docs/dictionary/candidates \
  --message <MessageName> --field <field_name>
```

## Natural-language candidate review UX

When the user asks to review candidates, do not dump every candidate scope and ask the user to pick from a long list. First run the compact grouped review:

```bash
npm run proto-docs -- review-candidates -- --candidates .proto-docs/dictionary/candidates
```

Use `--detailed` only when the user asks to inspect every pending field group:

```bash
npm run proto-docs -- review-candidates -- --candidates .proto-docs/dictionary/candidates --detailed
```

Present the compact result in three groups:

1. Field-level defaults batch: common field scopes that can be approved together when their shared meaning is acceptable.
2. Message-specific overrides already promoted: `Message.field` scopes that will be merged only if approval evidence includes them.
3. Pending message review by field: grouped message usages that should remain pending unless the user explicitly says the message context changes the meaning.

Ask for approval in batches, for example: “Approve the field-level defaults batch, hold back these scopes, and name only the Message.field overrides to promote.” Do not require the user to inspect every `candidates/messages/*.json` file.

## Mechanical validation

Run after creating or editing candidates:

```bash
npm run proto-docs -- validate-candidates -- --candidates .proto-docs/dictionary/candidates
```

Promote a message-specific override only after LLM/domain review determines the message context changes the meaning:

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
