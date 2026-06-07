# LLM 기반 Proto 문서화 시스템 설계

## 1. 목표

Proto 문서화를 자동화하되, LLM의 추론으로 인해 잘못된 도메인 의미가 문서에 반영되는 것을 방지한다.

핵심 목표는 다음과 같다.

* Proto 구조 변경을 문서에 자동 반영한다.
* 도메인 의미는 승인된 Dictionary에서만 가져온다.
* LLM은 의미를 생성하지 않고, 승인된 의미를 주석 문장으로 표현한다.
* 문서 생성은 결정론적 도구로 수행한다.
* Dictionary 변경은 반드시 인간 승인을 거친다.
* CI는 승인되지 않은 의미 변경과 문서 불일치를 차단한다.

---

## 2. 핵심 원칙

```text
Meaning
    ↓
Dictionary

Comment
    ↓
LLM

Validation
    ↓
Rule-based Linter / Guard

Approval
    ↓
Human

Rendering
    ↓
Deterministic Generator
```

운영 원칙:

* 의미의 Single Source of Truth는 `Dictionary`이다.
* LLM output은 항상 검증 대상이다.
* Renderer는 의미를 만들지 않는다.
* Dictionary는 인간 승인 없이 변경될 수 없다.
* Proto의 주석 변경은 Proto descriptor를 변경해서는 안 된다.
* 신규 의미는 바로 Dictionary에 추가하지 않고 Candidate로만 제안한다.

---

## 3. 전체 아키텍처

시스템은 세 계층으로 분리한다.

```text
Semantic Layer
  - Word Dictionary
  - Candidate Dictionary
  - Human Approval

Generation Layer
  - Proto Parser
  - Dictionary Resolver
  - Comment Skill
  - Doc Renderer

Validation Layer
  - Proto AST Guard
  - Doc Comment Linter
  - Dictionary Guard
  - Generated Docs Freshness Check
```

전체 흐름:

```text
Proto Change
    ↓
Proto Parser
    ↓
Dictionary Resolver
    ↓
Missing Term Detector
    ↓
Candidate Generator
    ↓
Comment Skill
    ↓
Proto AST Guard
    ↓
Doc Comment Linter
    ↓
Dictionary Guard
    ↓
Human Approval Check
    ↓
Deterministic Doc Generation
    ↓
Generated Docs Freshness Check
    ↓
Publish
```

---

## 4. 컴포넌트

### 4.1 Dictionary Skill

#### 역할

도메인 용어를 수집, 정규화, 검증 가능한 계약으로 관리한다.

#### 책임

* 신규 용어 탐지
* Alias 관리
* Canonical Description 관리
* 금지 표현 관리
* 용어 충돌 검출
* field_name scope 판단 보조
* candidate 생성

#### 금지

* 승인된 Dictionary 직접 수정
* canonical description 임의 변경
* alias 임의 추가/삭제
* Dictionary field_name 삭제

Dictionary Skill은 변경 후보를 생성할 수 있지만, 승인된 Dictionary를 직접 수정하지 않는다.

---

### 4.2 Comment Skill

#### 역할

Dictionary를 기반으로 Proto 주석을 생성한다.

#### 입력

* Proto AST 또는 descriptor
* Existing comments
* Approved Word Dictionary
* Candidate Dictionary

#### 출력

주석 변경만 포함된 patch.

#### 허용

* leading comment 추가
* leading comment 수정
* trailing comment 추가
* TODO comment 생성

#### 금지

* package 변경
* import 변경
* option 변경
* message 정의 변경
* enum 정의 변경
* service 정의 변경
* rpc 정의 변경
* field 이름/type/number 변경
* reserved 변경
* Dictionary 직접 변경
* Dictionary에 없는 의미 추론

#### 출력 계약

Comment Skill의 patch는 적용 전후 Proto descriptor가 동일해야 한다.

```text
descriptor(before proto without comments)
    ==
descriptor(after proto without comments)
```

즉, 주석 외의 모든 Proto 구조는 변경되면 안 된다.

---

### 4.3 Doc Comment Linter

#### 역할

LLM이 생성한 주석이 Dictionary와 정책을 준수하는지 검사한다.

#### 기본 방향

가능한 한 LLM 판단이 아니라 규칙 기반으로 검사한다.

Semantic Drift 검출은 자유로운 의미 비교 대신 다음 규칙을 우선한다.

```text
주석은 해당 field_name의 canonical_description 또는 approved example 중 하나를 포함해야 한다.
```

---

### 4.4 Proto AST Guard

#### 역할

Comment Skill이 Proto 구조를 변경하지 않았는지 검증한다.

#### 검사 방식

1. 변경 전 Proto descriptor 생성
2. 변경 후 Proto descriptor 생성
3. source location/comment를 제외한 descriptor 비교
4. 차이가 있으면 Fail

#### Fail 예시

* field number 변경
* field type 변경
* rpc request/response 변경
* message/enum/service 추가 또는 삭제
* option 변경

---

### 4.5 Dictionary Guard

#### 역할

LLM 또는 자동화 도구가 승인된 Dictionary를 직접 수정하지 못하도록 보호한다.

#### 정책

LLM 가능:

* Dictionary candidate 생성
* TODO 생성
* 누락 field_name 보고

LLM 불가:

* canonical description 수정
* alias 수정
* forbidden alias 수정
* Dictionary 삭제
* Dictionary 직접 변경

#### 권장 경로 정책

```text
/.proto-docs/dictionary/word-dictionary.json       인간 승인 필수
/.proto-docs/dictionary/candidates/*.json          LLM 생성 허용
/.proto-docs/dictionary/history/*.json             시스템 기록
```

---

### 4.6 Doc Renderer

#### 역할

Proto와 승인된 주석을 입력으로 받아 문서를 결정론적으로 생성한다.

#### 원칙

* Renderer는 의미를 추가하지 않는다.
* Renderer는 Dictionary를 해석해 새 설명을 만들지 않는다.
* Renderer output은 입력 Proto/comment에 의해 결정되어야 한다.

#### 권장 도구

##### Buf Docs

장점:

* 결정론적
* CI 친화적
* Proto 구조 자동 반영
* gRPC 문서화에 적합

##### protoc-gen-doc

장점:

* 단순
* 의존성 적음
* 정적 문서 생성에 적합

---

## 5. Dictionary Schema

Dictionary는 단순 용어집이 아니라 의미 계약이다.

예시:

```json
{
  "owner_key": {
    "field_name": "owner_key",
    "scope": "global",
    "canonical_description": "Internal key that identifies an owner.",
    "aliases": [
      "ownerKey"
    ],
    "forbidden_aliases": [
      "user id",
      "wallet address",
      "account id"
    ],
    "allowed_contexts": [
      "asset",
      "ownership"
    ],
    "approved_examples": [
      "Internal key that identifies an owner."
    ],
    "status": "approved",
    "version": 1,
    "owner": "@domain-owner",
    "last_reviewed_at": "2026-06-06"
  },
  "Asset.owner_key": {
    "field_name": "owner_key",
    "scope": "Asset.owner_key",
    "canonical_description": "Internal key that identifies the asset owner.",
    "aliases": [],
    "forbidden_aliases": [
      "user id",
      "wallet address"
    ],
    "allowed_contexts": [
      "asset"
    ],
    "approved_examples": [
      "Internal key that identifies the asset owner."
    ],
    "status": "approved",
    "version": 1,
    "owner": "@domain-owner",
    "last_reviewed_at": "2026-06-06"
  }
}
```

필수 필드:

| 필드 | 설명 |
|---|---|
| `field_name` | 실제 proto field 이름 |
| `scope` | `global` 또는 `Message.field` |
| `canonical_description` | 승인된 표준 설명 |
| `aliases` | 허용되는 대체 표현 |
| `forbidden_aliases` | 문서에 사용하면 안 되는 표현 |
| `approved_examples` | 허용된 주석 예시 |
| `status` | `approved`, `pending`, `deprecated` |
| `version` | 의미 계약 버전 |
| `owner` | 의미 책임자 |

---

## 6. Term Scoping Policy

같은 field 이름이라도 message에 따라 의미가 다를 수 있으므로 scope 정책이 필요하다.

정책:

1. 기본 매핑은 `Message.field` 단위로 한다.
2. 여러 메시지에서 완전히 같은 의미로 반복되는 경우에만 `global` field_name으로 승격한다.
3. 같은 field 이름이라도 message가 다르면 다른 의미일 수 있다.
4. `global` field_name과 scoped field_name이 모두 존재하면 scoped field_name이 우선한다.
5. scope 충돌이 발생하면 Candidate로 생성하고 인간 검토를 요구한다.

예시:

```proto
message Asset {
  string owner_key = 1;
}

message Guild {
  string owner_key = 1;
}
```

가능한 해석:

```text
Asset.owner_key  → asset owner 의미
Guild.owner_key  → guild owner 의미
owner_key        → 공통 owner identifier 의미
```

우선순위:

```text
Message.field
  > Message-level field_name
  > global field_name
```

---

## 7. Candidate Workflow

### 7.1 신규 용어 발견

예:

```proto
message FusionRequest {
  string fusion_material_id = 1;
}
```

Dictionary에 `FusionRequest.fusion_material_id` 또는 `fusion_material_id`가 없으면 Missing Mapping으로 판단한다.

---

### 7.2 Candidate 생성

LLM 또는 자동화 도구는 승인된 Dictionary를 수정하지 않고 candidate 파일만 생성한다.

경로:

```text
/.proto-docs/dictionary/candidates/fusion_material_id.json
```

예시:

```json
{
  "field_name": "fusion_material_id",
  "scope": "FusionRequest.fusion_material_id",
  "status": "pending_human_review",
  "suggested_description": "TODO: Human review required",
  "evidence": {
    "file": "proto/fusion.proto",
    "message": "FusionRequest",
    "field": "fusion_material_id",
    "field_type": "string"
  },
  "detected_at": "2026-06-06"
}
```

---

### 7.3 Human Approval Checklist

승인자는 다음을 확인한다.

* 기존 field_name과 중복되지 않는가
* global field_name인지 scoped field_name인지 적절한가
* canonical description이 도메인 의미를 정확히 담는가
* alias가 기존 field_name과 충돌하지 않는가
* forbidden alias가 충분한가
* 공개 문서에 노출 가능한 의미인가
* deprecated field_name과 충돌하지 않는가
* owner가 지정되어 있는가

---

### 7.4 Dictionary 반영

승인 후 candidate를 Dictionary에 merge한다.

예:

```json
{
  "FusionRequest.fusion_material_id": {
    "field_name": "fusion_material_id",
    "scope": "FusionRequest.fusion_material_id",
    "canonical_description": "Identifier of a material consumed during fusion.",
    "aliases": [],
    "forbidden_aliases": [
      "item id",
      "asset id"
    ],
    "approved_examples": [
      "Identifier of a material consumed during fusion."
    ],
    "status": "approved",
    "version": 1,
    "owner": "@domain-owner",
    "last_reviewed_at": "2026-06-06"
  }
}
```

---

## 8. Linter Rule Matrix

| Rule | 설명 | Local Mode | Pull Request Mode | Main Branch Mode |
|---|---|---:|---:|---:|
| Missing Mapping | Proto field에 대응되는 Dictionary field_name 없음 | Warning + candidate | Fail | Fail |
| Forbidden Alias | 주석에 금지 표현 포함 | Fail | Fail | Fail |
| Unknown Semantic | canonical/approved example과 무관한 의미 사용 | Fail | Fail | Fail |
| Semantic Drift | 동일 field_name에 서로 다른 의미 설명 사용 | Fail | Fail | Fail |
| Missing Comment | 공개 proto에 주석 없음 | Warning | Fail 또는 Warning | Fail |
| Proto AST Changed | 주석 외 Proto 구조 변경 | Fail | Fail | Fail |
| Dictionary Direct Change | 승인 없이 Dictionary 변경 | Fail | Fail | Fail |
| Generated Docs Outdated | 생성 결과와 commit 결과 불일치 | Warning | Fail | Fail |

정책:

* Local Mode는 개발자 피드백과 candidate 생성을 돕는다.
* Pull Request Mode는 승인되지 않은 의미 변경을 차단한다.
* Main Branch Mode는 publish 가능한 상태만 허용한다.

---

## 9. CI/CD 설계

### 9.1 Pipeline

```text
Proto Change
    ↓
Comment Skill
    ↓
Proto AST Guard
    ↓
Doc Comment Linter
    ↓
Dictionary Guard
    ↓
Human Approval Check
    ↓
Doc Generation
    ↓
Generated Docs Freshness Check
    ↓
Publish
```

---

### 9.2 Dictionary 변경 감지

감지 대상:

```text
/.proto-docs/dictionary/word-dictionary.json
```

조건:

```text
Dictionary 변경은 CODEOWNERS 또는 지정된 domain owner 승인 필요
```

승인자가 없으면 CI Fail.

CODEOWNERS 예시:

```text
/.proto-docs/dictionary/word-dictionary.json @domain-owner @tech-writer
/.proto-docs/dictionary/candidates/ @domain-owner @tech-writer
```

---

### 9.3 Dictionary 미등록 용어

조건:

```text
신규 Proto field가 Dictionary에 없음
```

결과:

```text
Local: Warning + candidate 생성
PR/Main: Fail
```

---

### 9.4 Generated Docs Freshness Check

CI에서 문서를 재생성한 뒤 repository에 포함된 생성 결과와 비교한다.

```text
generate docs
    ↓
git diff --exit-code generated-docs/
```

차이가 있으면 Generated Docs Outdated로 Fail.

---

## 10. Public / Internal 문서 분리

Proto 문서는 노출 범위에 따라 다르게 생성할 수 있다.

```text
Public Docs
  - 외부 공개 가능한 field/message/rpc만 포함
  - 내부 운영 키, 실험 기능, 민감한 설명 제외

Internal Docs
  - 전체 proto 구조 포함
  - 운영자/개발자용 설명 포함

Partner Docs
  - 외부 연동에 필요한 제한된 subset 포함
```

Dictionary 항목에는 노출 범위를 추가할 수 있다.

```json
{
  "visibility": "internal"
}
```

권장 visibility:

* `public`
* `partner`
* `internal`
* `restricted`

Renderer는 visibility 정책에 따라 문서를 분리한다.

---

## 11. Rollback Policy

Dictionary 또는 주석 변경이 잘못된 의미를 포함한 경우 다음 절차를 따른다.

1. 잘못된 Dictionary version 또는 comment commit 식별
2. publish된 문서가 있으면 해당 버전 비공개 또는 rollback
3. Dictionary entry를 이전 version으로 되돌림
4. 관련 candidate/history에 incident 기록
5. linter rule 또는 forbidden alias 보강
6. 문서 재생성 및 freshness check 수행

Dictionary 변경은 version을 증가시키고 history에 기록한다.

```text
/.proto-docs/dictionary/history/<field_name>/<version>.json
```

---

## 12. 운영 책임

| 역할 | 책임 |
|---|---|
| LLM | 승인된 의미를 바탕으로 주석 patch 생성 |
| Dictionary Owner | canonical description 승인 |
| Tech Writer | 문장 품질과 문서 노출 범위 검토 |
| Developer | Proto 변경과 candidate 생성 확인 |
| CI | 승인되지 않은 의미 변경 차단 |
| Renderer | 결정론적 문서 생성 |

---

## 13. 최종 원칙

```text
LLM은 의미를 생성하지 않는다.
LLM은 승인된 의미를 주석으로 표현만 한다.
의미의 소유권은 Dictionary에 있다.
Dictionary는 인간 승인 없이 변경될 수 없다.
주석 변경은 Proto descriptor를 변경할 수 없다.
문서 생성은 결정론적이어야 한다.
CI는 승인되지 않은 의미 변경을 차단해야 한다.
```
