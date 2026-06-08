---
description: Promote approved Dictionary candidate scopes into the approved Dictionary.
---

Promote only human-approved candidate scopes.

## Step 1 — approval manifest 작성

promote 전에 반드시 approval manifest 파일을 만든다.

`.proto-docs/dictionary/approval-manifest.json` 예시:

```json
{
  "dictionaryChanges": [
    {
      "path": ".proto-docs/dictionary/word-dictionary.json",
      "approvedBy": "@your-name",
      "reason": "Initial dictionary setup for order domain",
      "approvedAt": "2024-01-15",
      "approvedScopes": [
        "order_id",
        "status",
        "amount",
        "SettlementLine.asset_key"
      ]
    }
  ]
}
```

- `approvedScopes`: promote 할 scope만 열거한다. 목록 외 scope는 차단된다.
- Field-level scope (`order_id`) 를 message-level scope (`SettlementLine.asset_key`) 보다 먼저 승인한다.

## Step 2 — promote 실행

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/proto-docs-dictionary/scripts/dictionary-manager.js promote-candidates \
  --candidates .proto-docs/dictionary/candidates \
  --dictionary .proto-docs/dictionary/word-dictionary.json \
  --approval-manifest .proto-docs/dictionary/approval-manifest.json
```

placeholder 설명(`~ value.` 패턴)이 있는 항목은 기본적으로 차단된다.
설명을 개선하지 않고 강제로 promote 하려면 `--allow-placeholder` 를 추가한다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/proto-docs-dictionary/scripts/dictionary-manager.js promote-candidates \
  --allow-placeholder \
  --candidates .proto-docs/dictionary/candidates \
  --dictionary .proto-docs/dictionary/word-dictionary.json \
  --approval-manifest .proto-docs/dictionary/approval-manifest.json
```

## Step 3 — validate 및 hash 갱신

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/proto-docs-dictionary/scripts/dictionary-manager.js validate \
  --dictionary .proto-docs/dictionary/word-dictionary.json

node ${CLAUDE_PLUGIN_ROOT}/skills/proto-docs-dictionary/scripts/dictionary-manager.js hash \
  --dictionary .proto-docs/dictionary/word-dictionary.json \
  --hash .proto-docs/dictionary/word-dictionary.sha256 \
  --approval-manifest .proto-docs/dictionary/approval-manifest.json
```

## Rules

- `dictionaryChanges[].approvedScopes` 에 없는 scope 는 promote 되지 않는다.
- Field-level scope 를 message-level override 보다 먼저 promote 한다.
- placeholder 설명은 promote 전에 도메인에 맞게 재작성하는 것을 권장한다.
