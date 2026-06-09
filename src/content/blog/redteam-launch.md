---
title: "리뷰어가 '괜찮아 보여요'만 하면 무슨 소용인가 — 적대적 에이전트-페어 하네스 redteam 공개"
description: "두 번째 모델에게 코드 리뷰를 맡겨도 '괜찮아 보여요' 한마디면 고무도장이다. 오픈소스 하네스 redteam(v0.1.0)은 리뷰를 pass/fail이 아니라 티어드 발견(blocker/major/minor)으로 다루고, 살아남은 blocker를 재시도→rescue→사람으로 에스컬레이션한다. 한 모델이 쓰고, 다른 독립 모델이 적대적으로 검수한다."
pubDate: 2026-06-10
author: "Ascendy Engineering"
tags: ["ai-collaboration", "adversarial-review", "open-source", "developer-tools", "agent-harness"]
category: "meta"
lang: "ko"
translationKey: "redteam-launch"
sourceIntake:
  - "docs/intake/from-redteam/2026-06-10-redteam-launch.md"
draft: false
redactionReviewed: true
---

## TL;DR

- **redteam**을 오픈소스로 공개한다(v0.1.0, AGPLv3). 한 모델이 test-first 파이프라인(plan→test→implement)으로 코드를 쓰고, **다른 독립 모델**이 그 diff를 적대적으로 리뷰하고, 사람은 비가역 단계만 게이트하는 **적대적 에이전트-페어 하네스**다.
- 리드 차별점 ⭐: **리뷰가 pass/fail이 아니다.** 리뷰어가 각 발견에 severity(blocker/major/minor)를 매기고, 오케스트레이터가 **라운드를 가로질러 추적**한다. 살아남은 blocker는 **재시도 → 더 무거운 `rescue` 패스 → 사람**으로 사다리를 오른다.
- 효과: 한 번의 거절이 런을 죽이지 않고, **고집스런 진짜 버그가 한 번의 재시도로 슬쩍 통과하지 못한다.**
- 정직하게: **early(v0.1.0)**다. 자동 tier-routing은 로드맵(#13)이지 이번 릴리스엔 없다.

> **소스 노트.** 이 글의 canonical 소스는 공개 repo([AscendyProject/redteam](https://github.com/AscendyProject/redteam))이고, 사실은 발행 시점에 README를 직접 확인해 박았다. 우리가 그동안 쓴 적대적 리뷰 글 — [두 번째 AI를 어떻게 부르고 언제 멈추나](/blog/headless-adversarial-review-loop/), [두 AI가 같은 답을 골랐다](/blog/right-answer-wrong-reasoning/), [멀티 AI를 붙였더니 느려졌다](/blog/agent-os-dogfooding-journey/) — 에서 다룬 패턴이 이제 하나의 도구로 추출됐다.

## 문제 — 두 번째 모델도 고무도장을 찍는다

한 모델에게 코드를 쓰게 하고 **그 모델에게 자기 코드를 리뷰**시키면, 대개 통과다. 자기가 방금 내린 결정을 자기가 의심하긴 어렵다. 그래서 "두 번째 모델을 붙이자"가 자연스러운 다음 수다.

그런데 두 번째 모델도 함정이 있다. 디프를 던지고 "리뷰해줘" 하면, 꽤 자주 **"괜찮아 보여요(looks good)"** 한마디가 돌아온다. 모델은 동의에 능하다. 그 "괜찮아 보여요"가 *리뷰를 한 것*인지 *고무도장을 찍은 것*인지, 출력만 봐선 구분이 안 된다.

질문은 이거다. **리뷰가 실제로 *행동*하게 만들려면 무엇이 필요한가?** redteam의 답은 리뷰의 *형식*에 있다.

## 답 — 티어드 발견 + 에스컬레이션 사다리

redteam에서 리뷰는 pass/fail이 아니다. 리뷰어는 각 발견에 **severity**를 붙인다 — `blocker` / `major` / `minor`. 그리고 오케스트레이터가 그 발견들을 **여러 라운드에 걸쳐 추적**한다. 핵심은 "추적"이다 — 한 라운드의 판정으로 끝나지 않고, 같은 발견이 다음 라운드에도 살아있는지를 본다.

살아남은 `blocker`는 **사다리를 오른다.**

```text
blocker가 여러 라운드 생존 →  worker 재시도
                          →  더 무거운 rescue 패스
                          →  사람(ask_user)에게 인계
```

이 구조가 두 방향의 실패를 동시에 막는다.

- **한 번의 거절이 런을 죽이지 않는다.** 리뷰어가 한 번 막아도, worker가 고칠 기회를 갖는다. "리뷰어가 틀렸을 수도 있는데 통째로 멈춰버리는" 과민함을 피한다.
- **고집스런 진짜 버그가 슬쩍 통과하지 못한다.** 한 번의 재시도로 안 고쳐진 blocker는 사라지지 않고 *더 무거운 패스*로, 끝내 *사람*에게로 간다. "한 번 거절했다가 다음 라운드에 잊혀지는" 누수를 막는다.

이게 redteam을 평범한 "두 모델" 셋업과 가르는 지점이다. 대부분은 리뷰를 *통과/실패*로만 다루는데, redteam은 발견 하나하나를 *심각도와 함께 시간축으로* 끌고 간다.

## 분리를 구조로 — 리뷰어는 작성자에 눈먼다

티어드 사다리가 작동하려면 리뷰가 진짜 적대적이어야 한다. redteam은 그걸 *구조*로 강제한다.

리뷰어는 **신선한 에이전트**이고, 설정상 **다른 모델**일 수 있으며, **diff와 보안 체크리스트만** 본다 — **구현자의 추론은 절대 못 본다.** 작성자가 "이래서 이렇게 했어요"라고 변호할 통로 자체가 없다. 리뷰어는 결과물만 보고, 자기 시각으로 친다.

그리고 **비가역 단계는 사람이 게이트한다** — plan 승인과 PR 생성은 사람이 승인하기 전엔 막혀 있다. 에이전트가 제안하고, 사람이 되돌릴 수 없는 문을 연다.

## 위험에 맞춰 노력을 조절한다

redteam은 모든 변경에 쓰는 도구가 아니다. **헤비웨이트 경로**다 — 오타 고치는 데 쓰라는 게 아니라, **guarded(인증·저장소·동시성·public API)·전략/아키텍처** 변경처럼 *틀리면 비싼* 일에 쓰는 것이다.

노력을 위험에 맞추는 레버가 둘이다.

- **역할별 모델** — `.redteam/config.toml`에서 worker와 reviewer에 각각 모델을 바인딩한다. 루틴엔 싼 구현자, guarded엔 프런티어 리뷰어 식으로.
- **에스컬레이션 사다리** — 위에서 본, 심각도에 따라 더 무거운 패스로 올리는 구조.

**정직하게 짚자.** 변경의 성격을 보고 *자동으로* 적절한 티어를 고르는 라우팅은 — 좋은 그림이지만 — **로드맵(#13)이지 이번 릴리스엔 없다.** v0.1.0은 레버를 *손에 쥐여주는* 단계지, 자동으로 당겨주는 단계가 아니다.

## 모델 자유

worker든 reviewer든 **Claude 또는 Codex**를 꽂을 수 있다(역할별 설정). 한쪽이 쓰고 다른 쪽이 검수하되, 어느 모델이 어느 역할을 맡을지는 당신이 정한다 — 우리 글 [두 AI가 같은 답을 골랐다](/blog/right-answer-wrong-reasoning/)에서 본, "같은 결론이라도 둘째 모델이 *근거*를 친다"는 그 충돌을, 모델 조합을 바꿔가며 쓸 수 있다.

## 써보기

redteam은 **런타임 의존성이 없고**(stdlib-only, 프로젝트 비종속), 벤더드로 설치된다. early(v0.1.0)지만 — **내부 모노레포에서 추출돼 거기서 실제 머지된 PR들을 구동했고**, JS/TS 프론트엔드에서 cross-stack으로 검증됐다. API·레이아웃은 아직 움직일 수 있다.

```text
# Claude Code 플러그인 (권장)
/plugin marketplace add AscendyProject/redteam
/plugin install redteam@ascendy-redteam
/redteam:redteam-install

# 또는 어떤 스택이든 직접 벤더
python3 .redteam/scripts/install.py /path/to/your/project
```

라이선스는 **AGPLv3**, 기여는 CLA(대체/상업 라이선스 옵션 보존). 저장소: [github.com/AscendyProject/redteam](https://github.com/AscendyProject/redteam).

## 가져갈 것

- **두 번째 모델을 붙이는 것만으로는 부족하다.** "괜찮아 보여요"는 리뷰가 아니라 고무도장일 수 있다. 리뷰가 *행동*하게 하려면 그 형식 — 심각도·라운드 추적·에스컬레이션 — 이 필요하다.
- **한 번의 거절이 런을 죽여서도, 고집스런 버그가 한 번에 통과해서도 안 된다.** 에스컬레이션 사다리(재시도→rescue→사람)가 그 둘을 동시에 막는다.
- **분리는 구조여야 한다.** 리뷰어가 작성자의 추론을 못 보고, 다른 모델이고, 비가역 단계는 사람이 게이트한다.
- **노력은 위험에 맞춘다.** redteam은 guarded/전략 변경용 헤비웨이트 경로다. (자동 라우팅은 로드맵 #13 — 아직 손으로 단다.)

---

**저작·인용**: 이 글은 Ascendy Engineering이 작성했으며 출처 표기 시 재인용 가능합니다. 잘못된 정보를 발견하면 GitHub 이슈로 알려주세요.
