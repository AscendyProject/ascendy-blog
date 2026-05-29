---
team: infra
date: 2026-05-28
topic: "거버넌스 doc의 명령 형태와 chart의 runtime contract가 따로 진화하면, 다음 PR의 spec-driven verify가 false negative를 만들고 그것이 '환경 breakage'로 오분류된다 — doc-as-spec workflow의 구조적 약점"
suggestedCategory: infra
suggestedTags: ["helm", "documentation", "agent-workflow", "root-cause-analysis"]
redactionNote: "원본(infra private repo)의 내부 식별자(PR 번호, chart 경로, CI 파일명, 거버넌스 doc 섹션명, component 이름, placeholder 문자열, chart 디렉토리명, 누적 카운트)는 일반화 후 게재."
---

# (정제본) Spec을 따랐는데 false negative — doc-as-spec의 path drift

> infra 팀 raw 인테이크의 redaction 정제본. raw 원본은 infra private repo의
> `docs/blog-intake/`에 있다. 포스트의 `sourceIntake`가 이 파일을 가리킨다.

## 무엇을

한 PR의 verify 단계에서 거버넌스 doc의 명령을 그대로 돌렸더니 fail했다. 첫 분석은
"main의 pre-existing breakage"였고 별건 분리로 PR 머지를 막지 않았다. 다음 사이클
직전 재조사하니 main은 broken이 아니었다 — chart는 sound한데 **거버넌스 doc의 명령
형태가 chart의 runtime 요구사항과 갈라져** 있었다. spec을 따른 agent가 false
negative를 만들었고, 그게 "외부 환경의 breakage"로 오분류된 사건. 후속 PR이 doc의
명령 두 블록을 chart의 실제 invocation 형태와 일치시켜 fix했다.

## 왜 — 직접 원인은 사소, 구조는 아니다

chart의 helpers가 어느 시점에 `required` 가드를 받았다(이미지 태그가 빈 채 release
나가는 regress 차단용). 가드 후로는 `helm template`/`helm lint`가 image tag를
명시 supply받아야 통과. CI lint job은 갱신돼 placeholder를 전달 → CI green. 그러나
**거버넌스 doc의 명령 블록은 갱신되지 않았다** — 가드 도입 전 형태 그대로. 같은
chart, CI는 통과, doc-follower는 fail.

구조적 약점: 거버넌스 doc은 agent가 verify 시 읽는 단일 진입점("이 명령 돌리면
verify 끝")이다. CI는 그 promise의 *실행*이지 *정의*가 아니다. chart의 runtime
contract가 바뀌면(가드 도입, 새 required field 등) doc의 명령이 더 이상 진짜
요구를 반영하지 않는데, CI는 자기 invocation으로 통과하면 끝이라 그 gap을 못 잡는다.
→ 두 source of truth가 같은 chart에 다른 명령을 말하기 시작하고, 다음 agent가 doc을
따르면 spec을 정확히 실행했는데도 false negative를 받는다. false negative의 첫
instinct는 "환경 문제"라, drift가 한 사이클 더 이어진다.

## 공개 가능 (게재 OK)

- doc-as-spec workflow의 구조적 약점 — doc이 코드의 runtime contract와 sync 안 되면
  verify 자체가 거짓말을 한다.
- false negative → "환경 문제" 오분류 → drift 연장의 메커니즘.
- 한 파일 안에 같은 drift가 두 번(명령 블록이 두 곳) 존재할 수 있다 — 한 곳만 fix하면
  같은 PR에서 즉시 재발.
- chart-level 가드 도입 시 sync surface가 "doc + CI + agent verify" 세 군데로 는다.
- 누적 카운트 라벨링의 가치 — 개별 사건을 패턴으로 보이게 한다.

## redaction 적용 (원본 → 일반화)

- PR 번호 → "가드 도입 PR / CI audit PR / doc sync PR"
- chart의 helpers 파일 경로(chart 디렉토리 포함) → "chart의 helpers 파일"
- CI 파일명 → "CI audit workflow"
- 거버넌스 doc 섹션명 → "거버넌스 doc의 명령 블록"
- component 5개 실명 → "5개 component"
- placeholder 문자열 → "placeholder 값"
- chart 디렉토리명 → "프로덕션 Helm chart"
- 누적 카운트 숫자 → "반복해서 catch된 패턴"(숫자 비공개)

## 외부 인용 링크 (공개)

- Helm `required`: https://helm.sh/docs/chart_template_guide/functions_and_pipelines/#using-the-required-function
- Helm `--set`: https://helm.sh/docs/intro/using_helm/#the-set-flag
