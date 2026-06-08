
# proto-docs 전체 리뷰 수정

## 목표
13개 이슈를 순서대로 수정하고 최종 재리뷰

## 체크리스트

### 🔴 버그
- [ ] #1 linter.ts — proto 이중 스캔 제거
- [ ] #2 cli.ts — guard-ast 자기비교 수정 (--before/--after 분리)
- [ ] #3 freshness.ts — temp 디렉토리 누수 (try/finally)
- [ ] #4 commentApplier.ts — CRLF 줄바꿈 보존
- [ ] #5 candidates.ts — promote: validate 먼저, write 나중

### 🟡 설계 리스크
- [ ] #6 dictionaryGuard.ts — 경로 매칭 path.resolve 정규화
- [ ] #7 linter.ts — Forbidden Alias / Semantic Drift 중복 → else if
- [ ] #8 candidates.ts — buildWordDictionary description 타입 불일치 리스크 문서화

### 🟠 성능
- [ ] #9 docGenerator.ts — domainGroupFiles statSync 제거
- [ ] #10 protoScanner.ts — readdirSync withFileTypes 사용

### 🔵 마이너
- [ ] #11 protoScanner.ts — 중복 조건 trimmed && 제거
- [ ] #12 cli.ts — protoPath 기본값 제거
- [ ] #13 freshness.ts — createDocGenerator 직접 사용

### 완료
- [ ] 재리뷰 및 커밋
