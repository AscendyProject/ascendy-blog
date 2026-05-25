# 인테이크 표준 포맷

3개 페어 팀(backend / frontend / infra)이 블로그팀에게 글감을 넘길 때 쓰는
표준 양식. 이 양식 없이 들어온 인테이크는 블로그팀이 되돌려 보낸다.

저장 위치: `docs/intake/from-<team>/YYYY-MM-DD-<kebab-topic>.md`
(예: `docs/intake/from-infra/2026-05-24-vcr-secret-phase1.md`)

블로그팀은 이 파일을 1차 소스로 보고 `src/content/blog/`에 게시물을
만든다. 게시물 frontmatter의 `sourceIntake:`에 이 파일 경로가
**반드시** 들어가야 한다.

---

## 인테이크 템플릿 (그대로 복사해서 채우세요)

```markdown
---
team: infra                  # backend | frontend | infra
proposer: "Claude (ascendy-infra)"   # 또는 "Codex (ascendy-infra)"
date: 2026-05-24
topic: "VCR secret 관리 Phase 1 — sanity-check hook"
suggestedCategory: "infra"   # 게시물 카테고리 힌트
suggestedTags: ["helm", "kubernetes", "secrets", "incident-prevention"]
urgency: "normal"            # urgent | normal | backlog
relatedPRs:
  - "https://github.com/AscendyProject/ascendy-infra/pull/7"
relatedDecisions:
  - "docs/agent-os/decisions/2026-05-24-vcr-secret-management.md"
publicReadyBy: "2026-06-01"  # 비워도 OK. 외부에 알릴 의무가 있다면 명시.

# 외부 자료 출처 (있을 때만)
# redaction-checklist §5 (라이선스/출처) 충족용. 인용·차용·재가공한
# 외부 코드/이미지/다이어그램이 있으면 항목별로 기재.
# 예:
# externalMaterials:
#   - kind: code-snippet
#     source: "https://github.com/withastro/astro"
#     license: "MIT"
#     usage: "Content Collections 예시 코드 일부 인용"
#   - kind: diagram
#     source: "내부 작성"
#     license: "ours"
externalMaterials: []
---

## 무엇을 했나 (5~15줄)

기술 선택, 변경 핵심.

## 왜 했나 (3~10줄)

배경, 트레이드오프, 다른 선택지.

## 외부에 공유해도 좋은 부분

- (이미 공개된 라이브러리/패턴 사용 사실)
- (일반화된 아키텍처 다이어그램)
- (인시던트 회피 패턴, 학습된 교훈)

## 외부에 공유하면 안 되는 부분 (블로그팀이 redaction 시 참고)

- (구체적 호스트명, 클러스터 이름)
- (registry path, image tag)
- (미공개 비즈니스 결정)
- (고객/파트너 식별 정보)

## 코드 / 설정 스니펫 (게시 가능한 형태로)

\`\`\`yaml
# 이미 일반화·redaction된 버전을 여기 붙여주세요.
# 원본을 붙이면 블로그팀이 정제 후 사용합니다.
\`\`\`

## 참고 링크

- 사내 인시던트 티켓 등은 **링크하지 마세요** (회사 내부 URL은 redaction
  대상). 공개 자료(블로그, 표준 문서, 라이브러리 README)만 링크.

## 블로그팀에게 (선택)

- 이 글의 톤이나 강조하고 싶은 포인트
- 글을 두 편으로 나눠도 좋다 / 한 편이 적절하다 같은 길이 의견
- "내가 직접 검수하고 싶다" (제안 팀의 사람/에이전트가 게시 전 리뷰)
```

---

## 블로그팀이 인테이크를 처리하는 방식

1. 인테이크 파일을 `docs/intake/from-<team>/`에서 읽는다.
2. `docs/redaction-checklist.md`를 한 항목씩 통과시킨다.
3. `src/content/blog/<slug>.md`를 `_template.md` 기반으로 만든다.
4. `sourceIntake:` frontmatter에 인테이크 파일 경로를 적는다.
5. `draft: true`, `redactionReviewed: false`로 PR을 연다.
6. Codex 리뷰 → redaction 재확인 → `redactionReviewed: true`, `draft: false` → 사람이 머지.
7. 머지되면 Cloudflare Pages가 자동 빌드·배포.
