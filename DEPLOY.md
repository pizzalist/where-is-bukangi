# 배포 가이드

## 요약

**맥미니를 웹 서버로 쓰지 마.** 읽기 트래픽은 Cloudflare가 받고, 맥미니는 제보 접수와 수집 에이전트만 돌린다.
이 구조면 수십만 명이 와도 맥미니는 아무것도 모르고, 비용은 도메인값 말고는 거의 0이다.

```
독자(수십만) → Cloudflare Pages/R2 (정적 HTML + status.json)   ← 무제한·무료
제보자(소수)  → Cloudflare Tunnel → 맥미니 (SQLite + 사진)      ← 맥미니가 감당 가능한 양
수집 에이전트 → 맥미니 cron → status.json을 R2에 업로드
```

핵심은 **읽기와 쓰기를 분리**하는 것. 지금 앱은 이미 그렇게 짜여 있다.
첫 화면은 `status.json` 하나만 읽고, 그 파일은 30초 캐시된 정적 파일이다.

## 1. 도메인 (유일한 유료 항목)

| 항목 | 비용 | 메모 |
|---|---|---|
| `.com` | 약 ₩15,000/년 | Cloudflare Registrar가 원가 판매라 제일 쌈 |
| `.kr` | 약 ₩22,000/년 | 가비아·후이즈에서 사고 네임서버만 Cloudflare로 |
| 무료 도메인 | ₩0 | `*.pages.dev` 서브도메인. 도메인 사기 전 테스트용으로 충분 |

**무료로 시작해도 된다.** `bukang.pages.dev` 같은 주소가 바로 나온다.
트래픽이 붙는 걸 보고 도메인을 사도 늦지 않다. 이름에 "공식", "부산항"은 넣지 말 것.

## 2. 읽기 경로 (무료, 무제한)

### Cloudflare Pages
- 대시보드 → Workers & Pages → Create → Pages → Upload assets
- `npm run build` 후 `dist/` 폴더를 통째로 올린다
- **무료 요금제 제한**: 대역폭 무제한, 요청 무제한, 빌드 월 500회
- 수십만 명이 와도 요금이 안 붙는다. 이게 이 구조를 쓰는 이유다.

### R2 (status.json 전용)
- 상황이 바뀔 때마다 갈아끼우는 파일이라 Pages 재배포 없이 바꿀 수 있어야 한다
- 무료 구간: 저장 10GB, 읽기 월 1000만 회
- `Cache-Control: max-age=30` 을 걸어 30초 캐시

### 캐시가 핵심
`status.json`이 30초 캐시되면, 1분에 10만 명이 와도 원본 요청은 2번이다.
나머지는 Cloudflare 엣지가 답한다.

## 3. 쓰기 경로 (맥미니)

### Cloudflare Tunnel
```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create bukang
cloudflared tunnel route dns bukang api.<도메인>
cloudflared tunnel run bukang
```
- 공유기 포트를 열지 않는다. 집 IP가 노출되지 않는다
- 맥미니에는 제보 접수 API와 운영자 페이지만 띄운다

### 맥미니가 죽어도
사이트는 산다. 마지막 `status.json`이 계속 서빙되고, 2시간 감쇠가 자동으로 "미확인"을 만든다.
영향은 제보 접수가 잠시 멈추는 것뿐이다.

### 주거 회선 주의
KT·SKB 약관에 서버 운영 제한 조항이 있다. 읽기 트래픽을 Cloudflare가 받으므로
맥미니로 가는 트래픽은 제보자 소수뿐이라 실무상 문제가 되기 어렵지만, 알고는 있어야 한다.

## 4. 사진 저장

- 사진은 R2 비공개 버킷에 올리고 24시간 수명 규칙을 건다
- 절대 공개하지 않는다. 구역 판별과 승인에만 쓴다
- 무료 구간 안에서 하루 수천 장은 문제없다

## 5. 순서

1. `npm run build` → `dist/`를 Cloudflare Pages에 업로드 → `*.pages.dev` 주소 확인 (20분)
2. R2 버킷 만들고 `status.json` 업로드, 캐시 헤더 설정 (20분)
3. 앱에서 `status.json` 경로를 R2 주소로 바꾸고 재배포 (10분)
4. 맥미니에 cloudflared 설치, 터널 연결 (30분)
5. 제보 API + 운영자 인증 구현 (여기부터는 코드 작업)
6. 트래픽 붙으면 도메인 구매 후 연결 (30분)

1~4번은 코드 없이 오늘 할 수 있다. 5번부터 같이 만들면 된다.

## 6. 하지 말 것

- 맥미니를 직접 인터넷에 노출 (포트포워딩)
- 읽기 요청을 맥미니로 보내기
- Vercel·Netlify 무료 요금제에 트래픽 몰기 (대역폭 제한이 있어 터지면 과금되거나 막힌다)
- 사진을 공개 버킷에 올리기
