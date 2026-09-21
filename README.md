# 부캉이 지금 있나 (draft)

부산 북항 친수공원 상어 "부캉이" 현장 상황판. "오늘 가면 볼 수 있나"에 답하는 모바일 웹.

## 로컬 실행
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
```

## 구조
- `public/status.json` 읽기 전용 상태. 배포 시 Cloudflare R2에 올리고 운영자 페이지가 갱신.
- `src/pages/Home.tsx` 첫 화면. 2시간 감쇠, 신뢰 등급 색 구분, 구역 지도, 타임라인, 공지.
- `src/pages/Certify.tsx` 인증받기(=제보). EXIF에서 시각·GPS 읽어 구역 자동 배정. 사진은 비공개.
- `src/pages/Card.tsx` 승인된 인증의 순번 카드(1080x1350 PNG) 생성·공유.
- `src/pages/Admin.tsx` 운영자 승인 큐. 자동 승격 후보(같은 구역, 15분 이내, 사진 2장 이상) 표시.
- `src/components/ZoneMap.tsx` 손으로 그린 수로 개념도. 구역 경계는 현장에서 확정 후 수정.

드래프트는 제보를 localStorage에 저장한다. 배포 버전은 맥미니 API(Cloudflare Tunnel) + SQLite + R2.

## 배포 (계획)
읽기: Cloudflare Pages(정적) + R2(status.json, max-age=30)
쓰기: 제보 폼 → Tunnel → 맥미니 → 운영자 승인 → status.json 갱신
