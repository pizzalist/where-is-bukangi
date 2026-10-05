/**
 * 구역과 공원 반경 판정.
 */
export const ZONES = [
  { code: "A", name: "제4보도교" }, { code: "B", name: "제5보도교" },
  { code: "C", name: "제6보도교" }, { code: "D", name: "방파제" },
];
export const ZONE_CODES = new Set(ZONES.map((z) => z.code));
export const ZONE_NAME = Object.fromEntries(ZONES.map((z) => [z.code, z.name]));

// 공원 좌표 (src/lib/zones.ts와 같은 값). 반경은 환경변수로 즉시 조정 가능
export const PARK = { lat: 35.1144, lng: 129.0464, radius: Number(process.env.PARK_RADIUS || 700) };
const MAX_ACC = 1500;    // 기지국 기반 위치는 오차가 크다. 이만큼까지만 봐준다

export const distToPark = (lat, lng) => Math.hypot((PARK.lat - lat) * 111000, (PARK.lng - lng) * 91000);
/** 오차 반경을 감안해 판정. 인앱 브라우저는 GPS 대신 기지국 위치가 오는 경우가 많다 */
export const inPark = (lat, lng, acc = 0) =>
  distToPark(lat, lng) <= PARK.radius + Math.min(Math.max(acc, 0), MAX_ACC);
