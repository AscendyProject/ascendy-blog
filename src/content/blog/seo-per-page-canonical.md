---
title: "'global default OG면 안전하다'는 거짓말 — og:url과 canonical엔 기본값이 없다"
description: "Nuxt에 SEO baseline을 깔 때 쉽게 빠뜨리는 함정 — og:url과 canonical은 기본값이 의미 없는 필드다. global default만 깔면 모든 페이지가 root를 advertise하고, 검색엔진엔 'root가 정본'이라는 강한 신호를 줘 나머지가 색인에서 빠질 위험이 크다. per-page override는 필수. Codex가 grep 한 줄로 잡았다."
pubDate: 2026-06-12
author: "Ascendy Engineering"
tags: ["nuxt", "seo", "open-graph", "canonical", "lessons-from-review"]
category: "frontend"
lang: "ko"
translationKey: "seo-per-page-canonical"
sourceIntake:
  - "docs/intake/from-frontend/2026-06-12-seo-per-page-canonical.md"
draft: false
redactionReviewed: true
---

## TL;DR

- 공개 런칭 준비로 Nuxt에 SEO baseline을 깔았다 — `robots.txt`, `sitemap.xml`, 그리고 `nuxt.config.ts`에 **global default** Open Graph + Twitter Card 메타.
- Codex 리뷰가 잡았다: **global `og:url`이 root로 박혀 있는데 페이지별 `useSeoMeta`가 `ogUrl`을 안 잡아서, 모든 공개 페이지가 OG canonical로 root(`ascendy.ai/`)를 advertise한다.** `rg ogUrl pages/` 한 줄로 누락 확인.
- 핵심: **og:url과 canonical은 *기본값이 의미 없는* 필드다.** 페이지마다 달라야지, global default만 깔면 (1) SNS 미리보기에서 전 페이지가 같은 root를 광고하고 (2) 검색엔진에 "root가 정본"이라는 강한 신호를 잘못 줘서, 나머지 페이지가 root의 *중복*으로 묶여 색인에서 제외될 위험이 커진다.
- → **per-page override는 "선택"이 아니라 "필수"**다. 18줄로 6개 페이지에 `ogUrl` + `<link rel="canonical">` 추가.

> **소스 노트.** frontend 팀 인테이크를 정제한 글이다. 공개 도메인 `ascendy.ai`는 이미 공개라 예시로 그대로 쓴다(시크릿·식별자 없음). 같은 *리뷰가-잡았다* 결의 [한 번 고친 버그가 어떻게 되살아났나](/blog/nuxt-client-middleware-skips-initial-route/), [이름 하나 바꾸는 PR이 가장 넓은 PR이었다](/blog/rename-pr-is-a-doc-sweep/)와 이어진다.

## "default 깔고 끝"이 안 통하는 한 곳

SEO baseline을 깔 때 대부분의 가이드는 이렇게 안내한다. *"`nuxt.config.ts` head에 default Open Graph 메타를 깔아두면 전 페이지가 기본 미리보기를 갖는다. per-page override는 필요하면 나중에."*

대부분의 OG 필드엔 이게 맞다. `og:image`, `og:site_name`, default `og:title`/`og:description` — 페이지가 따로 안 잡으면 default가 합리적으로 채운다.

그런데 **딱 두 필드엔 이게 함정이다: `og:url`과 `<link rel="canonical">`.**

이 둘은 *"이 페이지가 정식으로 어떤 URL인가"*를 선언한다. 그래서 **default 값이라는 게 애초에 의미가 없다** — 모든 페이지가 같은 값이면 안 되니까. 그런데 global default에 `og:url`을 `https://ascendy.ai/`로 박아두고 페이지별로 override를 안 하면, about·pricing·privacy·terms·licenses 페이지가 *전부* 자기 정식 URL을 `ascendy.ai/`(root)라고 선언한다.

## 그래서 무슨 일이 생기나

두 방향으로 깨진다.

1. **SNS 미리보기** — `/about`을 공유하든 `/pricing`을 공유하든, OG 카드가 advertise하는 URL은 전부 `ascendy.ai/`다. 클릭하면 엉뚱한 데로 가거나, 최소한 "이 링크가 그 페이지가 맞나" 신뢰가 깎인다.
2. **검색 인덱싱** — 이게 더 치명적이다. 짚고 갈 게 하나 있다 — **`rel="canonical"`은 *명령*이 아니라 *신호*다.** Google은 canonical 태그와 다른 단서(내부 링크, sitemap, 리다이렉트 등)를 종합해 대표 URL을 직접 고르고, 신호가 어긋나면 무시하기도 한다. 그런데 `<link rel="canonical">`이 모든 페이지에서 root를 가리키면, **about/pricing/privacy/terms/licenses가 전부 "내 정본은 root"라고 강하게 우기는 셈**이라, Google이 root를 대표로 골라 *나머지 페이지를 색인에서 제외할 위험이 크다.* 확정은 아니지만, SEO baseline을 깐다면서 정작 페이지들을 검색에서 지울 수 있는 신호를 스스로 심는 것이다.

Codex 리뷰가 이걸 `rg ogUrl pages/` **한 줄**로 잡았다 — 페이지 어디에도 `ogUrl`이나 canonical override가 없다는 걸. *리뷰어가 grep 한 줄로 잡을 수 있는 종류의 결함*이고, 코드 리뷰가 왜 값을 하는지를 보여주는 작은 일화다.

## fix — per-page에 둘 다 명시

Nuxt 3에선 `useSeoMeta`가 `ogUrl`을 받고, canonical은 `useHead`의 link entry로 따로 잡는다. 같은 PR에서 둘 다 명시한다.

```ts
// pages/about.vue (다른 공개 페이지도 같은 패턴)
const pageUrl = 'https://ascendy.ai/about'
useSeoMeta({
  title: () => t('seo.about.title'),
  description: () => t('seo.about.description'),
  ogTitle: () => t('seo.about.title'),
  ogDescription: () => t('seo.about.description'),
  ogUrl: pageUrl,                              // ← 빠뜨렸던 핵심
})
useHead({ link: [{ rel: 'canonical', href: pageUrl }] })  // ← + 검색용 canonical
```

6개 페이지에 18줄. 그게 전부다 — 작은 누락이지만 잠재 결과가 "전 페이지가 검색에서 사라질 위험"이라 임팩트가 컸다.

(참고: prod host를 하드코딩하는 건 multi-env에선 trade-off다. dev/staging도 인덱싱이 필요하면 dynamic sitemap + runtime config가 맞다. 공개 페이지가 prod-only인 현 단계에선 prod 고정이 옳다.)

## 가져갈 것

- **`og:url`과 `canonical`은 기본값이 의미 없는 필드다.** 서로 다른 페이지가 같은 값을 가질 수 없으므로, global default 하나로는 옳은 값이 될 수 없다. per-page override는 선택이 아니라 필수.
- **global default OG는 안전한 시작 — 단, 이 두 필드는 예외.** 나머지 OG 필드의 통념을 이 둘에 그대로 적용하면 전 페이지가 root를 advertise하고, 검색엔진엔 root를 대표로 고르라는 강한 신호가 되어 나머지가 색인에서 빠질 위험이 생긴다.
- **canonical이 전부 root를 가리키면 그 페이지들이 색인에서 제외될 위험이 크다.** canonical은 신호지 명령은 아니라 100%는 아니지만, SEO를 깐다면서 SEO를 지우는 자책골이 될 수 있다.
- **이런 결함은 리뷰어가 `rg` 한 줄로 잡는다.** "default 깔았으니 됐다"는 가정을, 별개의 눈이 grep으로 검증하는 게 리뷰의 값어치다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
