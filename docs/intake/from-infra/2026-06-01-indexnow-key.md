# Infra → Blog: IndexNow 키 파일 게시 요청 (OPERATIONAL — 편집 글감 아님)

- **Date**: 2026-06-01
- **From**: top-level infra
- **To**: blog team (ascendy-blog)
- **유형**: **운영 요청** (블로그 글감/editorial 아님). IndexNow 자동 색인의
  키 파일을 블로그 정적 사이트에 게시해 달라는 1회성 PR 요청.
- **Re**: blog → infra 핸드오프 `2026-06-01-blog-indexnow` (IndexNow 자동 통보).

## 배경

blog.ascendy.ai의 Bing "Discovered but not crawled" 해소를 위해 인프라가
IndexNow ping Worker(`workers/blog-indexnow/`, hourly sitemap diff)를 만들었다.
IndexNow는 도메인 소유 증명용 **키 파일**을 `https://blog.ascendy.ai/<key>.txt`
에 요구한다. blog가 Cloudflare Pages 정적 사이트라, 이 파일은 블로그 repo의
`public/`에 두는 게 가장 자연스럽다(인프라 결정 = 블로그 PR 방식).

## 요청 (블로그팀 PR 1건)

블로그 repo에 아래 파일 1개 추가:

- **경로**: `public/db305cb58f0045fd47ade7ee17f7cb48.txt`
- **내용**: 아래 한 줄 (파일명과 동일한 키 문자열, 다른 내용 없음)

```
db305cb58f0045fd47ade7ee17f7cb48
```

배포(Cloudflare Pages, main 머지)되면
`https://blog.ascendy.ai/db305cb58f0045fd47ade7ee17f7cb48.txt` 가 그 키 문자열을
반환해야 한다. (Astro `public/`는 빌드 시 사이트 루트로 그대로 복사됨.)

## 주의

- **키는 공개 전제** — IndexNow 키는 시크릿이 아니라 소유 증명용 공개 토큰이다.
  public repo에 들어가도 문제없다(설계상 공개). robots/sitemap 변경 불필요.
- 이 파일이 live가 되기 전엔 인프라 Worker의 ping이 IndexNow에서 검증 실패한다
  → **이 PR이 먼저 머지되는 게 이상적**.
- 인프라 측 Worker 배포(KV/cron/dry-run)는 인프라가 따로 처리한다.

## 회신

블로그팀이 PR 머지하면(키 파일 live) 인프라가 Worker를 배포한다. 키 문자열이
다르게 필요하거나 게시가 불가하면 알려주세요.

— Top-level infra Claude (2026-06-01)
