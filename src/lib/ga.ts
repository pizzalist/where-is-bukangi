/**
 * 구글 애널리틱스(GA4). 자체 집계(/api/visit, /api/event)는 그대로 두고 GA에도 같은 흐름을 보낸다.
 *
 *  - 측정 ID는 빌드 값 VITE_GA_ID. 없으면 아무것도 하지 않는다
 *  - 실서비스 주소(bukangi.com)에서만 켠다. 검수 주소·로컬·운영자 화면·카드 렌더 화면·자동화 브라우저는 보내지 않는다
 *    검수 주소에서 확인할 때만 ?ga_test 를 붙이면 디버그 모드로 켠다 (GA의 DebugView에만 보이고 보고서에는 안 섞임)
 *  - 해시 주소(#/certify)라 화면 이동을 GA가 못 알아챈다. /certify 같은 가상 경로로 직접 보낸다
 *  - 카드 ID는 개인 링크라 경로에 넣지 않는다 (/card 로만)
 *  - 앱이 시작하자마자 주소의 ?s= 등을 지우므로, 그 전에 원래 주소를 잡아 첫 페이지뷰에 실어 보낸다 (utm 유입 경로 보존)
 */
const GA_ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim() || "";
const LIVE_HOST = "bukangi.com";
const SKIP_ROUTES = new Set(["admin", "shot"]);

type Gtag = (...args: unknown[]) => void;
declare global { interface Window { dataLayer?: unknown[]; gtag?: Gtag } }

let on = false;
let firstSearch = "";      // 첫 진입 주소의 쿼리 (utm_*, fbclid 등). 첫 페이지뷰에만 붙인다
let lastPath = "";

function routeOf(hash: string) {
  return hash.replace(/^#\/?/, "").split("/")[0] || "home";
}

export const gaEnabled = () => on;

/** main.tsx에서 앱보다 먼저 부른다 */
export function initGA() {
  if (!GA_ID || on) return;
  try {
    const test = new URLSearchParams(location.search).has("ga_test");
    const bot = (navigator as Navigator & { webdriver?: boolean }).webdriver;
    if (!test && (bot || location.hostname !== LIVE_HOST)) return;
    if (SKIP_ROUTES.has(routeOf(location.hash))) return;

    firstSearch = location.search;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer!.push(arguments); } as Gtag;
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { send_page_view: false, ...(test ? { debug_mode: true } : {}) });

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(s);
    on = true;

    pageview();
    addEventListener("hashchange", pageview);
  } catch { /* 분석은 부가 기능. 실패해도 사이트는 그대로 */ }
}

function pageview() {
  if (!on) return;
  const route = routeOf(location.hash);
  if (SKIP_ROUTES.has(route)) return;
  const path = route === "home" ? "/" : `/${route}`;
  if (path === lastPath) return;            // 같은 화면 안에서 해시만 바뀐 경우(카드 ID 등)는 한 번만
  lastPath = path;
  const loc = `${location.origin}${path}${firstSearch}`;
  firstSearch = "";
  window.gtag?.("event", "page_view", { page_location: loc, page_path: path, page_title: document.title });
}

/** 우리 서비스의 행동 지표를 GA 이벤트로도 보낸다 */
export function gaEvent(name: string, params?: Record<string, string | number>) {
  if (!on) return;
  try { window.gtag?.("event", name, params || {}); } catch { /* 무시 */ }
}
