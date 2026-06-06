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

## 전체 Workflow

아래 흐름은 Dictionary 기반 Proto 주석 작성부터 검증, 문서 생성, 최신성 확인까지의 전체 로컬 workflow입니다.

<svg width="960" height="520" viewBox="0 0 960 520" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="workflow-title workflow-desc">
  <title id="workflow-title">Proto Docs 전체 Workflow</title>
  <desc id="workflow-desc">Proto 스캔, Dictionary 후보 생성, 주석 편집, AST 가드, 주석 린트, Dictionary 가드, 승인 증적, 문서 생성, 최신성 검사, verify까지 이어지는 workflow</desc>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#2563eb" />
    </marker>
    <style>
      .box { fill: #eff6ff; stroke: #2563eb; stroke-width: 2; rx: 12; }
      .guard { fill: #fff7ed; stroke: #ea580c; stroke-width: 2; rx: 12; }
      .approval { fill: #f0fdf4; stroke: #16a34a; stroke-width: 2; rx: 12; }
      .text { font: 14px sans-serif; fill: #0f172a; text-anchor: middle; dominant-baseline: middle; }
      .small { font: 12px sans-serif; fill: #475569; text-anchor: middle; dominant-baseline: middle; }
      .line { stroke: #2563eb; stroke-width: 2; fill: none; marker-end: url(#arrow); }
    </style>
  </defs>

  <rect x="30" y="40" width="150" height="64" class="box" />
  <text x="105" y="64" class="text">Proto 입력</text>
  <text x="105" y="84" class="small">samples/proto/*.proto</text>

  <rect x="230" y="40" width="150" height="64" class="box" />
  <text x="305" y="64" class="text">scan</text>
  <text x="305" y="84" class="small">용어/주석 검사</text>

  <rect x="430" y="40" width="150" height="64" class="box" />
  <text x="505" y="64" class="text">generate-candidates</text>
  <text x="505" y="84" class="small">누락 용어 후보</text>

  <rect x="630" y="40" width="150" height="64" class="box" />
  <text x="705" y="64" class="text">주석 편집</text>
  <text x="705" y="84" class="small">Dictionary 기준</text>

  <rect x="630" y="170" width="150" height="64" class="guard" />
  <text x="705" y="194" class="text">guard-ast</text>
  <text x="705" y="214" class="small">구조 변경 차단</text>

  <rect x="430" y="170" width="150" height="64" class="guard" />
  <text x="505" y="194" class="text">lint-comments</text>
  <text x="505" y="214" class="small">주석 품질 검사</text>

  <rect x="230" y="170" width="150" height="64" class="guard" />
  <text x="305" y="194" class="text">guard-dictionary</text>
  <text x="305" y="214" class="small">해시/승인 검사</text>

  <rect x="30" y="170" width="150" height="64" class="approval" />
  <text x="105" y="194" class="text">승인 증적</text>
  <text x="105" y="214" class="small">manifest provider</text>

  <rect x="30" y="300" width="150" height="64" class="box" />
  <text x="105" y="324" class="text">generate-docs</text>
  <text x="105" y="344" class="small">Buf/Markdown</text>

  <rect x="230" y="300" width="150" height="64" class="guard" />
  <text x="305" y="324" class="text">check-freshness</text>
  <text x="305" y="344" class="small">생성 문서 최신성</text>

  <rect x="430" y="300" width="150" height="64" class="approval" />
  <text x="505" y="324" class="text">verify</text>
  <text x="505" y="344" class="small">통합 검증</text>

  <rect x="630" y="300" width="150" height="64" class="box" />
  <text x="705" y="324" class="text">문서 산출물</text>
  <text x="705" y="344" class="small">docs/generated</text>

  <path d="M180 72 H230" class="line" />
  <path d="M380 72 H430" class="line" />
  <path d="M580 72 H630" class="line" />
  <path d="M705 104 V170" class="line" />
  <path d="M630 202 H580" class="line" />
  <path d="M430 202 H380" class="line" />
  <path d="M230 202 H180" class="line" />
  <path d="M105 234 V300" class="line" />
  <path d="M180 332 H230" class="line" />
  <path d="M380 332 H430" class="line" />
  <path d="M580 332 H630" class="line" />

  <text x="480" y="455" class="small">검증 명령: npm test → npm run proto-docs -- verify</text>
</svg>

## 문서

- CLI 사용법: [`docs/proto-docs/usage.md`](docs/proto-docs/usage.md)
- 에이전트 플로우: [`docs/proto-docs/agent-flow.md`](docs/proto-docs/agent-flow.md)
- 승인 정책: [`docs/proto-docs/approval-policy.md`](docs/proto-docs/approval-policy.md)
- 생성 문서 예시: [`docs/generated/proto-docs.md`](docs/generated/proto-docs.md)

## 네트워크 정책

이 CLI는 LLM API 또는 네트워크 서비스를 호출하지 않습니다. 승인 검증은 로컬 manifest provider만 사용합니다.
