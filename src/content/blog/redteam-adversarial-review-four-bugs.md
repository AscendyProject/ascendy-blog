---
title: "한 AI가 쓴 PR을 다른 AI가 리뷰하게 했더니 — 머지 전에 HIGH 결함 4개를 잡았다"
description: "redteam 0.3.0 사이클 동안, 한 AI가 쓴 PR을 다른-프로바이더 모델이 적대적으로 리뷰했다. 머지 전 real HIGH 결함 4개를 잡았고, 넷 다 같은 모양이었다 — ~95% 맞는데 보안 디테일 하나가 빠짐. 자기 코드를 리뷰하는 모델이 rubber-stamp하기 딱 좋은 종류다. 벤치마크가 아니라 프로젝트 자신의 merge log."
pubDate: 2026-06-16
author: "Ascendy Engineering"
tags: ["adversarial-review", "ai-agents", "code-review", "redteam", "trust", "semver"]
category: "meta"
lang: "ko"
translationKey: "redteam-adversarial-review-four-bugs"
sourceIntake:
  - "docs/intake/from-redteam/2026-06-16-version-bumps-and-adversarial-review.md"
draft: false
redactionReviewed: true
---

## TL;DR

- **redteam**(적대적 에이전트-페어 하네스, Apache-2.0)의 0.3.0 사이클에서, 한 AI 에이전트가 쓴 PR 묶음을 **다른-프로바이더 모델**이 PR별로 적대적 리뷰했다 — 하네스 자신의 전제를, 하네스 자신의 개발에 적용한 셈이다.
- 에이전트가 쓴 코드는 진짜로 좋았다. 그런데 교차-프로바이더 리뷰어가 **머지 전 real HIGH 결함 4개**를 잡았고, **넷 다 같은 모양**이었다 — *~95% 맞는데, 보안/정합성 디테일 하나가 빠짐.* (이건 [CHANGELOG 0.3.0](https://github.com/AscendyProject/redteam)에 직접 적혀 있다.)
- 핵심: 이 4개는 멍청한 버그가 아니다. **유능한 작성자(사람이든 AI든)가 happy path 통과 + 테스트 초록이라 그냥 출하하는** 종류다. 그리고 정확히 *자기 출력을 리뷰하는* 모델이 rubber-stamp하기 딱 좋은 종류다.
- 벤치마크가 아니라 **프로젝트 자신의 merge log**다. (N=1 — 통계적 증명이 아니라 "여기서 진짜, 찾기 비싼 결함을 잡았다".)

> **소스 노트.** redteam 팀 인테이크를 정제한 글이다. 전부 public OSS(`AscendyProject/redteam`, Apache-2.0)라 캐논은 공개 CHANGELOG·issue·PR에서 직접 확인했다. 같은 *적대적 리뷰* 결의 [redteam 런칭 글](/blog/redteam-launch/), [두 AI가 같은 답을 골랐다 — 값어치는 틀린 추론을 잡은 것](/blog/right-answer-wrong-reasoning/), [두 번째 AI를 어떻게 부르고 언제 멈추나](/blog/headless-adversarial-review-loop/)와 이어진다.

## 버전 번호가 이야기를 한다

pre-1.0 도구의 버전 번호는 보통 노이즈로 읽힌다. redteam의 건 아니다 — **0.2.0과 0.3.0이 "AI가 만든 도구가 신뢰를 얻으려면 뭐가 필요한가"에 대한 2막극**을 한다.

- **0.1.0 — 존재한다.** 독립 OSS repo로 추출, 비-Python 스택에서도 generic하게 돈다는 검증, 플러그인 패키징. *"이게 대체 돌긴 도나, 아무 데서나?"*
- **0.2.0 — 의견을 갖는다.** thesis를 코드로 박은 기능들. 대표 격은 **same-provider self-review를 fail-closed로 거부**하는 가드 — 하네스가 *자기 프로바이더의* 코드를 리뷰하는 걸 거부한다. 적대적 페어는 반드시 교차-프로바이더여야 한다는 믿음을, 부탁이 아니라 구조로 박았다. *"무엇을 믿고, 사용자가 몰 수 있나?"*
- **0.3.0 — 자기 자신을 견딘다.** 펀치라인은 여기다. 0.2의 능력을 *실제로 쓰자*(dogfooding) 그게 실패할 수 있는 지점이 전부 드러났고, 그래서 0.3은 거의 전부 **fail-closed backstop과 운영자 가시성**이다 — reviewer fallback ladder, dispatch 시점에 검증 스냅샷을 pin하는 invariant, vendored 복사본이 뒤졌는지 알리는 버전 스탬프, 길거나 detached run을 위한 운영자 진행 화면, 그리고 "fail open 말고 fail closed" 픽스 묶음.

**관통선:** v0.2는 "기능이 동작한다", v0.3은 "그 기능이 *드러낸* 현실의 난장을 견딘다". 에이전트가 만든 소프트웨어에선 이 간극이 전부다. happy path를 하는 첫 버전은 쉽다. **실패 상황에서 *틀린 일을 거부하는* 버전**이 믿을 수 있는 버전이다.

그리고 0.3이 "자기 자신을 견딘다"는 걸 증명한 게, 바로 이 사이클에서 일어난 일이다.

## 한 AI의 PR을, 다른 AI가 리뷰했다

redteam의 전제는 단순하다 — 한 모델이 코드를 쓰고, **다른 독립 모델**이 그 diff를 적대적으로 리뷰하고, 사람은 비가역 단계만 게이트한다. 0.3.0을 만들면서 이 전제를 **자기 자신에게** 적용했다. 0.3.0의 코드는 한 AI 에이전트가 쓰고, **다른 프로바이더의** 모델이 PR별로 적대적 리뷰어로 들어왔다.

결과는 [CHANGELOG에 한 줄로 박혀 있다](https://github.com/AscendyProject/redteam):

> "Every change landed through the harness's own cross-provider adversarial review (Codex reviewing Claude-written code), which caught **four real HIGH-severity defects before merge.**"

에이전트가 쓴 코드는 나빴던 게 아니다 — 오히려 좋았다. 문제는 넷 다 **같은 모양**이었다는 것이다: *~95% 맞는데, 보안이나 정합성 디테일 하나가 빠짐.*

## 잡힌 결함 4개 (전부 공개 repo에)

> 아래 4개의 세부는 redteam 팀의 review log 기록이다. 각 항목은 공개 issue/fix PR로 추적된다.

1. **'구멍을 막는' 강화가, 정확히 그 자리에 구멍을 냈다 (issue #39).** implement 전에 트리 변경을 막는 pre-implement 스냅샷 강화였는데, **강화 대상의 필드 하나를 빠뜨려** 부분 상태가 게이트를 통과해 트리를 변형할 수 있었다. 구멍을 막겠다는 fix가 *닫겠다고 선언한 바로 그곳에* 구멍을 갖고 있었다.
2. **사람용 진행 파일이 시크릿을 새길 뻔했다 (issue #49).** 운영자용 `progress.md`가 **raw 리뷰어 줄**을 그대로 미러했는데, 그 줄엔 시크릿이 인용될 수 있었다. 구조적·bounded 필드만 렌더하도록 고쳤다.
3. **fail-closed가 일인 게이트가, fail-open이었다 (issue #50).** commit 정합성 게이트에서 **실패한 git probe가 'clean'으로 읽혔다.** 게이트의 존재 이유가 "안전하게 막는 것"인데, 정작 실패 경로에서 열려 버렸다.
4. **인증 preflight가 credential을 누출했다 (issue #51).** PR-auth preflight가 **credential이 박힌 remote URL과 stderr**를 persist되는 상태로 흘려보냈다.

## 왜 이게 교차-프로바이더 리뷰의 논거인가

넷 다 **멍청한 버그가 아니다.** 유능한 작성자라면 — 사람이든 AI든 — happy path가 통과하고 테스트가 초록이라 그냥 출하하는 종류다. 더 정확히 말하면, **정확히 자기 출력을 리뷰하는 모델이 rubber-stamp하기 딱 좋은** 종류다. 자기가 쓴 코드를 자기가 보면, 자기 추론의 빈틈은 똑같이 안 보인다.

그래서 **작성자의 추론에 blind하고, refute하도록 프롬프트된 *다른* 모델**이 넷 다 잡았다는 게 핵심이다. 같은 모델에게 "한 번 더 봐"라고 시키는 self-review로는 안 잡혔을 결함을, *다른* 모델의 시선이 잡았다. 이게 교차-프로바이더 적대적 리뷰의 논거를 한 문단으로 보여준다 — 그리고 벤치마크가 아니라 프로젝트 자신의 merge log다.

## 정직하게 — 이건 N=1이다

과장하지 않는 게 맞다. 이건 **한 프로젝트의 한 사이클**이지 통제된 연구가 아니다. 주장은 "여기서 진짜, 찾기 비싼 결함 4개를 잡았다"지, "교차-프로바이더 리뷰가 통계적으로 우월하다고 증명됐다"가 아니다. 표본이 하나라는 걸 그대로 적는 게 이 글의 톤에 맞다.

그리고 로드맵과 출하를 섞지 않기 위해 — 리뷰어를 더 유연하게 갈아끼우는 작업(sub-agent reviewer adapter, 터미널 멀티플렉서 스크린스크래핑 거부 등)은 **아직 구현 전이다.** 0.3에 들어간 건 그 중 **fallback ladder 단계**까지다(issue #37). 나머지는 로드맵이지 "있다"가 아니다.

## 가져갈 것

- **AI가 만든 SW에서 신뢰할 버전은 happy path 버전이 아니라, 실패 상황에서 틀린 일을 거부하는 버전이다.** v0.2(기능이 동작)와 v0.3(그 기능이 드러낸 난장을 견딤)의 간극이 전부다.
- **결함은 멍청해서 나는 게 아니다.** 유능한 작성자가 "테스트 초록"이라 출하하는 *~95% 맞고 디테일 하나 빠진* 종류가 가장 위험하다. happy path는 그걸 안 잡는다.
- **self-review는 그 종류를 못 잡는다.** 자기 추론의 빈틈은 자기 눈에 똑같이 안 보인다. 작성자에 blind하고 refute하도록 시킨 *다른* 모델이 필요하다.
- **증거는 벤치마크가 아니라 merge log로도 충분하다 — N=1이라고 정직하게 적으면.** "여기서 이걸 잡았다"는, "일반적으로 우월하다"보다 약하지만 더 정직하고 검증 가능하다.

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
