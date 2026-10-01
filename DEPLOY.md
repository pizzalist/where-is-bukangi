# 배포 가이드

## 요약

**맥미니를 웹 서버로 쓰지 마.** 화면은 Cloudflare Pages가, 데이터(제보·사진·상황판)는 맥미니가 Cloudflare Tunnel 뒤에서 낸다.
읽기는 Cloudflare 엣지가 캐시해서 받아내고, 맥미니에는 제보자와 10초에 한 번꼴 캐시 갱신만 온다.

```
독자(수십만) → Cloudflare Pages   bukang.kr          화면. 무료·무제한
             → Cloudflare 캐시   api.bukang.kr      /api/status(10초), /photos(1일) 캐시
제보자(소수)  → Cloudflare Tunnel → 맥미니 :8787      /api/submissions, 운영자 API
```

**Pages만으로는 안 된다.** 화면은 고정 주소를 얻지만 API 주소(터널)가 바뀌면 화면을 다시 빌드해야 한다.
API에 고정 주소를 주려면 도메인이 있어야 한다 (명명된 터널은 내 도메인에만 붙는다). 그래서 순서가 **도메인 → Pages → 터널**이다.

## 1. 도메인 (유일한 유료 항목)

| 어디서 | 얼마 | 메모 |
|---|---|---|
| Cloudflare Registrar `.com` | 약 ₩15,000/년 | 원가 판매. 이미 Cloudflare를 쓰니 연결이 자동 |
| 가비아·후이즈 `.kr` | 약 ₩22,000/년 | 산 뒤 네임서버만 Cloudflare 것으로 바꾼다 (몇 시간) |

이름에 "공식", "부산항"은 넣지 말 것. `bukang.kr`, `bukangi.com` 같은 게 안전하다.

1. https://dash.cloudflare.com 가입 (무료)
2. **Domain Registration → Register Domains**에서 `.com` 검색해 구매. 또는 가비아에서 `.kr` 구매 후 **Websites → Add a site**로 추가하고 가비아 네임서버를 Cloudflare가 알려주는 두 개로 변경
3. 대시보드에서 도메인이 **Active**가 되면 다음 단계

## 2. 화면: Cloudflare Pages

```bash
VITE_API_BASE=https://api.bukang.kr npm run build     # 도메인은 네 것으로
```

1. 대시보드 → **Workers & Pages → Create → Pages → Upload assets**
2. 프로젝트 이름 `bukang` → `dist/` 폴더를 통째로 드래그 → Deploy
3. `bukang.pages.dev`가 나온다. **Custom domains → Set up a domain** → `bukang.kr` 입력 (DNS는 자동)
4. 다음 배포부터는 같은 프로젝트에 `dist/`를 다시 올리기만 하면 된다. 명령줄이 편하면:
   ```bash
   npx wrangler pages deploy dist --project-name bukang
   ```

무료 요금제: 대역폭 무제한, 요청 무제한, 빌드 월 500회. 수십만 명이 와도 요금이 안 붙는다.

**주의:** 제보 API는 `SITE_URL`에 적은 주소에서 온 화면만 받는다 (CORS). 사람들이 쓰는 주소를 정확히 적을 것 (`https://bukang.kr`).
`bukang.pages.dev`로도 쓰게 하려면 `ALLOWED_ORIGINS=https://bukang.pages.dev`를 추가.
화면이 열리는 주소가 둘 이상이면 전부 등록해야 한다. 빠진 주소에서는 상황판은 보이는데 제보·현장 버튼만 Safari에서 `Load failed`로 실패한다
(2026-10-01, `www.bukangi.com`이 빠져 있던 사고). 운영은 `ALLOWED_ORIGINS=https://admin.bukangi.com,https://www.bukangi.com`이고,
`worker.js`가 www와 `http://`를 모두 `https://bukangi.com`으로 301 이동시켜 주소를 하나로 모은다.
같은 날 인스타 인앱 브라우저가 링크를 `http://bukangi.com`으로 열어, 출처가 `http://`라 똑같이 거절되던 것도 확인했다.
Cloudflare 대시보드의 SSL/TLS → Edge Certificates → **Always Use HTTPS**도 켜 두면 Worker를 거치지 않는 경로까지 막힌다.
거절된 출처는 서버 로그에 `[CORS 거절] origin=...`으로 남는다.

## 3. 데이터: 맥미니 + Cloudflare Tunnel

```bash
brew install cloudflared
cloudflared tunnel login                       # 브라우저가 열리고 도메인을 고른다
cloudflared tunnel create bukang               # 터널 ID와 자격 파일 경로가 출력된다
cloudflared tunnel route dns bukang api.bukang.kr
cp ops/cloudflared-config.yml ~/.cloudflared/config.yml    # 안의 CHANGE_ME 세 곳을 채운다
cloudflared tunnel --protocol http2 run bukang # 집 회선에서 QUIC이 막혀 있으면 http2가 필요하다
```

- 공유기 포트를 열지 않는다. 집 IP가 노출되지 않는다
- `config.yml`의 ingress가 `/api/status|hall|submissions`, `/photos/`, `/r/`(디스코드 링크)만 밖으로 낸다. 나머지는 404
- 운영자 API는 `admin.bukang.kr`로 따로. **Zero Trust → Access**에서 내 이메일만 허용하면 토큰 앞에 문이 하나 더 생긴다
- 상시 구동: `cloudflared service install` (launchd 등록)

서버 쪽 환경변수 (`ops/bukang.plist`에 채운다):

```
ADMIN_TOKEN=<32자 이상 무작위>
SERVE_STATIC=0                      # 화면은 Pages가 담당
BUKANG_DATA=/Users/<나>/bukang        # /tmp 금지. 재부팅하면 지워진다
PUBLIC_URL=https://api.bukang.kr    # 사진 절대주소·디스코드 링크
SITE_URL=https://bukang.kr          # 제보를 받을 화면 주소 (CORS)
SCREEN_ENGINE=claude
DISCORD_WEBHOOK=...                 # 선택
```

### 캐시가 핵심
`/api/status`는 `s-maxage=10`이라 1분에 10만 명이 와도 맥미니에는 6번 온다. 사진도 엣지가 캐시한다.
Cloudflare 대시보드 → **Caching → Cache Rules**에서 `api.bukang.kr/photos/*`를 "Eligible for cache, Edge TTL 1 day"로 두면 사진이 맥미니에서 한 번만 나간다.

### 맥미니가 죽어도
Pages의 화면은 산다. `/api/status`가 안 오면 "서버에 연결할 수 없어요" 배너가 뜨고 제보만 막힌다.
카드는 서버가 발급하므로 죽어 있는 동안은 카드도 안 나간다.

### 주거 회선 주의
통신사 약관에 서버 운영 제한 조항이 있다. 읽기가 전부 Cloudflare로 빠지므로 맥미니로 오는 건 제보자뿐이라
실무상 문제되기 어렵지만 알고는 있을 것. 병목은 회선 업스트림이다 (500Mbps면 초당 약 500장).

## 4. 사진 저장 — 맥미니 로컬 디스크에 영구 보관 (과금 0)

사진은 **맥미니 로컬 디스크**에 영구 보관한다. 클라우드 스토리지를 쓰지 않는다.
사진은 `api.도메인/photos/*`로 나가고 Cloudflare가 캐시한다. 목록은 480px 썸네일(약 20KB), 원본(2048px, 약 70KB)은 카드 화면에서만 나간다.

### 압축: WebP 2048px (실측)

업로드 전에 앱이 4:3으로 잘라 긴 변 2048px, WebP 품질 0.90으로 인코딩한다.
같은 사진을 포맷별로 재서 나온 실제 크기:

| 포맷 (2048×1536) | 크기 |
|---|---|
| PNG 무손실 | 1,311 KB |
| JPEG q0.86 | 130 KB |
| **WebP q0.90** | **약 70 KB** |
| WebP q0.86 | 53 KB |

WebP가 같은 화질에서 JPEG의 40% 수준이다. 2048px면 카드 표시(340px)의 6배라
나중에 확대해서 보거나 다른 용도로 써도 화질이 부족하지 않다.
WebP는 iOS 14 이상 사파리를 포함해 거의 모든 브라우저가 인코딩할 수 있고,
안 되면 자동으로 JPEG로 떨어진다.

### 용량 계산 (영구 보관)

장당 100KB로 넉넉히 잡으면:

| 하루 제보 | 하루 | 한 달 | 1년 |
|---|---|---|---|
| 1,000장 | 100 MB | 3 GB | 36 GB |
| 10,000장 | 1 GB | 30 GB | 365 GB |
| 50,000장 | 5 GB | 150 GB | 1.8 TB |

부캉이 이벤트는 며칠~몇 주다. 하루 1만 장이 한 달 이어져도 30GB라
맥미니 내장 디스크로 충분하다. 장기 아카이브로 갈 거면 외장 SSD 하나 붙이면 된다.
하루 3장 제한이 있어 한 사람이 수백 장을 올릴 수도 없다.

### 저장 구조
```
~/bukang/photos/2026/09/21/<id>.webp     원본 보관본
~/bukang/bukang.db                        SQLite (메타데이터: 시각·구역·등급·승인 상태)
```
파일명에 개인 식별 정보를 넣지 않는다. 메타데이터와 파일을 id로만 연결한다.

### 백업
영구 보관으로 바뀌었으니 백업이 필요하다. Time Machine 또는 외장 디스크로 주 1회.
클라우드 백업을 쓰면 다시 요금이 붙으니, 이벤트가 끝난 뒤 한 번에 아카이브하는 게 낫다.

### 개인정보 판단 (영구 보관 기준)

이 서비스는 개인정보 위험이 낮은 편이다. 이유:

- **피사체가 사람이 아니라 상어다.** 초상권 위험의 본체가 없다
- **이름·연락처를 받지 않는다.** 법이 말하는 개인정보를 수집하지 않는다
- **사진에 사람이 주인공으로 나오지 않는다.** 상어 사진만 공개한다
- **계정이 없다.** 누가 올렸는지 서비스도 모른다

그래서 얼굴 자동 블러나 삭제 요청 창구는 두지 않는다. 대신 이 두 가지만 지킨다.

**1) 업로드 화면에 안내를 노출한다.** (구현됨: "사진은 어떻게 쓰이나요?" 접힘 박스)
- 촬영 시각과 구역이 타임라인에 올라간다
- 사진은 운영자 확인 뒤 공개된다
- 사진과 기록은 계속 보관한다
- 이름·연락처는 받지 않는다
- 부캉이와 관련 없는 사진은 반려한다

**2) 승인 단계에서 사람이 주인공인 사진은 반려한다.**
3만 명이 몰리는 현장이라 배경에 사람이 들어갈 수는 있다. 공개 장소의 배경 인물은
초상권 다툼으로 가기 어렵지만, 얼굴이 주된 피사체인 사진은 운영자가 걸러낸다.
이미 운영자 페이지에 반려 버튼이 있다.

**남는 리스크 하나.** "계속 보관"이라고만 쓰면 나중에 기간을 특정하라는 지적이 올 수 있다.
사업이 커지면 "수집일로부터 3년" 같은 기간을 정하는 게 안전하다. 지금 규모에서는 과하다.

## 5. 순서 (총 1~2시간)

1. 도메인 구매, Cloudflare에 Active (10분 + 네임서버 반영 대기)
2. `VITE_API_BASE=https://api.도메인 npm run build` → Pages 업로드 → 커스텀 도메인 연결 (20분)
3. 맥미니에 cloudflared 설치, 터널 생성, `api.도메인` 연결, config 적용 (30분)
4. `ops/bukang.plist` 채워서 launchd 등록. `curl https://api.도메인/healthz`로 확인 (20분)
5. `node server/notices.js`로 공지 2건 넣기
6. 폰에서 사진 한 장 올려 카드 받기 → 디스코드 알림 또는 운영자 페이지에서 공개 → 상황판에 뜨는지 확인
7. (선택) `admin.도메인`에 Cloudflare Access, 사진 캐시 규칙, 디스코드 웹훅

카드 하단 주소는 접속한 주소가 자동으로 찍히니 `VITE_SITE_HOST`는 안 줘도 된다.

## 6. 하지 말 것

- 맥미니를 직접 인터넷에 노출 (포트포워딩)
- 데이터를 `/tmp`에 두기 (재부팅하면 사라진다)
- 화면을 맥미니에서 서빙하기 (`SERVE_STATIC=1`은 로컬 개발용)
- Vercel·Netlify 무료 요금제에 트래픽 몰기 (대역폭 제한이 있어 터지면 과금되거나 막힌다)
- 무료 터널(localhost.run, trycloudflare)로 공개 홍보하기. 주소가 바뀌면 공유된 카드 링크가 전부 죽는다

## 7. 로컬에서 서버 돌리기

```bash
npm run build          # 프론트 빌드
npm run seed           # 목 데이터 주입 (제보 9건, 관측 2건, 공지 2건)
npm run server         # http://localhost:8787
```

데이터 위치는 `~/bukang`(환경변수 `BUKANG_DATA`로 변경). 사진은 `~/bukang/photos/연/월/일/`.

### API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/status` | 상황판 (타임라인·공지·마지막 목격). 15초 캐시 |
| GET | `/api/hall` | 명예의 전당 (승인된 카드, 등급순) |
| GET | `/photos/...` | 공개 사진 |
| POST | `/api/submissions` | 제보. **서버가 등급과 순번을 정한다** |
| GET | `/api/submissions/:id` | 카드 조회 |
| GET | `/api/admin/queue` | 승인 대기 (Bearer 토큰) |
| POST | `/api/admin/:id/approve\|reject` | 승인·반려 |
| POST | `/api/admin/observation` | 현장 관측(`seen`/`miss`) 입력 |
| POST | `/api/admin/notice` | 공지 추가 (`crit: true`면 출입통제로 최상단) |

운영자 토큰은 환경변수 `ADMIN_TOKEN`. 없으면 서버가 안 뜬다.

### 등급을 서버가 정하는 이유
클라이언트가 등급을 정하면 개발자 도구로 골드를 무한 발급할 수 있다.
순번도 마찬가지다. 그래서 서버가 굴리고 결과만 돌려준다.
서버가 없으면 카드를 발급하지 않고 오류를 보여준다.

### 남용 방지
- IP당 시간 10건 제한 (메모리)
- 사진 3MB 상한 (앱이 보내는 건 약 70KB)
- 클라이언트 하루 3장 제한 (localStorage라 우회 가능. 서버 제한은 계정이 없어 IP 기준이 최선)
