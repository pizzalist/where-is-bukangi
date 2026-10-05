[English](OPS.md) | **한국어**

# 운영 가이드 (실제 서비스)

## 0. 배포 전 필수 체크리스트

| 할 일 | 왜 |
|---|---|
| `ADMIN_TOKEN`을 32자 이상 무작위로 바꾼다 | 기본값이 없으면 서버가 아예 안 뜬다. 짧으면 경고 |
| `SERVE_STATIC=0`으로 띄운다 | 정적 파일은 Cloudflare Pages가 담당. 맥미니는 API만 |
| `HOST=127.0.0.1` 확인 | 루프백만 열고 터널이 앞에 선다. 공유기 포트는 절대 열지 않는다 |
| 운영자 도메인에 Cloudflare Access를 건다 | 토큰이 새도 한 겹 더 막는다 |
| 맥미니 방화벽 켠다 | 시스템 설정 → 네트워크 → 방화벽 |
| 원격 로그인(SSH)을 끄거나 키 인증만 허용 | 침투 경로 1순위 |
| 자동 로그인 끄고 화면 잠금 켠다 | 물리 접근 대비 |
| FileVault 켠다 | 디스크 도난 대비 |

```bash
# 토큰 생성
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

---

## 1. 보안 — 맥미니가 뚫리지 않게

### 이미 코드에 들어간 것

| 항목 | 구현 | 검증 결과 |
|---|---|---|
| 토큰 없는 운영자 접근 | `Authorization: Bearer` 필수 | 401 |
| 토큰 타이밍 공격 | `crypto.timingSafeEqual` + 길이 선검사 | 통과 |
| 경로 탈출 (`../`, URL 인코딩, 이중 인코딩) | `express.static` + 404 통일 | 전부 404 |
| DB 파일 노출 | 사진 디렉터리만 서빙 | 노출 없음 |
| 확장자 위조 (텍스트를 webp로) | 매직 바이트 검사 | 거부 |
| SQL 인젝션 | 전부 prepared statement | 404 (쿼리 미실행) |
| 미래·과거 촬영 시각 | ±1시간 / 30일 범위 검사 | 거부 |
| 이상한 구역 코드 | 화이트리스트 | 거부 |
| 사진 용량 폭탄 | 3MB 상한 + JSON 5MB 상한 | 413 |
| 응답 헤더 | nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy | 3/3 |
| 서버 정보 노출 | `X-Powered-By` 제거 | 숨김 |
| 슬로로리스 | `headersTimeout` 20s, `requestTimeout` 30s | 적용 |
| 레이트 리밋 | 제보 IP당 분당 3건·시간당 10건, 운영자 15분당 60건 | 429 |
| 업로드 동시성 | 8건 동시 + 대기열 200, 초과 시 503 | 적용 |

### 네가 해야 할 것

**1) 터널 ingress로 경로를 제한한다.** `ops/cloudflared-config.example.yml` 참고.
이 파일에 없는 경로는 바깥에서 아예 못 본다. 맥미니의 다른 포트(SSH 22, AirPlay 7000 등)가
실수로 노출되는 일이 원천 차단된다.

**2) 운영자 페이지에 Cloudflare Access를 건다.**
Zero Trust → Access → Applications → `admin.도메인` 추가 → 정책은 "이메일이 내 것일 때만".
이러면 토큰을 알아도 구글 로그인 없이는 못 들어온다. 무료 플랜으로 50명까지 된다.

**3) 맥미니 자체를 잠근다.**
```bash
# 방화벽
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
# 원격 로그인 끄기 (필요하면 공개키만 허용)
sudo systemsetup -setremotelogin off
# 자동 업데이트
sudo softwareupdate --schedule on
```

**4) 토큰을 코드에 넣지 않는다.** `ops/bukang.plist`의 환경변수로만 준다.

---

## 2. 부하 — 만 명에서 몇만 명까지

### 구조가 버티는 이유

```
읽는 사람 10만 명 → Cloudflare 엣지가 응답 (캐시 10초)
                   → 원본 요청은 분당 6건
쓰는 사람 (제보)   → 터널 → 맥미니
```

`/api/status`에 `s-maxage=10`을 건다. 다만 Cloudflare는 기본 설정에서 확장자 없는 주소를 캐시하지 않아서, `/api/status`용 캐시 규칙(Cache Rule)을 따로 넣어야 효과가 난다 (운영에는 아직 넣지 않았다).
**규칙을 넣으면 읽는 사람이 10만 명이든 100만 명이든 맥미니가 받는 상황판 요청 수는 같다.** 사진은 규칙 없이도 엣지에서 캐시된다.

### 실측 (로컬, 네트워크 지연 없음)

| 경로 | 처리량 | p50 | p95 | p99 | 실패 |
|---|---|---|---|---|---|
| `GET /api/status` (동시 500, 2만 건) | 23,502 rps | 16ms | 39ms | 86ms | 0 |
| `GET /api/hall` (동시 200) | 32,258 rps | 6ms | 9ms | 10ms | 0 |
| `GET /photos/*` (동시 200) | 5,277 rps | 23ms | 85ms | 90ms | 0 |
| `POST /api/submissions` 70KB (동시 100, 1천 건) | 4,405 rps | 21ms | 27ms | 33ms | 0 |

1,000건 업로드 전부 DB와 디스크에 남은 것을 확인했다 (302행 / 309파일 / 23MB).

### 진짜 병목은 서버가 아니라 회선

로컬에서 4,400 rps가 나와도 실제 한계는 서버 회선이다.

| 동시 업로드 | 필요 대역폭 (70KB 기준) | 500Mbps 회선에서 |
|---|---|---|
| 초당 10건 | 5.6 Mbps | 여유 |
| 초당 100건 | 56 Mbps | 여유 |
| 초당 500건 | 280 Mbps | 빠듯 |
| 초당 1,000건 | 560 Mbps | 한계 초과 |

목격 직후 피크에도 초당 수백 건을 넘기 어렵다. 하루 3장 제한과 IP 분당 3건 제한이
같이 걸려 있어 한 사람이 몰아치지도 못한다.

### 넘칠 때 벌어지는 일

- 업로드 동시 8건 초과 → 대기열(최대 200)
- 대기열도 넘치면 → 503 + "지금 사람이 몰려요. 잠시 뒤 다시 시도해주세요"
- **읽기는 영향 없다.** Cloudflare가 받고 있으므로 상황판은 계속 뜬다
- 맥미니가 아예 죽어도 마지막 `status`는 캐시로 계속 뜨고, 2시간 감쇠가 자동으로 "미확인"을 만든다

### 더 늘려야 하면

1. `UPLOAD_CONCURRENCY`를 16~32로 (SSD면 여유)
2. 사진 품질을 0.86으로 (70KB → 53KB, 용량 25% 절감)
3. 그래도 모자라면 사진만 Cloudflare R2로 (요금 발생)

---

## 3. 데이터 흐름 (연결 확인 완료)

```
제보자: 사진 크롭 → WebP 2048px(약 70KB) → POST /api/submissions
        → 서버가 등급·순번 발급 → ~/bukang/photos/연/월/일/*.webp + SQLite(pending)
        → 앱이 카드 표시

운영자: /#/admin → 토큰 로그인 → GET /api/admin/queue
        → 구역 확인 후 [공개] 또는 [반려]
        → POST /api/admin/:id/approve → status='approved' + 캐시 즉시 무효화

공개:   GET /api/status  → 오늘의 기록에 사진 썸네일과 함께 노출
        GET /api/hall    → 명예의 전당에 등급순 노출
```

운영자가 현장에서 "못 봄"을 입력하는 것도 `/#/admin`의 **현장 관측 입력**에서 된다.

---

## 4. 실행

```bash
# 로컬 검증
npm run build && npm run seed && ADMIN_TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))") npm run server

# 부하 테스트
TOK=<토큰> npm run load

# 브라우저 흐름 테스트
npm run e2e
```

### 상시 구동 (launchd)
`ops/bukang.plist`의 `CHANGE_ME`를 채우고:
```bash
cp ops/bukang.plist ~/Library/LaunchAgents/kr.bukang.server.plist
launchctl load ~/Library/LaunchAgents/kr.bukang.server.plist
curl -s localhost:8787/healthz
```

### 백업
```bash
./ops/backup.sh /Volumes/Backup/bukang     # 주 1회 cron
```

---

## 5. 배포 순서

1. 도메인 구매 → Cloudflare DNS 연결
2. `npm run build` → `dist/`를 Cloudflare Pages에 업로드 → 앱 주소 확인
3. 맥미니에 cloudflared 설치, 명명된 터널 생성, `ops/cloudflared-config.example.yml` 적용
4. `api.도메인`을 터널에 연결, Pages에서 `/api/*`와 `/photos/*`를 그쪽으로 프록시
5. `admin.도메인`에 Cloudflare Access 적용
6. `ADMIN_TOKEN` 생성 후 plist에 넣고 launchd 등록
7. `curl https://api.도메인/healthz`로 확인
8. 첫 제보를 직접 올려보고 운영자 페이지에서 공개까지 한 바퀴 돌린다

---

## 6. 디스코드로 검수하기

AI가 못 가른 제보(보류·실패)만 디스코드로 온다. 썸네일과 AI 의견, 공개/반려 링크가 붙어 있다.
링크 → 확인 화면 → 버튼 한 번이면 끝. 설정과 안전장치는 `SCREENING.ko.md`의 "디스코드 알림" 참고.

```
DISCORD_WEBHOOK=...   PUBLIC_URL=https://api.도메인   SITE_URL=https://도메인
```

통과·반려는 조용히 처리되고 운영자 페이지(`/#/admin`)에서 언제든 다시 볼 수 있다.

---

## 7. 아직 없는 것

- **공지 자동 수집.** 재난문자·해경·구청 공지를 자동으로 끌어오는 크롤러가 없다.
  지금은 `node server/notices.js`(기본 2건) 또는 `/api/admin/notice`로 수동 입력.
  만들려면 재난문자 OpenAPI(data.go.kr 키)와 네이버 뉴스 검색 API(클라이언트 ID) 발급이 먼저다
- **명예의 전당 페이지네이션.** 60장까지만 나온다
- **다중 운영자.** 토큰 하나를 공유하는 구조
- **디스코드 버튼.** 지금은 링크 방식. 메시지 안에서 바로 누르는 버튼은 봇 계정이 필요해서 미룸
