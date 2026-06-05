# 인테이크 상시 지침 (Standing Order)

backend / frontend / infra 세 페어 팀을 위한 **블로그 글감 공급 상시 지침**.
블로그팀(편집국)이 세 팀에 보내는 요청이다. 각 팀은 이 지침을 자기 repo의
운영 가이드(CLAUDE.md / AGENTS.md)에 반영해 운용한다.

> 블로그팀은 sibling repo를 직접 편집하지 않는다. 이 문서는 "이렇게 떨궈
> 달라"는 사양이고, 채택·자동화는 각 팀(과 그 팀의 사용자)의 몫이다.

## 요청 (한 줄)

**각 팀은 하루에 최소 1건, 블로그 글감 인테이크를 자기 private repo에 떨군다.**

## 1. 어디에 — 자기 private repo

```text
<팀 repo>/docs/blog-intake/YYYY-MM-DD-<kebab-topic>.md
예: ascendy-backend/docs/blog-intake/2026-05-27-rate-limiter-redesign.md
```

블로그(`ascendy-blog`)는 **public**, 세 팀 repo는 **private**다. raw 소스를
블로그 public repo에 직접 넣으면 redaction 전에 git history로 영구 공개된다.
그래서 **원본은 너희 private repo에 둔다.** 블로그팀이 읽기 전용으로 열람한 뒤,
redaction을 통과시킨 **정제본만** 블로그 public repo에 커밋한다.

## 2. 무슨 형식으로

[`intake-template.md`](./intake-template.md)를 그대로 복사해 채운다. 핵심 필드:
`team`, `topic`, `suggestedCategory/Tags`, `urgency`, `relatedPRs`,
`externalMaterials`(외부 코드/이미지 차용 시 라이선스), 그리고 본문의
"무엇을/왜 했나", "외부에 공유해도 좋은 부분", "공유하면 안 되는 부분".

## 3. 민감한 건 숨기지 말고 표시

private repo이므로 **원본 코드·설정을 그대로 붙여도 된다.** 단, 시크릿·사내
호스트명·실 IP·registry path·image tag·미공개 비즈니스 결정·고객 식별정보가
들어 있으면 **"외부에 공유하면 안 되는 부분"에 무엇이 들어있는지 명시**한다.
숨기면 블로그팀이 못 걸러낸다 — 표시하면 우리가 제거·일반화한다.

→ 보안/비즈니스 노하우 제거의 **최종 책임은 블로그팀**에 있다. 너희는
   "여기 민감한 게 있다"만 정직하게 알려주면 된다.

## 4. 무엇이 글감이 되나

거창할 필요 없다. 그날 한 작업 중 **결정·트레이드오프·인시던트 회피·패턴**이
있으면 글감이다. 예:

- "X를 A 대신 B로 결정했다 — 이유와 버린 대안"
- "이런 장애를 이렇게 피했다 / 겪고 이렇게 고쳤다"
- "이 라이브러리/패턴을 이렇게 썼다"

순수 잡무(의존성 bump, 오타)는 제외. 하루에 진짜 글감이 없으면 `urgency:
backlog`로 가벼운 메모만 남겨도 된다 — 억지로 만들지 말 것.

### 4-bis. 특별 트리거 — Claude↔Codex가 치열하게 갈렸던 토론

위 일반 글감과 별개로, **이건 적극적으로 찾아서 떨궈 달라.** 가장 드물고
가장 값나가는 글감 줄기다.

**트리거:** 한 주제를 두고 Claude와 Codex(또는 두 에이전트/리뷰어)의 의견이
**3라운드 이상 substantive하게 갈렸다가 합의(또는 정직한 분기)에 이른** 경우.
너희 repo의 `docs/agent-os/decisions/`(AI 위원회 verbatim 의견 + 합의)·Tier 3
결정문·PR 리뷰 스레드가 천연 raw 소스다.

**"3라운드"는 프록시일 뿐 — 진짜 필터는 셋 다 만족:**

1. **양쪽 입장이 다 방어 가능했나** (steelman이 되나). 한쪽이 그냥 틀렸던
   거면 토론이 아니라 교정이다 — 일반 글감으로.
2. **실제 트레이드오프가 있었나.** 네이밍·스타일 고집은 제외.
3. **수렴이 *원리*를 가르쳤나.** "그래서 합의했다"가 아니라, 그 합의 과정이
   재사용 가능한 교훈을 남겼나.

**무엇을 적나 — "우리 합의함" 요약이 아니다. 긴장이 곧 콘텐츠다:**

- **양쪽 입장을 충실히 재현**(각 진영을 steelman). 누가 무엇을, 왜 주장했나.
- **갈림의 crux** — 정확히 어느 지점에서 갈렸나. (옵션 선택이 같아도
  *추론*이 갈릴 수 있다 — 그게 종종 진짜 이야기다.)
- **수렴 경로** — 한쪽이 다른 쪽의 무엇을 꺾었나/채택했나. 누가 어떤 근거로
  마음을 바꿨나. 끝까지 갈렸으면 그 분기를 그대로.

**redaction 주의:** 토론 *주제 자체*가 §3의 민감 영역이면 — 인증 플로우,
레이트리밋 임계값, 부정탐지 휴리스틱, 미공개 사업 전략, 고객 식별 — **이건
일반화해도 글감이 안 된다(Class 1). 그냥 스킵하라.** redaction을 통과하는
**기술·아키텍처·프로세스 토론**으로 한정한다. 애매하면 "외부에 공유하면 안
되는 부분"에 토론 주제의 민감성을 명시하고 블로그팀 판단에 맡겨라.

## 5. 통지 (블로그팀이 어떻게 아나)

- **기본 (pull):** 블로그팀이 매일 세 팀의 `docs/blog-intake/`를 훑어
  새 파일을 가져간다. 별도 통지 없이도 수거된다.
- **급한 건 (push):** `urgency: urgent`거나 공개 시점이 정해진 글은, 같은
  cmux workspace의 블로그팀 surface에 한 줄 핑하거나 자기 repo PR 코멘트로
  알린다. (블로그팀 surface로 Enter 제출은 사용자 동의 후에만.)

## 6. 이후 흐름 (블로그팀이 처리)

읽기 → redaction 체크리스트 통과 → 정제본을 `ascendy-blog/docs/intake/from-<team>/`에
커밋 → 게시물 작성(`sourceIntake:` = 정제본) → `draft:true/redactionReviewed:false`로
PR → Codex 리뷰 → 사람 머지 → Cloudflare Pages 자동 배포.

발행 주기는 블로그팀이 조절한다 — 매일 들어와도 발행은 묶어서 할 수 있다.
인테이크가 곧 발행은 아니다.

## See also

- [`intake-template.md`](./intake-template.md) — 채울 양식
- [`editorial-policy.md`](./editorial-policy.md) — "인테이크의 공개 경계"
- [`redaction-checklist.md`](./redaction-checklist.md) — 블로그팀이 돌리는 체크리스트
