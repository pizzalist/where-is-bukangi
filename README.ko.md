[English](README.md) | **한국어**

# 부캉이 지금 있나 (bukangi.com)

2026년 9월, 부산 북항 친수공원에 상어 "부캉이"가 나타나 사람들이 몰렸습니다. 목격담은 많았지만 **"지금 가면 볼 수 있나"**에 답하는 곳은 없었습니다.
이 저장소는 그 질문에 답하려고 하룻밤에 만든 시민 제보 상황판입니다. 현장에서 상어를 찍어 올리거나 "보여요 / 안 보여요"를 누르면 마지막 목격 시각이 바로 바뀝니다.

- 서비스: https://bukangi.com
- 개발: 2026-09-21 첫 커밋, 다음 날(9/22) 공개, 이후 운영 기록을 보며 계속 수정
- 회고 (만들고 2주 운영한 이야기): [한국어](KO_POST_URL) · [English](EN_POST_URL)

<p align="center">
  <img src="docs/screenshots/home.png" width="19%" alt="홈: 마지막 목격 시각과 현장 버튼">
  <img src="docs/screenshots/certify.png" width="19%" alt="제보: 사진 한 장으로 인증">
  <img src="docs/screenshots/hall.png" width="19%" alt="명예의 전당: 공개된 제보 사진">
  <img src="docs/screenshots/tiers.png" width="19%" alt="등급: 인증 카드 희귀도">
</p>
<p align="center"><sub>홈 · 제보 · 명예의 전당 · 카드 등급 (2026-09-30 실제 화면)</sub></p>

## 숫자로 보는 운영 (2026-10-04 기준)

| 항목 | 값 | 기준 |
|---|---|---|
| 첫 주 일 순방문 | 평균 1,563명, 최대 2,823명 (9/27) | 9/22~9/28 하루 단위 순방문 |
| 누적 방문 | 17,634회 | 9/22~10/4 일 순방문의 합 (같은 사람이 여러 날 오면 여러 번 셈) |
| 사진 제보 | 306건 (공개 274건) | |
| 현장 버튼 | 770회 (보여요 426, 안 보여요 344) | 공원 GPS 반경 안에서 누른 것만 |
| AI 사진 심사 | 9/28 로컬 모델로 교체. 전환 후 운영 제보 161장에서 자동 처리 88%, 사람이 뒤집은 판정 0건, 외부 비용 0원 | 아래 "AI 사진 심사" 참고 |
| 보도 | 신문 지면 4곳, 방송 3곳 (아래 "보도" 참고) | 기사에서는 "부산의 한 대학원생" |

## 보도

| 날짜 | 매체 | 내용 |
|---|---|---|
| 9/22 | [JTBC 뉴스 '지금 이 장면'](https://www.youtube.com/watch?v=0DWchYJrzFE) | 공개 당일 저녁, 북항 '상어 찾기' 서비스로 소개 |
| 9/24 | [KBC 광주방송 D뉴스](https://news.ikbc.co.kr/article/view/kbc202609230034) | 첫 단독 기사. "논문 쓰다 삘 받아서... 대학원생이 새벽에 만든 '부캉이 지금 있나'" |
| 9/26 | [부산일보 단독](https://www.busan.com/view/busan/view.php?code=2026092614372410741) | "'부캉이 지금 있나?'... 북항 상어 위치 실시간 공유 웹사이트 등장" |
| 9/28 | [조선일보 A10면](https://www.chosun.com/national/regional/2026/09/28/HQSLDGBIYFCQNDLIXTLBPRVEYI/) | "해운대보다 부캉이" 추석 연휴 46만 명. 개발자 인터뷰 인용 |
| 9/28 | [부산일보 2면 톱](https://www.busan.com/view/busan/view.php?code=2026092718311123044) | 보여요/안 보여요 버튼과 인증 카드 소개 |
| 9/28 | 서울신문 10면, 국제신문 2면 톱 | "시민이 서로 위치 정보를 공유하며 찾아 나서는 새로운 관람 방식" |
| 9/28 | [MBN '보부상 요즘 그거'](https://www.youtube.com/watch?v=Cl-hmvv4Hu8) | "구경꾼이 참여자로". 사이트 화면 방송 |
| 10/2 | SBS 〈궁금한 이야기 Y〉 | 개발자 인터뷰. 추석 당일(9/25) 촬영 |

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

- **사진**은 Cloudflare 엣지 캐시가 받고, 상황판 응답과 **쓰기**(제보, 버튼)는 맥미니까지 옵니다.
  서버가 `s-maxage=10`을 주지만 Cloudflare는 기본 설정에서 확장자 없는 주소를 캐시하지 않아, 상황판까지 엣지에서 받으려면 캐시 규칙을 따로 넣어야 합니다.
  로컬 부하 테스트에서 `/api/status` 23,502 rps, 제보 업로드 4,405 rps (`OPS.ko.md`). 실제 한계는 서버 회선입니다.
- **운영자 화면**은 별도 주소(admin)로만 열리고 Bearer 토큰으로 인증합니다.

## 설계에서 내린 판단

| 관찰 | 판단 |
|---|---|
| 사람들이 궁금한 건 정확한 위치보다 "지금 있느냐" | 답을 "마지막 목격 시각" 한 줄로 정함. 2시간이 지나면 "미확인"으로 바꾸던 감쇠는 없애고, 경과 시간은 배지로만 표시 |
| 첫날 사진 제보가 한 자릿수 | 찍고 올리는 부담이 원인이라 보고 사진 없이 누르는 "보여요 / 안 보여요" 버튼을 당일 추가. 공원 GPS 반경 안에서만, 기기당 10분에 1회 |
| 위치 확인 실패가 성공의 두 배 이상 | 기록을 보니 스레드·인스타그램 인앱 브라우저가 원인. 외부 브라우저로 여는 안내를 추가 |
| 제보 사진에 화면 캡처, 셀카가 섞임 | 심사를 "직접 찍었는가, 상어가 보이는가"를 가려내는 판정 문제로 정의. AI가 확신할 때만 자동 공개·반려하고 애매하면 사람에게 |
| 범용 LLM 심사가 느리고, 로그인 만료로 조용히 멈춤 | 답을 생성하지 않고 후보 답의 logit만 채점하는 로컬 추론으로 교체. 운영 제보 146장으로 평가하고, 전환 전 테스트 서버에서 147장을 다시 심사해 일치를 확인한 뒤 배포 |
| 맥미니 한 대로 버텨야 함 | 사진은 엣지 캐시, 업로드는 동시 8개 + 대기 200개로 제한하고 넘치면 503 |

## AI 사진 심사

- 엔진: [jev-visual](https://github.com/hr98w/jev-visual) (MIT) + Qwen3.5-4B-4bit. 코드는 수정하지 않고, 평가에 쓴 커밋에 고정해 설치합니다.
- 판정: 공개 확률 ≥ 0.7이면 자동 공개, ≤ 0.3이면 자동 반려, 그 사이는 운영자에게.
- 평가 (운영 제보 146장, 정답은 운영자 최종 상태): 자동 처리 69.2%, 자동 판정 정확도 101/101, 허위 공개 0.
  기준 0.7은 같은 146장에서 고른 값이고 반려 표본이 14장뿐이라, 이 숫자는 낙관적인 상한입니다. 그래서 자동 판정도 전부 디스코드로 받아 사람이 뒤집을 수 있게 했습니다.
- 운영 (9/28 전환 이후 제보 161장, 2026-10-04 기준): 자동 공개 126, 자동 반려 16(운영자 테스트 2장 포함), 사람에게 넘김 19(공개 16, 반려 2, 대기 1), 사람이 뒤집은 자동 판정 0, 자동 처리 88%. 정답은 "사람이 뒤집지 않음" 기준이라 독립 검증이 아니라 운영 기록입니다.
- 자세한 기록: [`eval/README.ko.md`](eval/README.ko.md), [`SCREENING.ko.md`](SCREENING.ko.md)

## 보안과 개인정보

- 서버는 127.0.0.1에서만 듣고, 공유기 포트는 열지 않습니다. 밖으로는 터널이 허용한 경로만 나갑니다 (`ops/cloudflared-config.example.yml`).
- 운영자 토큰과 디스코드 서명 링크는 `timingSafeEqual`로 비교합니다. 토큰이 없으면 서버가 뜨지 않습니다.
- 업로드는 확장자가 아니라 파일 앞부분(매직 바이트)으로 이미지인지 확인하고, 사진 ID는 추측할 수 없는 난수입니다.
- IP별 요청 제한, 요청 크기 제한, 모든 SQL은 prepared statement입니다.
- IP와 브라우저 정보는 해시로만 쓰고 원본은 저장하지 않습니다 (`DATA.ko.md`).
- 운영 사이트는 방문 통계에 구글 애널리틱스(쿠키)를 함께 씁니다. 빌드 값 `VITE_GA_ID`가 없으면 아무것도 불러오지 않습니다.
- 제보 사진, 운영 DB, 비밀값은 저장소에 없습니다.

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

## 개발 방식

- **Claude Code**로 개발했습니다.
- 기획은 **Claude Fable**과 함께 했고, 작업 흐름에는 **gstack**을 썼습니다.
- 구현은 **Claude Opus 5**와 **Claude Opus 5.5**가 맡았습니다.
- 무엇을 만들지, 무엇을 막을지, 언제 심사 모델을 바꿀지는 운영 기록을 보고 제가 판단했습니다. 판단의 이유는 커밋 메시지에 남겨 두었습니다.

## 외부 코드와 라이선스

[`THIRD_PARTY.ko.md`](THIRD_PARTY.ko.md)를 참고하세요. jev-visual(MIT)과 Qwen3.5 모델(Apache-2.0)은 설치할 때 내려받으며 이 저장소에 포함하지 않습니다.

## 라이선스

MIT. [`LICENSE`](LICENSE)를 참고하세요.
