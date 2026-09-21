import type { ZoneCode } from "./types";

/**
 * 북항 친수공원 별빛수로(구 경관수로, 약 1.3km) 구간.
 * 부산시설공단 공원 안내도의 실제 시설명을 따름. 서쪽(바다) → 동쪽(여객터미널) 순서.
 *
 * 좌표는 안내도 기준 추정치(초안)다. 현장에서 각 지점 GPS를 찍어 확정해야 한다.
 * GPS 자동 배정은 이 좌표를 쓰므로, 확정 전까지는 오배정이 날 수 있다.
 */
export interface ZoneDef {
  code: ZoneCode;
  name: string;      // 짧은 이름 (칩·카드용)
  full: string;      // 안내도 표기
  landmark: string;  // 찾아가는 기준
  lat: number;
  lng: number;
}

export const ZONES: ZoneDef[] = [
  { code: "A", name: "마리나브릿지", full: "마리나브릿지 · 수로 입구", landmark: "부산항 북항마리나 앞, 바다와 만나는 수로 끝", lat: 35.1010, lng: 129.0340 },
  { code: "B", name: "팽나무숲", full: "팽나무 숲 · 제2보도교", landmark: "제2보도교 북단 팽나무 숲길", lat: 35.1020, lng: 129.0360 },
  { code: "C", name: "오페라브릿지", full: "오페라브릿지 · 오페라하우스 앞", landmark: "부산 오페라하우스 건너편 수로", lat: 35.1028, lng: 129.0378 },
  { code: "D", name: "웨이브스탠드", full: "웨이브스탠드 · 워터가든 · 제3보도교", landmark: "곡선 계단식 관람석과 워터가든 사이", lat: 35.1038, lng: 129.0395 },
  { code: "E", name: "하버블럭가든", full: "하버블럭가든 · 베이파크브릿지", landmark: "베이파크브릿지 아래 정원 구간", lat: 35.1042, lng: 129.0412 },
  { code: "F", name: "오픈캐널", full: "오픈캐널 · 제4보도교", landmark: "부산항 국제여객터미널 쪽 수로 시작점", lat: 35.1048, lng: 129.0428 },
];

export const ZONE_BY_CODE = Object.fromEntries(ZONES.map((z) => [z.code, z])) as Record<ZoneCode, ZoneDef>;

/** 가장 가까운 구역. 약 250m 밖이면 null(공원 밖). */
export function nearestZone(lat: number, lng: number): ZoneCode | null {
  let best: ZoneCode | null = null, bd = Infinity;
  for (const z of ZONES) {
    const dLat = (z.lat - lat) * 111000;
    const dLng = (z.lng - lng) * 91000; // 위도 35도 보정
    const d = Math.hypot(dLat, dLng);
    if (d < bd) { bd = d; best = z.code; }
  }
  return bd <= 250 ? best : null;
}

/** 네이버 지도 길찾기 (출발지: 현재 위치). 앱이 있으면 앱, 없으면 웹에서 열림. */
export function naverDirections(z: ZoneDef) {
  const name = encodeURIComponent(`북항친수공원 ${z.name}`);
  return `https://map.naver.com/p/directions/-/${z.lng},${z.lat},${name}/-/transit`;
}

/** 네이버 지도에서 위치 보기 */
export function naverPlace(z: ZoneDef) {
  return `https://map.naver.com/p/search/${encodeURIComponent(`북항친수공원 ${z.full.split(" · ")[0]}`)}?c=${z.lng},${z.lat},17,0,0,0,dh`;
}
