---
team: infra
proposer: "top-level infra Claude (설계 + 문서화, operator가 결정·머지)"
date: 2026-06-04
topic: "주기적 모니터링 리포트는 그 자체로 가치 0, '측정→분석→개선→재측정' 닫힌 루프일 때만 의미. 끊긴 고리는 'measure'가 아니라 'capture→route'(사람 기억에 의존하는 manual relay)였다는 진단 + durable backlog/agent drafting 해법 + 만료 자동화 삽질"
suggestedCategory: "meta"
suggestedTags: ["monitoring", "observability", "feedback-loop", "process-design", "automation", "agent-ops"]
redactionReviewed: true
---

> 상위 인프라 팀 raw 글감의 redaction 정제본. **Class A(글에 넣지 않음)**: 이 루프가 첫 사이클에
> 포착한 *현재 열린 운영 항목들의 구체 내용*(카테고리·식별자·상태) — 미remediated라 공개 시
> "지금 이 구멍이 열려 있다" 신호가 된다. 글감 자체가 이미 원칙만 담아 제외했고, 발행 글도 동일.
> **Class C(식별자 일반화)**: backlog 파일 경로·cross-repo 핸드오프 디렉터리·내부 레포/세션 명칭·
> 노드/네임스페이스/시크릿 식별자 → "추적 backlog 파일", "owning 레포로 핸드오프" 수준. 거버넌스
> 문서(risk-policy tier/gate 명칭, Agent OS 세부)도 일반화 — "agent는 제안, 사람이 실행" 원칙 수준만.
> agent-os-dogfooding / headless-adversarial과 같은 프로세스/AI협업 메타 — 상호 링크 권장.

## 무엇을 했나

주기적으로 도착하는 리포트를 손보다가 한 가지를 분명히 했다. **주기적으로 도착하는 리포트는
그 자체로는 가치가 0이다.** 가치는 그게 닫힌 루프를 굴릴 때만 생긴다:

```
측정(measure) → 분석(analyze) → 개선(improve) → 재측정(re-measure)
```

리포트가 매주 와도, 보고 → 고치고 → 다시 재는 데까지 이어지지 않으면 그냥 주기적으로 도착하는
숫자일 뿐이다. 이 원칙을 우리 운영 모니터링에도 적용해보니 루프가 어디서 끊겼는지 선명해졌고,
그 끊긴 지점을 메우는 작은 process 설계를 했다(코드가 아니라 운영 모델 변경).

## 왜 — 끊긴 고리는 'measure'가 아니라 'capture→route'였다

모니터링을 개선하자면 흔히 "지표를 더 모으자 / 대시보드를 더 만들자"로 간다. 그런데 루프를 단계로
쪼개 보니 그쪽이 아니었다.

```
[1 surface] → [2 capture] → [3 route to actor] → [4 act] → [5 re-measure]
 알림·리포트·추세      (사람의 기억 + 재전달에 의존)        PR / 핸드오프
                      ^^^^^^^ 여기가 끊김 ^^^^^^^
```

- **1단계(surface)**: 알림·리포트·추세는 *이미* 개선점을 내보내고 있었다.
- **4–5단계(act, re-measure)**: PR·핸드오프·재측정 메커니즘도 이미 있었다.
- **끊긴 곳은 2–3단계**: 떠오른 개선점이 **사람이 그걸 기억해서 올바른 자리에 다시 옮겨 넣어야**
  비로소 행동으로 이어졌다.

즉 **사람이 manual relay 병목**이었다. 모니터링은 개선점을 내보내는데, 사람이 다시 전달하지 않으면
신호는 거기서 죽는다. 사람의 기억은 휘발성이고, 신호 수는 사람보다 많다. 진짜 gap은 "측정 부족"이
아니라 "측정된 게 행동하는 쪽으로 **라우팅되지 않고 증발**"이었다.

## 핵심 설계 — 사람을 transport에서 빼되, approver로는 남긴다

두 가지를 사람의 머리 밖으로 뺐다.

1. **Durable capture** — 떠오른 개선점을 추적 가능한 backlog 한 장에 행으로 적는다. 사람의 기억
   대신 파일이 들고 있는다.
2. **Agent-driven routing** — 주간 리뷰에서 **agent가** backlog + 추세를 읽고, 각 항목에 대해
   PR이나 cross-repo 핸드오프 **초안을 직접 작성**한다.

여기 결정적 분리가 하나 있다. **병목을 없애는 것은 "무엇이 리뷰를 트리거하느냐"가 아니라 "리뷰가
무엇을 하느냐"다.** trigger는 여전히 사람이 주간에 한 번 당겨도 된다. 하지만 그 한 번의 트리거 뒤에
agent가 핸드오프를 *이미 초안해 두면*, "사람이 신호를 하나하나 기억해 재전달하거나 아니면 죽는다"가
"사람이 주간에 한 번 트리거하고, agent가 초안한 걸 승인한다"로 바뀐다. **per-signal relay가 사라진다.**
사람은 transport가 아니라 approver로 남는다("agent는 제안, 사람이 실행" 경계와도 맞는다).

## 삽질 — "자동 스케줄러로 돌리자"가 틀렸던 지점

처음 추천은 "주간 자동 리뷰를 스케줄러 잡으로 영구히 돌리자"였다. 그런데 실제 스케줄 기능을 확인해
보니 — **그 잡은 세션 스코프이고 약 7일 뒤 자동 만료**된다. "영구 자동 엔진"이 아니었다. 추천을
그대로 뒀으면 "매주 자동으로 돈다"고 적어 놓고 일주일 뒤 조용히 멈추는, 정확히 우리가 고치려던 그
"조용한 증발"을 재현할 뻔했다.

그래서 정정했다. **trigger는 사람이 주간에 한 줄로 시작하고(필요하면 가벼운 리마인더가 찌르는
정도), 병목 제거의 본질은 위의 "agent의 초안 작성"에 있다고 명시.** trigger 자동화 여부는 부차적이고,
신호가 죽지 않게 하는 load-bearing 부품은 durable backlog + agent의 drafting이다.

> **교훈: "자동화로 해결"이라고 적기 전에 그 자동화 수단의 수명·스코프를 먼저 확인하라. 만료되는
> 자동화는 자동화가 아니다.**

## 두 번째 함정 — backlog가 다음 'dead queue'가 되지 않게

durable list엔 함정이 있다. **lifecycle이 없는 list는 병목을 "사람의 기억"에서 "stale TODO 더미"로
옮길 뿐이다.** 적어 놓고 아무도 안 보면 똑같이 증발한다. 그래서 backlog를 free-form 메모가 아니라
상태 기계로 만들었다.

- 각 항목은 필드를 갖는다: 언제 떠올랐나 / 무엇이 surface 했나 / 누가 owner인가 / 다음 행동 /
  상태(open→routed→acting→done/dropped) / 우선순위 / 마지막 리뷰일.
- 주간 리뷰의 **hard rule: 매 사이클 모든 open 항목을 *반드시* touch** — 진전시키거나,
  재우선순위화하거나, 이유를 적고 닫거나. 손 안 댄 항목을 남기지 못한다.
- **2사이클 동안 손 안 댄 항목은 STALE로 자동 escalate** → 조용히 썩지 않는다.
- **WIP cap(사이클당 최대 N건 라우팅)** → 전부 쏟아내지 않고 우선순위로 triage.

이 hygiene 규칙이 없으면 backlog는 그냥 더 큰 무덤이 된다.

## 외부에 공유해도 좋은 일반 교훈
- **주기적 리포트/알림은 그 자체로 가치 0, 닫힌 루프일 때만 의미.**
- 루프를 단계(surface→capture→route→act→re-measure)로 쪼개 끊긴 고리를 찾는 방법, 그리고 우리 경우
  끊긴 곳이 'measure'가 아니라 'capture→route'였다는 진단.
- "사람이 relay 병목"이라는 안티패턴, "agent가 핸드오프 초안 작성 → 사람은 승인만"으로 사람을
  transport에서 빼되 approver로 남기는 패턴.
- **"trigger 자동화 ≠ 병목 제거"** 분리, 만료되는 자동화 수단을 영구 엔진으로 착각했다 정정한 삽질.
- durable backlog가 다음 dead queue가 되지 않게 하는 anti-rot lifecycle(매 사이클 전 항목 touch /
  N사이클 미접촉 escalate / WIP cap).
- 이 루프가 *reactive* 알림의 *proactive* 보완이라는 프레이밍(알림은 터진 뒤, 추세 리뷰는 터지기 전).

## 코드/설정 스니펫 (일반화)
```
# 끊긴 고리를 찾는 도구 — 루프 단계 분해:
[1 surface] → [2 capture] → [3 route to actor] → [4 act] → [5 re-measure]
                ^^^ 사람 기억에 의존 → 여기가 끊겼다 ^^^

# backlog anti-rot 규칙(요지):
- 매 사이클: 모든 open 항목을 touch(진전/재우선순위/이유 적고 닫기). 미접촉 금지.
- 2사이클 미접촉 → STALE 자동 escalate.
- WIP cap: 사이클당 최대 N건만 라우팅(우선순위 triage).
- 모든 PR/핸드오프는 사람 승인용 '초안'(agent는 제안, 사람이 실행).
```
(실제 backlog 파일 경로·행 내용·식별자는 Class A/C로 제외 — 위 스니펫 수준의 익명 패턴만.)
