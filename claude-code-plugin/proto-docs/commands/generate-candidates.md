---
description: Generate Proto Docs Dictionary candidates for a proto path.
---

Generate candidates for the requested Proto path.

## Step 1 — 도메인 추론 (LLM)

CLI를 실행하기 전에 먼저 proto 파일을 직접 읽고 도메인 맥락을 파악한다.

다음 항목을 추론하라:

- **패키지/서비스 목적**: `package` 와 `service` 이름이 어떤 비즈니스 도메인인지
- **메시지 역할**: 각 메시지가 요청/응답/엔티티/이벤트 중 무엇인지, 어떤 비즈니스 개념을 나타내는지
- **필드 의미**: 필드명 + 타입 + 메시지 맥락을 결합해 각 필드의 실제 비즈니스 의미를 추론
- **도메인 어휘**: 이 proto에서 반복되는 개념 (예: `tenant`, `warehouse`, `transfer`)을 식별하고 용어 정의

추론 결과를 내부적으로 정리한 뒤 Step 2로 넘어간다.

## Step 2 — scaffold 생성 (CLI)

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts generate-candidates \
  --proto <proto-path> \
  --dictionary .proto-docs/dictionary/word-dictionary.json \
  --candidates .proto-docs/dictionary/candidates

node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts validate-candidates \
  --candidates .proto-docs/dictionary/candidates
```

CLI는 구조(field_name, scope, aliases 등)와 placeholder 설명을 생성한다.

## Step 3 — 설명 개선 (LLM)

생성된 candidates 파일을 읽고, `canonical_description` 이 placeholder 패턴(`~ value.` 형태)인 항목을 Step 1의 도메인 추론 결과를 바탕으로 직접 재작성한다.

좋은 설명의 기준:
- 필드가 이 도메인에서 **무엇을 의미하는지** 한 문장으로 설명
- `"Code value."` → `"Unique code identifying the product variant within the warehouse."` 처럼 구체적으로
- 다른 proto/서비스에서 재사용될 수 있는 수준의 일반성 유지
- 마침표로 끝나는 완전한 문장

`word-dictionary.json` 의 각 항목과 필요한 경우 `messages/*.json` 의 `inference.candidate_override.canonical_description` 도 개선한다.

**반드시**: `canonical_description` 을 바꿀 때는 `approved_examples` 도 함께 `[새 canonical_description]` 으로 업데이트한다. 두 값이 다르면 linter에 구멍이 생긴다.

개선 후 검증:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts validate-candidates \
  --candidates .proto-docs/dictionary/candidates
```

## Step 4 — 검토 요약 제시

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts review-candidates \
  --candidates .proto-docs/dictionary/candidates
```

결과를 사용자에게 요약 제시한다. 설명이 도메인에 맞는지, 재검토가 필요한 항목이 있는지 의견을 덧붙인다.

## Rules

- CLI 실행 전에 반드시 도메인 추론을 먼저 수행한다.
- placeholder 설명(`~ value.` 패턴)은 반드시 재작성한다. 그대로 두지 않는다.
- `.proto-docs/dictionary/word-dictionary.json` 을 직접 편집하지 않는다.
- 메시지 맥락이 필드 의미를 바꾸는 경우에만 `message_dictionary_override` 를 사용한다.
