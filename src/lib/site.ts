/**
 * 카드 하단·저장 이미지에 찍히는 사이트 주소.
 * 빌드할 때 VITE_SITE_HOST=bukangi.com 같은 값을 주면 그걸 쓰고,
 * 없으면 지금 접속한 주소(location.host)를 쓴다. 도메인이 바뀌어도 재빌드 없이 맞는다.
 */
export const SITE_HOST: string =
  (import.meta.env.VITE_SITE_HOST as string | undefined)?.trim() ||
  (typeof location !== "undefined" ? location.host : "");

/**
 * API 주소. 화면이 Cloudflare Workers에 있고 API는 맥미니(터널)에 있으면
 * 빌드할 때 VITE_API_BASE=https://api.bukangi.com 처럼 준다. 없으면 같은 주소.
 */
export const API_BASE: string = ((import.meta.env.VITE_API_BASE as string | undefined) || "").replace(/\/$/, "");
