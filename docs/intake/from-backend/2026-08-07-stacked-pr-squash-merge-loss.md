---
team: backend
date: 2026-08-07
topic: "리뷰까지 끝나고 GitHub에서 MERGED로 표시된 PR의 코드가 main에 하나도 없었다. PR-A가 PR-B의 브랜치 위에 스택돼 PR-B 브랜치로 머지됐고, 그 뒤 PR-B가 squash-merge로 main에 올라가면서 PR-B의 diff만 압축돼 갔다 — 브랜치에 얹혀 있던 PR-A의 커밋은 따라가지 않았다. 그런데도 GitHub은 PR-A를 MERGED로 표시했다. 배지는 'head가 그 PR의 base로 머지됨'을 뜻하지 'main에서 도달 가능함'을 뜻하지 않기 때문이다. 지상 진실은 배지가 아니라 트리에 있었고, git ls-tree로 파일 부재를, git merge-base --is-ancestor로 머지 커밋이 main의 조상이 아님을 확인해 유실을 확정했다. 복구는 현재 main에서 브랜치를 따고 잃은 브랜치에서 해당 파일만 checkout하는 방식으로 했으며, 그전에 merge-base 대비 main의 diff가 비어 있음을 확인해 main의 최신 변경을 덮어쓰지 않게 했다. 스택돼 있던 다른 PR은 base를 main으로 재타겟+리베이스해 같은 함정을 피했다. 결론: 완료 판단을 사람이 보는 UI 상태가 아니라 main 트리에 대한 기계적 확인으로 내려야 한다."
suggestedCategory: "backend"
suggestedTags: ["git", "github", "squash-merge", "stacked-prs", "ci-cd", "incident-prevention", "postmortem"]
source: "백엔드 팀 인테이크 1건의 정제본."
redactionReviewed: true
---

> **정제 노트.** 원본이 표시한 비공개 항목에 따라 **유실됐던 변경의 성격과
> 그 변경이 다루던 도메인, 관련 상수, 내부 브랜치명·PR 번호는 일반화**했다.
> 글의 교훈(스택 PR + squash에서의 유실과 그 탐지법)은 그 세부 없이 온전하다.
> 원본은 해당 변경이 후속 PR로 이미 재착륙(복구)된 상태임을 밝히고 있다.
> squash-merge를 표준 머지 방식으로 쓴다는 운영 세부는 도구 동작 설명에
> 필요한 만큼만 쓴다.

## 핵심 (원본에서 도출)

1. **증상.** 리뷰까지 끝나고 GitHub에서 **MERGED**로 표시된 PR의 코드가 `main`에
   하나도 없었다.
2. **경위.** PR-A가 PR-B의 브랜치 위에 **스택**돼 있었고, PR-A는 PR-B의 브랜치로
   머지됐다. 그 뒤 PR-B가 **squash-merge**로 `main`에 올라갔는데, squash는 PR-B의
   diff만 압축해 가져가고 그 브랜치에 얹혀 있던 PR-A의 커밋은 데려가지 않았다.
3. **왜 배지는 그대로 MERGED인가.** 배지는 **"head가 그 PR의 base로 머지됨"**을
   뜻하지 **"main에서 도달 가능함"**을 뜻하지 않는다. base가 `main`이 아니면 그
   사이에 갭이 생긴다. PR-A의 head는 자기 base 브랜치에서 여전히 도달 가능했다.
4. **지상 진실은 배지가 아니라 트리에 있었다.** 두 가지 기계적 확인으로 유실을
   확정했다 — 대상 파일이 `main` 트리에 있는지, 그리고 그 PR의 머지 커밋이 `main`의
   조상인지.
5. **복구는 파일 단위 재착륙.** 현재 `main`에서 브랜치를 따고, 잃어버린 브랜치에서
   **필요한 파일만** 가져왔다. 그전에 merge-base 대비 `main`의 해당 파일 diff가
   비어 있음을 확인해 **`main`의 최신 변경을 덮어쓰지 않게** 했다.
6. **예방.** 아래 PR이 머지되면 위 PR의 **base를 `main`으로 재타겟하고 리베이스**한다.
   아래 브랜치로 위 PR을 먼저 머지하면 squash에 삼켜질 위험이 있다.
7. **일반화.** 완료 판단을 사람이 보는 **UI 상태**가 아니라 **`main` 트리에 대한
   기계적 확인**으로 내려야 한다.

## 연결

- [배포했는데 아무것도 배포되지 않았다](/blog/deploy-that-deployed-nothing/) —
  초록불이 켜졌는데 프로덕션은 그대로였던 건. "성공 신호가 실제로 무엇을 쟀는가"라는
  같은 질문의 배포 판.
- silent-failure 계열([celery 로그](/blog/celery-silent-info-logs/),
  [dual-write](/blog/silent-primary-write-dual-write/)) — 실패가 신호를 남기지 않는 구조.

## 외부 공유 경계

원본이 표시한 비공개 항목을 승계한다. 유실됐던 변경의 성격·도메인·관련 상수,
내부 브랜치명과 PR 번호는 본문에 쓰지 않고 일반화한다.
