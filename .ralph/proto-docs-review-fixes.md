
# proto-docs 전체 리뷰 수정

## 목표
13개 이슈를 순서대로 수정하고 최종 재리뷰

## 체크리스트

### 🔴 버그
- [x] #1 linter.ts — proto 이중 스캔 제거
- [x] #2 cli.ts — guard-ast 자기비교 수정 (--before/--after 분리)
- [x] #3 freshness.ts — temp 디렉토리 누수 (try/finally)
- [x] #4 commentApplier.ts — CRLF 줄바꿈 보존
- [x] #5 candidates.ts — promote: validate 먼저, write 나중

### 🟡 설계 리스크
- [x] #6 dictionaryGuard.ts — 경로 매칭 path.resolve 정규화
- [x] #7 linter.ts — Forbidden Alias / Semantic Drift 중복 → else if
- [x] #8 candidates.ts — buildWordDictionary description 타입 불일치 리스크 문서화

### 🟠 성능
- [x] #9 docGenerator.ts — domainGroupFiles statSync 제거
- [x] #10 protoScanner.ts — readdirSync withFileTypes 사용

### 🔵 마이너
- [x] #11 protoScanner.ts — 중복 조건 trimmed && 제거
- [x] #12 cli.ts — protoPath 기본값 제거
- [x] #13 freshness.ts — createDocGenerator 직접 사용

### 완료
- [x] 재리뷰 및 커밋 (666a117)

## 재리뷰에서 발견된 신규 이슈 (미수정)
- N1. protoScanner.ts — oneof 블록 미처리 (🔴 버그)
- N2. candidates.ts — writeCandidates write→validate 순서 (🔴 버그)
- N3. linter.ts — findMissingMappings(null, ...) 호출 냄새 (🟡 설계)
- N4. cli.ts — arg() 경계 미검증 (🔵 마이너)
