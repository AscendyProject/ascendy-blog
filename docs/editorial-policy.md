# Editorial Policy

이 문서는 ascendy-blog의 **편집 정책**이다. 블로그팀 Claude와 Codex 모두
이 문서를 binding으로 따른다. 정책 위반은 곧 머지 차단 사유.

## 누구를 위해 쓰는가

1. **인간 개발자** — 외부 엔지니어가 검색하다 도착하거나, 우리 팀의
   결정 기록을 참고하러 오는 사람.
2. **AI 에이전트** — Perplexity, ChatGPT, Claude, Gemini, 검색엔진.
   인용 단위로 잘 잘리고, 구조화 데이터로 신뢰성을 입증해야 함.

순서가 곧 우선순위. 사람이 못 읽는 글은 AI도 못 인용한다.

## 톤

- 한국어 기본. 영어가 더 정확한 용어/고유명사는 영어 유지.
- 1인칭 복수 "우리". 단정과 추측을 분리하라 ("결정했다" vs "현재는 …로 보인다").
- 자뻑 금지. 실패와 트레이드오프를 같이 쓴다. "Ascendy는 최고다" 같은
  문장은 AI 인용 가치를 떨어뜨린다 — 사실과 측정값을 적어라.

## 길이

- TL;DR 3~5줄 (AI 인용 단위).
- 본문 700~2,500자 (긴 글은 시리즈로 쪼개라).
- 코드 블록은 self-contained하게, 50줄 이상은 GitHub 링크.

## 구조 — 모든 글이 가져야 할 골격

1. TL;DR
2. 배경 (왜 이 글인가)
3. 본문 (결정/변경/패턴)
4. 결정/트레이드오프 (특히 infra)
5. 후속 / 측정 / 관련 글

`_template.md`가 이 골격을 강제한다.

## 메타데이터 (frontmatter)

`src/content.config.ts`의 스키마가 강제. 누락 시 빌드 실패.

- `title`, `description`, `pubDate`, `tags`, `category` 필수
- `sourceIntake` — 3팀 산출물 기반 글이면 필수
- `draft: true`, `redactionReviewed: false`로 PR을 열고, 머지 직전에 반대로

## Schema.org (자동)

`src/components/SchemaOrg.astro`가 모든 포스트에 `BlogPosting` JSON-LD를
자동 주입. 추가 작업 불필요. 새 schema 타입이 필요해지면 PR + Codex
리뷰 + 사람 머지.

## 사진 / 다이어그램

- 가능하면 Mermaid 또는 SVG (텍스트 기반 → AI 친화적).
- 비트맵은 alt 텍스트 필수, WebP 권장.
- 사내 시스템 스크린샷은 호스트명/사용자명/실제 데이터를 가린 후 첨부.

## 인용 / 출처

- 외부 라이브러리·문서를 참조할 때 링크와 버전 표기.
- 사내 인시던트 티켓, 사내 Slack, 사내 PR(공개 repo 제외)은 링크하지 않는다.
- 우리 공개 PR/이슈/공개 repo는 자유롭게 링크.

## 비공개 → 공개 가드

`docs/redaction-checklist.md`를 PR마다 통과해야 한다. 자세한 항목은 그쪽
참조. 핵심:

- 인증 정보, 토큰, kubeconfig, 사내 호스트명, 클러스터 이름, registry
  path, 사내 IP, 고객/파트너 식별 정보, 미공개 비즈니스 결정 → **금지**.
- 의심스러우면 redaction. "이거 공개해도 되나?"가 떠오르면 답은 No.

## 인테이크 저장소의 공개성

`ascendy-blog`는 GitHub public repo다. 따라서 `docs/intake/from-*/`에
들어가는 인테이크 마크다운도 **그 순간부터 공개 자료**다. 이 사실은
세 단계 책임으로 다룬다:

1. **제안 팀 (backend / frontend / infra)**의 1차 redaction.
   `docs/intake-template.md`의 "외부에 공유하면 안 되는 부분" 단락에
   금지 항목을 적되, **본문에 그대로 노출하지 말 것** — "이런 카테고리의
   정보가 있었다"는 메타 설명만. 실제 시크릿/사내 호스트명/실 IP는
   인테이크 단계에서 이미 삭제·일반화되어야 한다.
2. **블로그팀**의 2차 검증. 인테이크가 commit 되기 전에
   `docs/redaction-checklist.md`를 인테이크에도 한 번 돌린다. 통과 못
   하면 제안 팀에 되돌려 보낸다 (수정 요청). 인테이크가 일단 public
   repo에 push 되면 git history에 남으므로 사후 삭제로는 정보 회수가
   불가능하다.
3. **사용자**의 최종 머지. 머지 = 공개. draft/redactionReviewed 게이트가
   포스트에만 걸려 있고 인테이크 자체에는 빌드 게이트가 없으므로,
   인테이크 PR은 사람이 추가로 검토해서 머지.

요약: 인테이크는 "내부 메모"가 아니라 "1차 공개 자료"다. 익숙해질
때까지는 인테이크 PR도 블로그 포스트 PR과 동일한 강도로 검토.

## 게시 / 배포

- main 브랜치 머지 = 즉시 배포 (Cloudflare Pages).
- 따라서 **draft는 절대 main에 머지하지 않는다** (별도 preview 브랜치 사용 시 OK).
- 핫픽스 직접 push는 사람만, 명시적 비상시에만.

## 정정 / 철회

- 사실관계 정정: 본문 수정 + `updatedDate` 갱신 + 글 하단에 "정정 노트" 단락.
- 글 전체 철회: 파일 삭제하지 말고 `draft: true`로 복귀 + PR 본문에 사유.
  과거 외부 인용을 깨뜨리지 않기 위한 검토 후 영구 삭제.

## 새 카테고리 / 새 통합 추가

- 새 `category` 값, 새 Astro 통합, 새 외부 의존성 추가는 사용자 승인.
- Tailwind 테마 컬러나 폰트 패밀리 같은 디자인 토큰은 PR에서 토론.
