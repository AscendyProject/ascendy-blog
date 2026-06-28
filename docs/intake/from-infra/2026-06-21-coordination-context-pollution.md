---
team: infra
date: 2026-06-21
topic: "멀티-레포 + 멀티-에이전트 프로젝트에서 레포끼리 일을 넘기는 조정(coordination) 트래픽을 markdown 파일 → GitHub Issues로 옮긴 이야기. 첫 진단('레포가 커진다')이 틀림 — 디스크는 문제가 아니었다(조정 파일 수십 개에 수백 KB, docs는 코드의 한 자릿수 %). 진짜 비용 셋: reply-chain 파일 증식, 코드 레포 clutter, 그리고 제일 underrated한 'context pollution'(에이전트가 매 grep/ls마다 이 파일들을 context window로 끌고 와 토큰을 태움 = 매 턴 무는 세금). Issues가 셋 다 때림(threading, git tree 밖+on-demand gh, native lifecycle). 설계 반전: blanket 아니라 문서 타입으로 자름(ephemeral 조정→Issues, durable 결정문→git, 에디토리얼 intake→파일). 적대적 리뷰 4라운드가 잡은 5함정."
suggestedCategory: "meta"
suggestedTags: ["multi-agent", "developer-workflow", "github-issues", "context-window", "governance", "war-story", "adversarial-review"]
source: "infra 팀 인테이크(상위 워크스페이스 raw). 멀티에이전트 워크플로 일반 통찰 — 레포/org명·내부 번호는 redaction."
redactionReviewed: true
---

> **redaction(infra 캐논):** 실제 **레포명·org명**→일반화("우리 멀티-레포 셋업"/"the recipient
> repo"). 내부 PR/이슈 번호·decision-artifact 경로·핸드오프 파일 경로 제거. 라벨명
> (`cross-repo`/`from-<sender>`)은 일반적이라 예시로 사용 가능. 디스크 수치는 "수백 KB / 코드의
> 한 자릿수 %" 수준으로(레포 규모 역산 방지). 사업/비용/매출 수치 없음. 시크릿 없음. **이 글은
> 블로그가 #87에서 채택한 cross-repo 컨벤션의 *원본 결정* 측 이야기**라 메타적으로 완결된다.

## 무엇을 했나 (공개 가능)

여러 레포(백엔드·프론트엔드·블로그·인프라)가 각자 거버넌스로 도는 프로젝트에서, 레포끼리 일을
넘기는 **조정(coordination)** — "이거 너희가 해줘", 답장, 상태 핑 — 을 그동안 **markdown 파일**로
주고받았다(받는 레포 intake 디렉터리에 파일 떨굼). 이걸 **GitHub Issues**로 옮겼다. 단, 통째가
아니라 **문서 타입으로 잘랐다:** 핸드오프·답장·상태(ephemeral)→Issues, 결정문·설계기록(durable,
몇 년 뒤 인용·PR 리뷰·벤더 독립)→git 유지, 에디토리얼 intake(별도 편집 파이프라인)→파일 유지.

## 첫 진단이 틀렸던 지점 (글의 반전)

첫 프레이밍은 "레포가 커진다"였다. 데이터를 보니 **디스크는 문제가 아니었다** — 조정 파일 수십
개에 수백 KB, docs는 코드 디렉터리의 한 자릿수 %. 한 해 더 쌓여도 한 자릿수 MB. 디스크를 이유로
들면 *틀린 문제를 푸는 것*이었다. 진짜 비용은 셋:

1. **reply-chain 파일 증식.** 대화 하나가 파일 N개 — `...-reply`→`...-reply3`→`...-round5`.
   스레드가 아니라 파일이 쌓인다.
2. **코드 레포 clutter.** 대부분 stale인 조정 파일 수십 개가 *코드* 레포 트리에 섞인다.
3. **에이전트 context 오염(제일 underrated).** 에이전트가 작업하며 치는 매 `grep`/`ls`가 이
   파일들을 전부 context window로 끌고 들어와 토큰을 태운다. 사람에겐 '파일 좀 많네'지만,
   **에이전트 워크플로엔 매 턴 무는 세금**이다.

Issues가 셋을 정확히 때린다: **threading**이 reply-chain 파일을 없애고(이슈 1개 + 코멘트 왕복),
**git tree 밖**이라 clutter 0 + 평소 `gh`로 *on-demand* 조회라 context 오염 0, **native
lifecycle**(open/close/label/assignee)이 파일론 못 하던 pending→ack→done을 모델링. 덤으로
`Fixes #N` PR 링킹.

타입으로 자른 이유는 **durability/portability 트레이드오프** 하나다 — 파일-in-git은 영원히
남고 clone에 딸려오고 PR 인라인 리뷰되고 벤더 독립적. Issues는 GitHub DB에 산다. *몇 년 뒤
인용할* 결정문은 git, *한 번 쓰고 끝*인 조정만 Issues.

## 적대적 리뷰 4라운드가 잡은 5함정 (본편)

거버넌스 변경이라 다른 모델의 적대적 리뷰에 걸었다. "이슈로 옮긴다"는 1초면 합의되지만,
**디테일에서 4라운드** — 매 라운드가 실제 함정:

1. **숨은 페이지네이션 cap.** "에이전트가 과거 이슈를 다 본다"가 *자동이 아니었다.* `gh issue
   list`는 기본 **open만** + **`--limit 30`**. `--state all`을 줘도 30 cap은 안 풀린다. 컨벤션이
   `--state all` *그리고* 명시적 `--limit`을 둘 다 강제 안 하면 과거 조정이 조용히 잘린다.
2. **ack ≠ close.** 처음엔 "close = 완료/확인"이라 적었다. 리뷰어: 확인(봤다, 하는 중)과 완료는
   다르다 — **확인은 open 상태로 코멘트**, close는 *해결됐을 때만*(완료/거절/대체/무대응). 안
   그러면 pending 상태가 사라진다.
3. **CLI 구문.** `gh label create A B C`로 라벨 여러 개를 한 번에 만들려 했는데 이 명령은
   **이름 1개**만 받는다. loop로 고쳐야 한다.
4. **순서 함정.** 라벨은 이슈 생성 *전*에 존재해야 한다(없으면 `--label` 실패). "이슈부터,
   라벨 나중"으로 적었던 순서를 뒤집었다.
5. **누락 스윕.** 컨벤션을 서술하는 문서가 한 곳이 아니었다. 메인 문서만 고치고 주간-리뷰 루프
   문서의 라우팅 서술을 빠뜨린 걸 grep으로 잡았다.

교훈: **큰 결정은 합의가 쉽고, 비용은 디테일에 숨는다.** 적대적 리뷰는 "이걸 할까"가 아니라
"이렇게 하면 어디서 조용히 깨지나"를 잡을 때 값을 한다.

## 메타 아이러니

이 변경을 제안한 결정-seed 문서 자체가 *markdown 파일로 쓴 크로스-레포 핸드오프*였다 — 자기가
폐지하려는 그 메커니즘으로 전달됐다. 맞는 선택이다(새 컨벤션이 아직 없었으니). 적절하게도, 아마
마지막 파일 기반 핸드오프 중 하나다.

## 연결

- 적대적 리뷰가 디테일 함정을 잡은 결 → redteam 글([loop-engineering-verifier]).
- 토큰이 비용의 proxy라는 결([token-usage-not-productivity])과, *워크플로 구조가 토큰 비용을
  만든다*는 이 글의 각도가 맞물린다.

## 외부 공유 불가 (요약)

- 실제 레포명·org명(일반화). 내부 PR/이슈 번호·경로. 레포 규모 역산 가능한 정밀 디스크 수치.
  시크릿 없음.
