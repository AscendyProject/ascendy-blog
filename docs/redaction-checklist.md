# Redaction Checklist

블로그 PR 머지 전 **모든 항목을 통과**해야 한다. 통과 못 한 항목이 하나라도
있으면 `redactionReviewed: false`를 유지하고 머지 차단.

이 체크리스트는 ascendy 상위 워크스페이스의 forbidden surfaces 정책을
계승한다. 상위 정책이 늘어나면 여기도 늘려라.

---

## 0. 항상 (게시 전 자동/수동 모두)

- [ ] `grep -REi 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-' src/content/blog/<file>` → 0건
- [ ] `grep -REi 'BEGIN .*PRIVATE KEY' src/content/blog/<file>` → 0건 (BSD/GNU grep 양쪽 호환)
- [ ] `grep -REi 'password|passwd|secret|token|api[_-]?key' src/content/blog/<file>` 검토 — 문맥상 무해한지 사람이 한 번 더 본다

## 1. 인증/시크릿

- [ ] AWS / GCP / Azure / Cloudflare / Vultr API 키 없음
- [ ] kubeconfig 토큰, ServiceAccount 토큰, `bearer ...` 헤더 값 없음
- [ ] `helm/langfuse-*.yaml`이나 `.env*` 파일 내용이 본문/코드 블록에 노출되지 않음
- [ ] Firebase service account JSON, Stripe key, OpenAI/Anthropic API key 없음
- [ ] DB 패스워드, Redis 패스워드, Neo4j 패스워드, Elasticsearch 패스워드 없음

## 2. 사내 식별자 (호스트/네트워크/리소스)

- [ ] 사내 도메인(`*.ascendy.internal` 류, 비공개 prod 호스트명) 없음 — 공개
      서비스 도메인(`api.ascendy.ai`, `blog.ascendy.ai`)은 OK
- [ ] 클러스터 이름, namespace 이름이 그대로 노출되어 곤란한 경우 일반화
      (예: `vke-prod-ascendy-1` → "프로덕션 VKE 클러스터")
- [ ] 사내 IP (10/8, 172.16/12, 192.168/16) 노출 없음
- [ ] VCR(`ewr.vultrcr.com/ascendy/*`) 경로의 비공개 이미지 태그가 코드
      블록에 그대로 박혀있으면 일반화
- [ ] R2 bucket 이름(`ascendy-storage`, `ascendy-storage-dev`) 노출이
      필요한지 재고
- [ ] 인시던트 티켓 번호, 사내 Slack URL, 사내 Jira/Linear URL 없음

## 3. 비즈니스 / 사람

- [ ] 고객명, 파트너사명, 거래 금액, 계약 조건 없음 (사전 공식 발표가
      없는 한)
- [ ] 직원 실명/직책/이메일 — 본인 동의 없이는 게재 금지. `Ascendy
      Engineering`으로 통칭
- [ ] 미공개 로드맵/제품 계획/가격 정책 없음
- [ ] 인수/투자/채용 등 발표 전 정보 없음

## 4. 코드 / 설정

- [ ] 코드 블록이 실제 prod 설정에서 잘라온 경우 일반화·sanitize 완료
- [ ] 환경 변수 예시는 가짜 값 (`API_KEY=YOUR_API_KEY_HERE`) 사용
- [ ] DB 스키마 공개 시 컬럼명/제약이 비즈니스 로직 노출인지 확인
- [ ] 마이그레이션 파일 원본 붙여넣기 금지 — 패턴만 추출해서 재작성

## 5. 외부 라이선스 / 출처

- [ ] 외부 코드 인용 시 라이선스 호환 확인 (CC, MIT, Apache 등 명시)
- [ ] 외부 이미지/다이어그램은 출처와 사용 권한 명기

## 6. AI 학습 노출 의식

이 글은 AI 크롤러가 가져갈 것을 전제로 한다. 따라서:

- [ ] "이 정보가 누군가의 학습 코퍼스에 들어가도 우리에게 손해가 없는가"를
      자문하고 통과
- [ ] 외부 인용 시 잘려도 의미가 유지되도록 문단 단위로 self-contained
      (TL;DR, 결론 단락이 특히 중요)

---

## PR 본문에 적을 것

```markdown
## Redaction
- [x] §0 항상
- [x] §1 인증/시크릿
- [x] §2 사내 식별자
- [x] §3 비즈니스/사람
- [x] §4 코드/설정
- [x] §5 외부 라이선스
- [x] §6 AI 학습 노출 의식

검토자: Claude (블로그팀), 재검토자: Codex (블로그팀)
raw 원본: ascendy-infra/docs/blog-intake/2026-05-24-vcr-secret-phase1.md
정제본(sourceIntake): docs/intake/from-infra/2026-05-24-vcr-secret-phase1.md
```

frontmatter `redactionReviewed: true`는 위 체크가 모두 끝났을 때만 true로.
