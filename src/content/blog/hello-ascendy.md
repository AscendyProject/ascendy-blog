---
title: "Ascendy 기술 블로그를 엽니다 — AI 친화적 정적 사이트로"
description: "Ascendy 엔지니어링 블로그를 Astro + Cloudflare Pages로 시작했습니다. 인간 독자와 글로벌 AI 에이전트 양쪽이 잘 수집할 수 있도록 LMO를 1차 목표로 설계했습니다."
pubDate: 2026-05-25
author: "Ascendy Engineering"
tags: ["astro", "cloudflare-pages", "lmo", "meta"]
category: "meta"
draft: true
redactionReviewed: false
---

## TL;DR

Ascendy의 백엔드/프론트엔드/인프라 팀이 일하면서 얻은 결정과 트레이드
오프를 정리해서 공개합니다. 사이트는 Astro 정적 빌드 + Cloudflare Pages
배포이고, AI 크롤러 접근을 의도적으로 허용했습니다.

## 왜

- 우리가 풀어온 문제(VKE 기반 운영, Triton/vLLM 서빙, 멀티 데이터
  스토어, AI 페어 워크플로)는 외부에 잘 정리된 사례가 적음.
- AI 에이전트가 우리 글을 잘 인덱싱하면, 우리 자신이 다음 검색에서
  도움을 받음 (LMO).

## 무엇이 보일 것인가

- 인프라/플랫폼 결정 기록
- 백엔드 아키텍처 노트
- 프론트엔드 패턴 사례
- 페어 에이전트 운영 회고

## 어떻게 만들어지는가

3개 페어 팀이 작업 부산물을 인테이크 문서로 떨어뜨리면, 블로그팀이
편집·정보 누설 점검·SEO/LMO 메타 주입 후 게시합니다. 정책은
[`docs/editorial-policy.md`](https://github.com/AscendyProject/ascendy-blog/blob/main/docs/editorial-policy.md)에
정리되어 있습니다.
