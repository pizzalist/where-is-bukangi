import type { ZoneCode } from "./types";

/**
 * 부캉이 출몰 구간.
 * 기사 확인: "공원 입구에서 정원으로 죽 나가면 크루즈선이 정박한 곳이 있는데,
 * 그 근처 다리(제5보도교) 쪽에서 목격" / "수로가 휜 구조 탓에 못 나가는 듯".
 * 그래서 공원 전체가 아니라 제4~제6보도교 사이 수로 구간만 다룬다.
 */
export const PARK = {
  name: "북항친수공원",
  address: "부산 동구 이순신대로 164 (초량동)",
  lat: 35.1144,   // 공식 주소 기준 좌표
  lng: 129.0464,
};

export interface ZoneDef {
  code: ZoneCode;
  name: string;
  full: string;
  landmark: string;
  main?: boolean;
}

/** 기본 선택 구역 = 처음 나타난 곳 */
export const DEFAULT_ZONE: ZoneCode = "B";

export const ZONES: ZoneDef[] = [
  { code: "A", name: "제4보도교", full: "제4보도교 쪽", landmark: "하늘광장에서 들어와 첫 다리를 건넌 북쪽 수로" },
  { code: "B", name: "제5보도교", full: "제5보도교 일대", landmark: "크루즈 부두 앞. 가장 자주 보이는 곳", main: true },
  { code: "C", name: "제6보도교", full: "제6보도교 쪽", landmark: "크루즈 부두 남쪽, 수로가 바다로 꺾이기 전" },
  { code: "D", name: "방파제", full: "방파제 · 수로 입구", landmark: "수로가 바다와 만나는 곳. 돌 깔린 얕은 물가" },
];

export const ZONE_BY_CODE = Object.fromEntries(ZONES.map((z) => [z.code, z])) as Record<ZoneCode, ZoneDef>;

/**
 * GPS로 구역까지 특정하지는 않는다. 구간이 수백 미터 안이라 폰 GPS 오차(10~50m)로는
 * 보도교를 구분할 수 없다. 공원 안인지만 판정하고, 구역은 사용자가 지도에서 고른다.
 */
export function inPark(lat: number, lng: number) {
  const d = Math.hypot((PARK.lat - lat) * 111000, (PARK.lng - lng) * 91000);
  return d <= 700;
}

/** 네이버 길찾기 (목적지: 검증된 공원 좌표) */
export function naverDirections() {
  return `https://map.naver.com/p/directions/-/${PARK.lng},${PARK.lat},${encodeURIComponent(PARK.name)}/-/transit`;
}

/** 네이버 지도에서 보기 */
export function naverPlace(q = PARK.name) {
  return `https://map.naver.com/p/search/${encodeURIComponent(q)}`;
}
