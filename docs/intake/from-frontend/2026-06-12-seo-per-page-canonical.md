---
team: frontend
date: 2026-06-12
topic: "Nuxt에서 SEO baseline(robots/sitemap/OG)을 깔 때 흔히 빠뜨리는 함정 — og:url과 canonical은 *기본값이 의미 없는* 필드라 per-page override가 선택이 아니라 필수. global default만 깔면 모든 페이지가 root를 advertise하고 검색엔진이 duplicate로 본다. Codex 리뷰가 rg 한 줄로 누락을 잡음."
suggestedCategory: "frontend"
suggestedTags: ["nuxt", "seo", "open-graph", "canonical", "lessons-from-review"]
redactionReviewed: true
---

> frontend 팀 raw 글감의 정제본. **Class A/B 없음.** 공개 도메인 `ascendy.ai`는 이미 공개라 예시로
> 노출 OK(글감 명시). 미공개 라우트(`/gallery` 등)는 robots.txt에 이미 명시돼 무방. 식별자/시크릿 없음.

## 무엇을

공개 런칭 준비로 SEO baseline을 깔았다 — `robots.txt`, `sitemap.xml`, 그리고 `nuxt.config.ts` head에
default Open Graph + Twitter Card 메타. 다국어 운영이라 페이지별 `useSeoMeta`로 i18n 키도 별도 PR로 분리.

Codex round-1 리뷰가 잡았다(major): **global `og:url`이 root로 박혀 있는데 페이지별 `useSeoMeta`가
`ogUrl`을 안 잡아서, about/pricing/privacy/terms/licenses 전 페이지가 OG canonical URL로 root를
advertise한다.** `rg`로 확인 — `ogUrl`이나 canonical override가 페이지 어디에도 없었다.

fix: 6개 공개 페이지 각각의 `useSeoMeta`에 `ogUrl` + `useHead`로 `<link rel="canonical">` 추가. 18 라인.

## 왜

쉽게 빠뜨린다. SEO 가이드 대부분 "global default OG 깔고 끝", per-page override는 "선택"이라 부른다.
그런데 **og:url과 canonical은 *default가 의미 없는* 필드**다. 페이지마다 달라야지, 안 그러면:
- SNS 미리보기에서 모든 페이지가 같은 root URL을 advertise하고,
- 검색엔진이 모든 페이지를 root의 *duplicate*로 봐 인덱싱에서 떨어진다.

SEO baseline 작업에서 가장 일어나면 안 되는 일이 바로 그거다.

## 패턴
- "global default OG는 안전한 시작, per-page는 선택"이라는 통념이 **og:url + canonical에선 틀린다.**
- Nuxt 3에서 `useSeoMeta`는 `ogUrl`을 string으로 받고, canonical은 `useHead`의 link entry로 별도 — 같은 PR에서 둘 다 명시.
- 하드코딩 prod host는 multi-env에선 trade-off — dev/staging 인덱싱이 필요하면 dynamic sitemap + runtime config. 현 단계(prod-only)엔 prod 고정이 옳음.
- Codex 리뷰가 `rg ogUrl pages/` 한 줄로 누락을 잡았다 — *리뷰어가 grep 한 줄로 잡을 수 있는 종류의 결함*이고, review-driven 개발의 ROI를 보여주는 일화.

## 외부에 공유해도 좋은 부분
- og:url/canonical은 기본값이 없는 필드라 per-page가 필수라는 함정.
- review가 grep 한 줄로 잡은 결함 = review-driven ROI.
- Nuxt 3 useSeoMeta(ogUrl) + useHead(canonical) 패턴.
- prod-host 고정의 multi-env trade-off.

## 외부에 공유하면 안 되는 부분
- 공개 도메인 ascendy.ai는 노출 OK. 미공개 라우트는 robots.txt에 이미 있어 무방. 시크릿/식별자 없음.
