# 제안: 인테이크 수거 방식을 통지-포인터(notification-pointer) 모델로 전환

- **제안자:** 사용자 + Antigravity Opus (초안)
- **보강:** Antigravity Flash (리뷰 기반 보강)
- **날짜:** 2026-05-29
- **상태:** 초안 — Claude/Codex 페어 검토 및 사용자 승인 후 채택
- **영향 범위:** `intake-standing-order.md`, `intake-template.md`, 각 팀
  `CLAUDE.md`/`AGENTS.md`, 블로그팀 `CLAUDE.md`

---

## 1. 현재 방식 (polling)

```
소스 팀 private repo                    ascendy-blog (public)
────────────────────                    ──────────────────────
docs/blog-intake/                       docs/intake/from-<team>/
  YYYY-MM-DD-topic.md  ← raw              YYYY-MM-DD-topic.md  ← 정제본
```

- 각 팀이 자기 private repo에 raw 인테이크를 씀.
- 블로그팀이 **매일 세 팀의 `docs/blog-intake/`를 폴링**하여 새 파일을 수거.
- 정제(redaction) 후 정제본만 public repo에 커밋.

### 문제

- **발견 비용:** 블로그팀이 세 repo를 매일 훑어야 함. 자동화가 없으면 누락 가능. 또한 변경 사항이 없어도 매일 풀 스캐닝을 유발해 에이전트 토큰 낭비 및 자원 소모 발생.
- **가시성:** "아직 안 가져간 글감"이 블로그 repo에서 안 보임 — 백로그 파악이 어려움.
- **cross-repo 접근:** 블로그팀 에이전트가 sibling repo를 읽을 수 있어야 하는데, 이 메커니즘이 명시적으로 구현/검증되지 않은 상태이며 접근 권한의 한계가 명확하지 않음.

---

## 2. 제안 방식 (notification-pointer)

```
소스 팀 private repo                    ascendy-blog (public)
────────────────────                    ──────────────────────
docs/blog-intake/                       docs/intake/pending/
  YYYY-MM-DD-topic.md  ← raw              YYYY-MM-DD-<team>-topic.md  ← 포인터
                                        docs/intake/from-<team>/
                                           YYYY-MM-DD-topic.md  ← 정제본 (기존과 동일)
```

### 핵심 변경

각 팀이 raw 인테이크를 자기 private repo에 쓸 때, **동시에** `ascendy-blog/docs/intake/pending/`에 **포인터 파일**을 남긴다.

포인터 파일에는 본문이 없다 — 메타데이터만 담아 민감 정보 노출을 원천 차단한다.

### 포인터 파일 포맷

```yaml
---
id: "2026-05-29-infra-rate-limiter" # 고유 식별자 (ID)
team: infra                         # backend | frontend | infra
date: 2026-05-29
topic: "rate limiter 재설계 결정"     # public 노출용 일반화 필수
author: "Claude (ascendy-infra)"     # 수거 시 질문/피드백 대상 지정
source:
  repository: "ascendy-infra"        # 리포지토리 이름
  path: "docs/blog-intake/2026-05-29-rate-limiter.md" # 리포지토리 내 상대 경로
suggestedCategory: "backend"
suggestedTags: ["rate-limiting", "architecture", "decision-making"]
urgency: normal          # urgent | normal | backlog
status: pending          # pending → picked-up → published → sync-error → canceled
pickedUpDate:            # 블로그팀이 수거 시 채움
publishedSlug:           # 발행 후 게시물 slug 기록
redactionRequired: true  # 원본에 민감 정보가 대량 포함되었는지 여부
expiryDate: 2026-06-29   # 30일 만료 기한 (TTL 정책)
---
```

- **본문 없음.** raw 내용은 `source` 구조체가 가리키는 private repo에만 존재.
- `status` 필드로 수거·발행 진행 상황을 추적.

### 흐름

1. 소스 팀이 raw를 자기 private repo에 쓴다 (기존과 동일).
2. **동시에** `ascendy-blog/docs/intake/pending/`에 포인터 파일을 커밋 (또는 PR).
3. 블로그팀은 `pending/` 디렉토리만 확인 → 새 글감 여부를 즉시 파악.
4. 포인터의 `source.repository`와 `source.path` 정보를 결합하여 sibling repo에서 raw를 안전하게 해석 및 로드하고, redaction 후 정제본을 `docs/intake/from-<team>/`에 커밋 (기존과 동일).
5. 포인터의 `status`를 `picked-up`으로 갱신, `pickedUpDate` 기록 (이때 발생하는 Git 충돌 최소화 방안은 4장 참고).
6. 게시물 발행 후 `status: published`, `publishedSlug` 기록.
7. (선택) 처리가 완료(published), 만료(expired) 또는 취소(canceled)된 포인터는 `docs/intake/archived/` 디렉토리 하나로 통합하여 이동하며, 최종 상태는 포인터 내부의 `status` 필드로 구분한다. (done/ 디렉토리를 별도로 두지 않아 디렉토리 구조를 단순화한다.)

---

## 3. 장점

| 항목 | polling (현재) | notification-pointer (제안) |
|---|---|---|
| 발견 비용 | 세 repo를 매일 폴링 | `pending/` 한 곳만 확인 |
| 민감 정보 노출 | 없음 (raw는 private) | 없음 (포인터에 메타만) |
| 백로그 가시성 | 블로그 repo에서 안 보임 | `pending/` = 미수거 큐 |
| 감사 추적 | 정제본 커밋 시점만 기록 | 제안 시점·수거 시점·발행 시점 모두 기록 |
| 소스 팀 부담 | raw 1건 작성 | raw 1건 + 포인터 1건 (메타만이라 경미) |

---

## 4. 주의할 점 및 완화 방안

### 4-1. 포인터-raw sync 깨짐

포인터는 올렸는데 raw를 안 썼거나, raw를 지웠는데 포인터가 남아있을 수 있다.

**완화:** 블로그팀이 raw를 fetch할 때 파일이 없으면 소스 팀에 핑. 포인터에 `status: sync-error` 상태를 부여하고 소스 팀 에이전트에 통지.

### 4-2. 소스 팀의 이중 커밋 부담

raw + 포인터를 두 repo에 각각 커밋해야 한다. 단, 포인터는 YAML frontmatter만이라 부담은 경미하다. 소스 팀의 CLAUDE.md에 "인테이크 시 포인터도 같이 올려라"는 instruction 한 줄이면 자동화 가능.

### 4-3. public repo에 주제명 노출

포인터의 `topic` 필드는 public이 된다. 주제명 자체가 민감한 경우(미공개 제품명 등) `topic`을 일반화해서 적어야 한다. 이 부분은 기존 `redaction-checklist.md`의 범위를 포인터 작성 시점에도 동일하게 적용하도록 소스 팀 지침에 포함한다.

### 4-4. 리포지토리 간 권한 장벽 및 Credential 격리

소스 팀 에이전트가 `ascendy-blog`에 포인터를 생성하려면 쓰기 권한이 필요하고, 블로그 에이전트가 raw 소스를 읽으려면 private repo에 대한 읽기 권한이 필요하다.
이 과정에서 과도한 크로스 리포지토리 권한 부여로 보안 격리가 약화될 수 있다.

**완화:** 
- 소스 팀 에이전트는 `ascendy-blog`에 직접 push하는 대신 **포인터 추가 PR**을 올리게 하거나, 각 에이전트 세션의 쓰기 권한을 `docs/intake/pending/` 하위 디렉토리로 최소화하여 격리한다.
- 블로그팀 에이전트의 private repo 조회는 정해진 상대 경로 규칙을 통해서만 작동하게 끔 샌드박스화한다.

### 4-5. CLAUDE.md Hard Rule 5 충돌 및 상태 관리 오버헤드

블로그팀이 수거 단계에서 포인터의 `status`를 `picked-up` 등으로 직접 수정하고 갱신하려 할 때, 블로그팀 `CLAUDE.md` Hard Rule 5("PR + 사람 머지 강제, main 직접 push 금지")와 정면 충돌한다. 상태값 한 줄 고치기 위해 매번 PR을 병합하는 것은 과도한 병목이다.

**완화:** 
- 블로그팀 `CLAUDE.md` Hard Rule 5에 **"다만, docs/intake/pending/ 하위 포인터 파일의 일부 지정된 필드(status, pickedUpDate, publishedSlug) 값 변경에 한해서는 예외적으로 main 직접 커밋을 허용한다"**는 단서를 추가한다. 파일 생성/삭제/topic/source 등의 포인터 구조 변경은 여전히 PR 검토가 필수다.
- 또는, 장기적으로 Git 상태값 갱신 대신 GitHub Issue / Project Board의 라벨 및 상태를 트리거로 이용하는 방식으로 포인터 수거 메커니즘을 연동하는 방안을 고려한다.

### 4-6. 가비지 포인터 누적 방지 (TTL 정책)

작성이 취소되거나 유실되어 영원히 `pending` 상태로 큐에 방치되는 포인터가 늘어나면 가시성 확보에 방해가 된다.

**완화:** 포인터에 `expiryDate`(작성일 기준 30일 뒤) 필드를 필수로 정의한다. 기한이 지난 포인터는 수거 대상에서 제외되며, 자동 스크립트나 관리자가 주기적으로 통합 아카이브 폴더(`docs/intake/archived/`)로 이동시켜 `status: expired` 상태로 아카이빙하도록 규정한다.

---

## 5. 채택 시 수정 대상 문서

이 제안이 승인되면 아래 문서를 Claude/Codex 페어가 수정한다:

| 문서 | 변경 내용 |
|---|---|
| `docs/intake-standing-order.md` | "매일 pull" → "pending 확인" 방식으로 수정 및 만료(TTL)/구조체 경로 파싱 지침 추가 |
| `docs/intake-template.md` | 개선된 포인터 구조체 YAML 포맷(source, id, author, redactionRequired, expiryDate 등) 섹션 추가 |
| `CLAUDE.md` (블로그팀) | 수거 절차에 `pending/` 확인 단계 추가 + Hard Rule 5 상태 갱신 예외 조항(일부 필드 직접 커밋 허용) 명시 |
| 각 팀 `CLAUDE.md` | "인테이크 시 포인터도 같이 올릴 것" + 개선된 YAML 구조체 포맷 자동 생성 지침 추가 |
| `docs/intake/pending/` | 디렉토리 신설 + `.gitkeep` |
| `docs/intake/archived/` | 완료(published), 만료(expired) 및 취소(canceled)된 포인터 보관용 통합 아카이브 디렉토리 |

---

## 6. 시범 적용 및 단계적 도입 전략

포인터 방식 전환에 따른 크로스 리포지토리 권한 및 경로 해석 오류를 선제 방어하기 위해 단계적(Phased) 도입 전략을 적용한다.

- **Phase 1: Infra 팀 시범 적용 (1주일)**
  - 기술적 자치성과 자동화가 비교적 잘 구축되어 있는 `ascendy-infra` 팀을 첫 번째 시범 파일럿 팀으로 지정한다.
  - Infra 팀 에이전트와 블로그팀 간의 포인터 연동을 수동 및 수동 PR 수준에서 먼저 수행하여 `source.repository`와 `source.path` 조합 파싱이 로컬/원격 환경에서 정상 작동하는지(경로 불일치 여부) 집중 테스트한다.
- **Phase 2: 블로그팀 내부 규칙 보완**
  - `CLAUDE.md` Hard Rule 5의 상태 갱신 예외 규정의 부작용을 점검하고, 에이전트가 `status`를 자동 갱신할 때 발생하는 동시성 충돌을 해결한다.
- **Phase 3: 전체 팀 확산 및 자동화 전파**
  - POC가 완료되면 `ascendy-frontend`, `ascendy-backend` 팀으로 정책을 최종 확산하고, 각 팀 `CLAUDE.md`에 포인터 자동 생성을 강제한다.

---

## 7. 이 제안서의 위치

이 문서는 **제안서**이며, 기존 정책 문서를 수정하지 않는다. 단, 본 제안서 자체는 리뷰 피드백을 반영하여 수시로 갱신될 수 있다.
Claude/Codex 페어가 검토 후 채택·구현하고, 사용자가 최종 머지한다.
채택되면 이 파일은 의사결정 기록으로 남기거나 삭제해도 무방.
