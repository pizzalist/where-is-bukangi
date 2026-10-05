[English](README.md) | **한국어**

# 부캉이 지금 있나 (bukangi.com)

2026년 9월 부산 북항 친수공원에 나타난 상어 "부캉이"의 시민 제보 상황판입니다.
현장에서 상어를 찍어 올리거나 "보여요 / 안 보여요"를 누르면 마지막 목격 시각이 바로 바뀝니다.

- 서비스: https://bukangi.com (2026-09-22 공개, Claude Code로 개발)
- 회고 (왜 이렇게 만들었는지): [한국어](KO_POST_URL) · [English](EN_POST_URL)

<p align="center">
  <img src="docs/screenshots/home.png" width="19%" alt="홈: 마지막 목격 시각과 현장 버튼">
  <img src="docs/screenshots/certify.png" width="19%" alt="제보: 사진 한 장으로 인증">
  <img src="docs/screenshots/hall.png" width="19%" alt="명예의 전당: 공개된 제보 사진">
  <img src="docs/screenshots/tiers.png" width="19%" alt="등급: 인증 카드 희귀도">
</p>
<p align="center"><sub>홈 · 제보 · 명예의 전당 · 카드 등급 (2026-09-30 실제 화면)</sub></p>

## 구조

```
 사용자 ─┬─ bukangi.com ──────▶ Cloudflare Workers 정적 자산 (React 앱)
         │                      └ worker.js: /c/<카드> 미리보기만 API로 전달
         │
         └─ api.bukangi.com ──▶ Cloudflare Tunnel (허용한 경로만 통과, 나머지 404)
                                   │
                                   ▼  맥미니 한 대 (외부 포트를 열지 않음, 127.0.0.1만 수신)
                        Express 서버 :8787 ── SQLite (WAL) + 사진 폴더
                             ├─ AI 심사 엔진 :8788 (jev-visual + Qwen3.5-4B-4bit, MLX, 로컬 전용)
                             └─ 디스코드 웹훅 (판정 알림 + 서명된 공개/반려/뒤집기 링크)
```

- **사진**은 Cloudflare 엣지 캐시가 받고, 상황판 응답과 **쓰기**(제보, 버튼)는 맥미니까지 옵니다. 캐시 설정과 부하 테스트는 [`OPS.ko.md`](OPS.ko.md).
- **운영자 화면**은 별도 주소(admin)로만 열리고 Bearer 토큰으로 인증합니다.

## AI 사진 심사

- 엔진: [jev-visual](https://github.com/hr98w/jev-visual) (MIT) + Qwen3.5-4B-4bit (MLX). 평가에 쓴 커밋에 고정해 설치합니다. 답을 글로 생성하지 않고 보기마다 확률만 읽습니다.
- 공개 확률 ≥ 0.7이면 자동 공개, ≤ 0.3이면 자동 반려, 그 사이는 운영자에게. 자동 판정도 전부 디스코드로 보내고, 서명된 링크로 뒤집을 수 있습니다.
- 실제 제보 146장 평가: 자동 처리 69.2%, 자동 판정 101/101 정답. 기준 0.7을 같은 146장에서 골랐고 반려 표본이 14장뿐이라 낙관적인 상한으로 봐야 합니다. 자세한 기록: [`eval/README.ko.md`](eval/README.ko.md), [`SCREENING.ko.md`](SCREENING.ko.md)

## 보안과 개인정보

- 서버는 127.0.0.1에서만 듣고, 공유기 포트는 열지 않습니다. 밖으로는 터널이 허용한 경로만 나갑니다 (`ops/cloudflared-config.example.yml`).
- 운영자 토큰과 디스코드 서명 링크는 `timingSafeEqual`로 비교하고, 토큰이 없으면 서버가 뜨지 않습니다. 업로드는 파일 앞부분으로 이미지인지 확인하고, 사진 ID는 추측할 수 없는 난수입니다.
- IP별 요청 제한, 요청 크기 제한, 모든 SQL은 prepared statement입니다.
- IP와 브라우저 정보는 해시로만 남깁니다 ([`DATA.ko.md`](DATA.ko.md)). 구글 애널리틱스는 `VITE_GA_ID`가 있을 때만 불러옵니다. 제보 사진, 운영 DB, 비밀값은 저장소에 없습니다.

## 폴더

```
src/            React + TypeScript 화면 (Vite)
server/         Express API, SQLite, AI 심사 연결, 디스코드 알림, 카드 이미지
eval/           AI 사진 심사 평가 스크립트와 결과 (제보 ID는 익명 번호)
ops/            맥미니 운영 스크립트, launchd 설정, 터널 설정 예시, jev 엔진 설치
test/           화면 캡처·흐름 점검용 스크립트 (Playwright), 부하 테스트
art/, public/   캐릭터와 정적 자산
worker.js       Cloudflare Worker (카드 미리보기 경로만 API로 전달)
*.md            운영(OPS), 배포(DEPLOY), 도메인(DOMAIN), 데이터(DATA), 심사(SCREENING) 문서
```

## 로컬에서 실행

필요: Node.js (개발 환경 v25), npm. AI 심사 엔진까지 돌리려면 Apple Silicon Mac(MLX)과 Python 3.13.

```bash
npm install

# 1) 화면만
npm run dev                                   # http://localhost:5173

# 2) API 서버까지
export ADMIN_TOKEN=$(openssl rand -hex 24)    # 운영자 토큰 (필수)
export BUKANG_DATA=~/bukang-dev               # DB와 사진이 쌓일 폴더
export SITE_URL=http://localhost:5173         # 제보·운영자 API를 부를 화면 주소
export SCREEN_ENGINE=off                      # 심사 엔진 없이 (사람이 운영자 화면에서 처리)
npm run seed                                  # 예시 데이터 (선택)
npm run server                                # http://127.0.0.1:8787 , 운영자 화면은 #/admin
```

### 주요 환경변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `ADMIN_TOKEN` | (필수) | 운영자 API 토큰. 32자 이상 무작위 권장 |
| `BUKANG_DATA` | `~/bukang` | SQLite DB와 사진 폴더 위치 |
| `PORT` / `HOST` | `8787` / `127.0.0.1` | 서버 주소. 운영에서도 루프백만 |
| `SITE_URL`, `ALLOWED_ORIGINS` | | 제보·운영자 API를 부를 수 있는 화면 주소 |
| `PUBLIC_URL` | | API의 바깥 주소. 있으면 사진을 절대주소로 준다 |
| `SERVE_STATIC` | `1` | 서버가 `dist/`와 카드 이미지를 직접 낼지 |
| `SCREEN_ENGINE` | `claude` | 사진 심사 엔진: `claude` / `api` / `jev` / `off` |
| `JEV_URL`, `JEV_THRESHOLD` | `http://127.0.0.1:8788`, `0.7` | jev 엔진 주소와 자동 공개 기준 (≤ 1 − 기준이면 자동 반려) |
| `ANTHROPIC_API_KEY` | | `SCREEN_ENGINE=api`일 때만 필요 |
| `DISCORD_WEBHOOK` | | 있으면 판정 알림과 서명 링크를 보냄 |
| `PARK_RADIUS` | `700` | 현장 버튼을 받아 주는 공원 반경(m) |
| `VITE_GA_ID` | (없음) | 화면 빌드 값. 구글 애널리틱스 측정 ID. 비워 두면 GA를 쓰지 않음 |

### AI 심사 엔진 (선택)

```bash
./ops/jev/setup.sh          # jev-visual(고정 커밋)과 모델 설치, launchd 등록, 127.0.0.1:8788
export SCREEN_ENGINE=jev
npm run server
```

### 운영 배포

맥미니 상시 실행(launchd), Cloudflare 터널, 도메인 연결은 [`DEPLOY.ko.md`](DEPLOY.ko.md), [`DOMAIN.ko.md`](DOMAIN.ko.md), [`OPS.ko.md`](OPS.ko.md)에 순서대로 적어 두었습니다.
터널 설정은 `ops/cloudflared-config.example.yml`을 `~/.cloudflared/config.yml`로 복사해 `<TUNNEL_ID>`를 채워 씁니다.

## 라이선스

MIT. [`LICENSE`](LICENSE)를 참고하세요. 외부 코드: [`THIRD_PARTY.ko.md`](THIRD_PARTY.ko.md). jev-visual(MIT)과 Qwen3.5 모델(Apache-2.0)은 설치할 때 내려받으며 이 저장소에 포함하지 않습니다.
