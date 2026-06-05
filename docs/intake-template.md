# 인테이크 표준 포맷

3개 페어 팀(backend / frontend / infra)이 블로그팀에게 글감을 넘길 때 쓰는
표준 양식. 이 양식 없이 들어온 인테이크는 블로그팀이 되돌려 보낸다.

> **사용자 직접 지정 글감**도 가능하다 — 사용자가 채팅/문서로 주제·자료를
> 주면 블로그팀이 글로 만든다(`sourceIntake` 면제). 이 양식을 선택적으로
> 써도 되고, 기록은 `docs/intake/from-user/`에 redaction 후 남긴다.
> 자세한 소스 구분은 [`editorial-policy.md`](./editorial-policy.md) "글감은 어디서 오나".

## 어디에 쓰나 — raw 소스는 비공개 팀 repo에

`ascendy-blog`는 **public** repo이고 backend / frontend / infra는 모두
**private**다. 따라서 redaction 전 raw 소스를 블로그 public repo에 직접
커밋하면, 정제되기도 전에 git history로 영구 공개된다 (사후 삭제로는 회수
불가).

→ **인테이크 원본은 제안 팀 자신의 private repo에 쓴다:**

```text
<팀 private repo>/docs/blog-intake/YYYY-MM-DD-<kebab-topic>.md
예: ascendy-infra/docs/blog-intake/2026-05-24-vcr-secret-phase1.md
```

블로그팀은 이 파일을 sibling repo에서 **읽기 전용**으로 열람해 1차 소스로
삼는다 (sibling repo의 파일은 편집하지 않는다). redaction을 통과시킨 뒤,
**정제된 인테이크 기록만** 블로그 public repo의
`docs/intake/from-<team>/YYYY-MM-DD-<topic>.md`에 커밋한다. 게시물
frontmatter의 `sourceIntake:`는 이 **정제본** 경로를 가리킨다.

요컨대: raw는 private repo에 머물고, public repo엔 redaction 끝난 것만
들어간다. 일일 주기·통지 방법은 [`intake-standing-order.md`](./intake-standing-order.md) 참조.

---

## 인테이크 템플릿 (그대로 복사해서 채우세요)

```markdown
---
team: infra                  # backend | frontend | infra
proposer: "Claude (ascendy-infra)"   # 또는 "Codex (ascendy-infra)"
date: 2026-05-24
topic: "VCR secret 관리 Phase 1 — sanity-check hook"
suggestedCategory: "infra"   # 게시물 카테고리 힌트
suggestedTags: ["helm", "kubernetes", "secrets", "incident-prevention"]
urgency: "normal"            # urgent | normal | backlog
relatedPRs:
  - "https://github.com/AscendyProject/ascendy-infra/pull/7"
relatedDecisions:
  - "docs/agent-os/decisions/2026-05-24-vcr-secret-management.md"
publicReadyBy: "2026-06-01"  # 비워도 OK. 외부에 알릴 의무가 있다면 명시.

# 외부 자료 출처 (있을 때만)
# redaction-checklist §5 (라이선스/출처) 충족용. 인용·차용·재가공한
# 외부 코드/이미지/다이어그램이 있으면 항목별로 기재.
# 예:
# externalMaterials:
#   - kind: code-snippet
#     source: "https://github.com/withastro/astro"
#     license: "MIT"
#     usage: "Content Collections 예시 코드 일부 인용"
#   - kind: diagram
#     source: "내부 작성"
#     license: "ours"
externalMaterials: []
---

## 무엇을 했나 (5~15줄)

기술 선택, 변경 핵심.

## 왜 했나 (3~10줄)

배경, 트레이드오프, 다른 선택지.

## 외부에 공유해도 좋은 부분

- (이미 공개된 라이브러리/패턴 사용 사실)
- (일반화된 아키텍처 다이어그램)
- (인시던트 회피 패턴, 학습된 교훈)

## 외부에 공유하면 안 되는 부분 (블로그팀이 redaction 시 참고)

- (구체적 호스트명, 클러스터 이름)
- (registry path, image tag)
- (미공개 비즈니스 결정)
- (고객/파트너 식별 정보)

## 코드 / 설정 스니펫

\`\`\`yaml
# 이 파일은 비공개 repo에 머무니 원본을 그대로 붙여도 된다.
# 단, 민감한 값(시크릿/호스트명/IP/내부 식별자)이 들어 있으면 위
# "외부에 공유하면 안 되는 부분"에 무엇이 포함됐는지 표시해 둘 것 —
# 블로그팀이 그걸 보고 정제한다.
\`\`\`

## 참고 링크

- 사내 인시던트 티켓 등은 **링크하지 마세요** (회사 내부 URL은 redaction
  대상). 공개 자료(블로그, 표준 문서, 라이브러리 README)만 링크.

## 블로그팀에게 (선택)

- 이 글의 톤이나 강조하고 싶은 포인트
- 글을 두 편으로 나눠도 좋다 / 한 편이 적절하다 같은 길이 의견
- "내가 직접 검수하고 싶다" (제안 팀의 사람/에이전트가 게시 전 리뷰)
```

---

## 토론형 글감(Claude↔Codex 의견 충돌)일 때 — 본문 구조만 다르다

[`intake-standing-order.md` §4-bis](./intake-standing-order.md)의 특별 트리거
(3+ 라운드 substantive 토론)에 해당하면, frontmatter는 위와 같이 쓰되
`relatedDecisions:`에 해당 `docs/agent-os/decisions/*` 결정문을 채우고,
**본문은 "무엇을/왜 했나" 대신 아래 세 블록**으로 적는다:

```markdown
## 양쪽 입장 (각 진영 steelman)

- **A 진영(누가):** 무엇을, 왜 주장했나. 가장 강한 형태로.
- **B 진영(누가):** 무엇을, 왜 주장했나. 가장 강한 형태로.

## 갈림의 crux

정확히 어느 지점에서 갈렸나. (옵션 선택이 같아도 *추론*이 갈릴 수 있다 —
그게 종종 진짜 이야기다.)

## 수렴 경로

한쪽이 다른 쪽의 무엇을 꺾었나/채택했나. 누가 어떤 근거로 마음을 바꿨나.
끝까지 갈렸으면 그 분기를 그대로 적는다("합의함" 요약 금지 — 긴장이 콘텐츠).
```

redaction 경계는 동일하다 — 토론 *주제 자체*가 인증·레이트리밋·부정탐지·
미공개 사업전략·고객식별이면 일반화해도 **게시 부적합**이라 글감이 안 된다
(스킵; [`redaction-checklist.md`](./redaction-checklist.md) §1·§3).

---

## 블로그팀이 인테이크를 처리하는 방식

1. 제안 팀의 private repo `<팀 repo>/docs/blog-intake/`에서 인테이크
   원본을 읽는다 (읽기 전용 — sibling repo의 파일은 편집하지 않는다).
2. `docs/redaction-checklist.md`를 한 항목씩 통과시키며 정제한다.
3. 정제된 인테이크 기록을 블로그 public repo의 `docs/intake/from-<team>/`에
   쓴다 (raw가 아니라 정제본만 public에 들어간다).
4. `src/content/blog/<slug>.md`를 `_template.md` 기반으로 만들고,
   `sourceIntake:`에 3의 정제본 경로를 적는다.
5. `draft: true`, `redactionReviewed: false`로 PR을 연다.
6. Codex 리뷰 → redaction 재확인 → `redactionReviewed: true`, `draft: false` → 사람이 머지.
7. 머지되면 Cloudflare Pages가 자동 빌드·배포.
