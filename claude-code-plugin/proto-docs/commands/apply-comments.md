---
description: Apply approved Dictionary comments to Proto fields.
---

Apply approved Dictionary comments to a Proto file, then verify lint and AST safety.

## 동작 방식

- Dictionary에 매핑된 필드: `canonical_description` 을 `// comment` 로 삽입한다.
- Dictionary에 없는 필드: 조용히 skip한다. 주석을 생성하지 않으며 에러도 아니다.

skip된 필드는 이후 `lint-comments` 에서 `Missing Mapping` 으로 보고된다.
미매핑 필드가 있으면 먼저 `/generate-candidates` 로 candidate를 만들고 승인 후 promote한다.

## 실행

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts apply-comments \
  --proto <proto-path> \
  --dictionary .proto-docs/dictionary/word-dictionary.json \
  --out <proto-path>

node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts lint-comments \
  --proto <proto-path> \
  --dictionary .proto-docs/dictionary/word-dictionary.json
```

AST 체크는 hook이 자동으로 수행한다. 수동으로 실행하려면:

```bash
# proto 편집 전 HEAD 버전을 저장
git show HEAD:<relative-proto-path> > /tmp/before.proto

# 편집 후 비교
node ${CLAUDE_PLUGIN_ROOT}/scripts/proto-docs/src/cli.ts guard-ast \
  --before /tmp/before.proto \
  --after <proto-path>
```

## Rules

- approved Dictionary 텍스트만 사용한다.
- Proto 구조(field, message, service, RPC, 번호)를 변경하지 않는다.
- 미매핑 필드에 임의 주석을 발명하지 않는다.
