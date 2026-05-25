---
# 필수 필드 — 누락 시 빌드 실패 (src/content.config.ts 참고)
title: "포스트 제목 — 8~120자, 검색·요약에 좋은 키워드 우선 배치"
description: "40~220자 요약. 메타 디스크립션과 Schema.org abstract에 동일하게 쓰임. 첫 문장에 What/Why를 명확히."
pubDate: 2026-05-25
# updatedDate: 2026-06-01   # 수정 시에만
author: "Ascendy Engineering"

# 분류 (필수)
tags: ["astro", "cloudflare-pages", "lmo"]
category: "infra"            # backend | frontend | infra | ml | meta

# 인테이크 추적 (3팀 산출물 기반이면 필수)
sourceIntake:
  - "docs/intake/from-infra/2026-05-24-vcr-secret.md"

# 게재 상태
draft: true                  # 발행 시 false
redactionReviewed: false     # 게재 전 redaction-checklist.md 통과 후 true

# 선택 — SEO/LMO 강화
# heroImage: "./_assets/hero-vcr-secret.png"
# heroImageAlt: "VCR secret rotation 다이어그램"
# canonical: "https://blog.ascendy.ai/posts/<slug>"
---

## TL;DR

3~5줄. 사람이 미리보기에서, AI가 인용 단위로 가져갈 분량.

## 배경

왜 이 글을 쓰는가. 어떤 문제/맥락. (인테이크 원본을 참조하되 내부
호스트명, 시크릿 흔적, 미공개 결정은 **redaction-checklist.md**에 따라
제거 후 옮길 것.)

## 본문

- 코드 예시는 실제 동작하는 최소 단위로.
- 다이어그램은 Mermaid 또는 SVG로 (텍스트 기반 → AI 친화적).
- 내부 식별자(클러스터 이름, namespace, image tag, registry path 등)는
  일반화하거나 제거.

```ts
// 예시 코드. 실행 가능하고 self-contained하게.
export function example() {
  return 'hello';
}
```

## 결정/트레이드오프

(infra 글이면 필수) 무엇을 택했고 무엇을 버렸는지. 왜.

## 후속

다음에 할 일, 측정 지표, 관련 글.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시
재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
