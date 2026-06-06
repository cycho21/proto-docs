# Proto Docs

Proto Docs는 Proto 주석을 승인된 Dictionary 기준으로 검증하고, 문서 생성 및 최신성 검사를 수행하는 로컬 CLI 프로젝트입니다.

## 주요 기능

- Proto 주석 린트
- Proto AST 변경 가드
- Dictionary 해시 및 승인 증적 검증
- 누락된 Dictionary 후보 생성
- Proto 문서 생성
- 생성 문서 최신성 검사

## 요구 사항

- Node.js
- npm
- 선택 사항: `buf` (`generate-docs --generator buf` 사용 시 필요)

## 설치

```bash
npm install
```

## 사용법

저장소 루트에서 실행합니다.

```bash
npm run proto-docs -- verify
npm run proto-docs -- scan --proto samples/proto/asset.proto
npm run proto-docs -- generate-candidates --proto samples/proto/unmapped.proto
npm run proto-docs -- lint-comments
npm run proto-docs -- guard-ast --before samples/proto/asset.proto --after samples/proto/asset.proto
npm run proto-docs -- guard-dictionary
npm run proto-docs -- generate-docs --generator buf
npm run proto-docs -- check-freshness
```

샘플 검증:

```bash
npm test
npm run proto-docs -- verify
```

`buf` 없이 결정적 샘플 문서를 생성하려면 다음을 사용합니다.

```bash
npm run proto-docs -- generate-docs -- --generator markdown-sample
```

## 개발 모델

Proto Docs는 LLM을 “의미 후보 생성과 주석 작성”에만 사용하고, 의미 확정은 사용자 승인으로, 최종 문서 생성은 결정론적 코드로 분리합니다.

![의미 통제 모델](docs/assets/proto-docs-semantic-control.svg)

![책임 분리](docs/assets/proto-docs-responsibility-split.svg)

![산출물 흐름](docs/assets/proto-docs-artifact-flow.svg)

## 전체 Workflow

아래 흐름은 Dictionary 기반 Proto 주석 작성부터 검증, 문서 생성, 최신성 확인까지의 전체 로컬 workflow입니다.

![Proto Docs 전체 Workflow](docs/assets/proto-docs-workflow.svg)

## 문서

- CLI 사용법: [`docs/proto-docs/usage.md`](docs/proto-docs/usage.md)
- 에이전트 플로우: [`docs/proto-docs/agent-flow.md`](docs/proto-docs/agent-flow.md)
- 승인 정책: [`docs/proto-docs/approval-policy.md`](docs/proto-docs/approval-policy.md)
- 생성 문서 예시: [`docs/generated/proto-docs.md`](docs/generated/proto-docs.md)

## 네트워크 정책

이 CLI는 LLM API 또는 네트워크 서비스를 호출하지 않습니다. 승인 검증은 로컬 manifest provider만 사용합니다.
