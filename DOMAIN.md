# 도메인 연결, 쉽게

## 한 줄 요약

**도메인 안 사도 지금 바로 올릴 수 있다.** 나중에 사도 늦지 않다.

---

## 1단계: 도메인 없이 먼저 올린다 (30분, 무료)

Cloudflare Pages에 올리면 `bukang.pages.dev` 같은 주소를 공짜로 준다.

1. [dash.cloudflare.com](https://dash.cloudflare.com) 가입 (무료)
2. 왼쪽 메뉴 **Workers & Pages** → **Create** → **Pages** → **Upload assets**
3. 프로젝트 이름을 `bukang`으로 (주소가 `bukang.pages.dev`가 된다)
4. `npm run build` 하고 나온 **`dist` 폴더를 통째로 끌어다 놓기**
5. 끝. 주소가 바로 나온다

이 주소는 **트래픽 무제한, 요금 0원**이다. 수십만 명이 와도 안 바뀐다.

---

## 2단계: 맥미니를 연결한다 (30분)

지금 앱은 사진 업로드와 승인을 맥미니에서 처리한다. Pages는 화면만 주므로
맥미니를 바깥에서 부를 수 있게 터널을 뚫어야 한다.

```bash
brew install cloudflared
cloudflared tunnel login          # 브라우저가 열리면 Cloudflare 로그인
cloudflared tunnel create bukang  # 터널 만들기
```

만들면 터널 ID가 나온다. 그걸 `ops/cloudflared-config.yml`에 채우고:

```bash
cp ops/cloudflared-config.yml ~/.cloudflared/config.yml
cloudflared tunnel run bukang
```

**공유기 설정은 건드리지 않는다.** 포트 열기 같은 거 안 해도 된다.
터널이 밖에서 안으로 뚫는 게 아니라, 맥미니가 밖으로 연결을 거는 구조라 그렇다.

---

## 3단계: 도메인을 산다 (선택, 30분)

트래픽이 붙는 걸 보고 사도 된다.

| 어디서 | 얼마 | 메모 |
|---|---|---|
| Cloudflare Registrar (`.com`) | 연 15,000원쯤 | **원가 판매라 제일 싸다.** 이미 Cloudflare를 쓰니 연결도 자동 |
| 가비아·후이즈 (`.kr`) | 연 22,000원쯤 | 산 뒤 네임서버만 Cloudflare로 바꾼다 |

이름 고를 때 **"공식", "부산항"은 넣지 마라.** 항만공사 사칭으로 오해받으면 하루 만에 내려간다.
`bukang.kr`, `bukangi.com` 같은 게 안전하다.

### 산 뒤에 할 일
1. Cloudflare 대시보드 → **Websites** → **Add a site** → 도메인 입력
2. 가비아·후이즈에서 산 거면 네임서버를 Cloudflare가 알려주는 두 개로 바꾼다 (반영에 몇 시간)
3. **Workers & Pages** → `bukang` → **Custom domains** → 도메인 연결
4. `api.도메인`을 터널에 연결 (`cloudflared tunnel route dns bukang api.도메인`)

---

## 순서 정리

```
지금       →  Pages에 dist 올리기            →  bukang.pages.dev 로 공개
그 다음    →  맥미니에 cloudflared 연결      →  사진 업로드·승인 동작
트래픽 보고 →  도메인 사서 연결              →  bukang.kr
```

1단계만 해도 사람들이 들어와서 볼 수 있다. 2단계까지 해야 제보를 받을 수 있다.
3단계는 급하지 않다.

---

## 돈 나가는 데가 어딘지

| 항목 | 요금 |
|---|---|
| Cloudflare Pages (화면) | **0원** (무제한) |
| Cloudflare Tunnel (맥미니 연결) | **0원** |
| 사진 저장 (맥미니 디스크) | **0원** |
| 도메인 | 연 1.5~2.2만원 (선택) |
| AI 심사 (claude CLI) | **0원** (구독) |
| AI 심사 (API로 바꾸면) | 하루 300건에 60원쯤 |

**도메인 말고는 사실상 0원이다.** 사진을 맥미니에 두는 구조라 트래픽에 비례하는 비용이 없다.
