---
# 서비스 블로그(`/stories/`) 글 템플릿.
# 편집 규약은 docs/service-blog-policy.md가 구속한다. 기술 블로그(src/content/blog/)와
# 독자·목적·톤이 다르니 그 템플릿을 복사해 쓰지 말 것.

# 제목 — 제품 이름이 아니라 문제·경험으로 시작한다.
#   나쁨: "Ascendy가 AI 검색을 개선했습니다"
#   좋음: "앨범 정리를 그만둔 이유"
title: "제목 — 8~120자, 문제나 경험으로 시작"

# 40~220자. 메타 디스크립션과 Schema.org abstract에 그대로 쓰인다.
# ko/en 양쪽 모두 220자 상한이며, en이 같은 내용에 약 1.8배를 쓰므로 특히 주의.
description: "이 글이 다루는 상황과 문제를 한두 문장으로 적습니다. 마케팅 문구는 쓰지 않고, 독자가 제목만 보고도 자기 상황이라고 알아볼 수 있게 씁니다."

pubDate: 2026-08-17
# updatedDate: 2026-09-01   # 수정 시에만

# 서비스 블로그는 창업자 1인칭이 기본이다.
author: "Ascendy"

tags: ["photo-management", "family-photos"]

# real-stories | building | guides | philosophy
#   real-stories — 실제 사진 관리 경험
#   building     — Build in Public (문제 발견 → 왜 불편했나 → 무엇을 바꿨나 → 지금 어떤가)
#   guides       — 사진 관리 정보성 콘텐츠 (검색 유입)
#   philosophy   — 왜 이 제품을 만드는가
category: "real-stories"

# ko가 원문, en이 번역판. 북미가 1차 타깃이라 en 판을 반드시 함께 낸다.
lang: "ko"
translationKey: "post-slug-without-lang-suffix"

# ⚠️ real-stories / building / philosophy 는 sourceIntake가 **필수**다(빌드 실패).
#    창업자의 개인 경험은 인터뷰를 통해서만 글에 들어온다 — 인터뷰에서 나오지 않은
#    장면·숫자·감정은 쓰지 않는다. guides만 면제.
sourceIntake:
  - "docs/intake/from-user/2026-08-17-<topic>.md"

# main 머지 = 즉시 배포. 초안은 true로 두고 PR에만 둔다.
draft: true

# docs/service-blog-policy.md의 공개 경계를 모두 통과한 뒤에만 true.
redactionReviewed: false
---

## (도입) 실제 상황

구체적인 장면으로 시작한다. 언제, 무엇을 하려다, 무엇이 막혔는지.

## 문제

왜 어려웠는지. 기존 방법(앨범·폴더·메신저·스크롤)을 어떻게 썼고 왜 안 됐는지.
경쟁 서비스를 부당하게 깎아내리거나 사실을 왜곡하지 않는다.

## 깨달음

문제의 본질에 대한 생각.

## 무엇을 바꿨나

Ascendy에서 이 문제를 어떻게 다뤘는지. 기술 이름이 아니라 **사용자가 느끼는 결과**로
설명한다. (`Milvus`, `임베딩`, `벡터 검색` 같은 말은 이 블로그에선 대부분 불필요하다.)

## 지금은 어떤가

바꾼 뒤 실제 사용 경험. 완성됐다고 주장하지 않는다.
아직 부족한 점이 있으면 그대로 쓴다.

---

**남은 것**: 아직 테스트 중이거나 개선하고 싶은 부분을 한 줄로. Build in Public이므로
열린 결말이 정상이다.
