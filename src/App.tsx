import { useEffect, useState } from "react";
import type { Status, Submission } from "./lib/types";
import { fetchStatus } from "./lib/api";
const ONE = `${import.meta.env.BASE_URL}bukang-one.webp`;
import Home from "./pages/Home";
import Certify from "./pages/Certify";
import Card from "./pages/Card";
import Admin from "./pages/Admin";
import Tiers from "./pages/Tiers";
import Hall from "./pages/Hall";

type Route = "home" | "certify" | "card" | "admin" | "tiers" | "hall";

function parseHash(): { route: Route; param?: string } {
  const h = location.hash.replace(/^#\/?/, "");
  const [r, p] = h.split("/");
  if (r === "certify" || r === "card" || r === "admin" || r === "tiers" || r === "hall") return { route: r, param: p };
  return { route: "home" };
}

const Icon = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  certify: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  card: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>,
  admin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
};

export function navigate(route: Route, param?: string) {
  const h = `#/${route === "home" ? "" : route}${param ? "/" + param : ""}`;
  try { if (location.hash !== h) location.hash = h; } catch { /* 샌드박스에서 막힐 수 있음 */ }
}

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nav, setNav] = useState(parseHash());
  const go = (route: Route, param?: string) => { setNav({ route, param }); navigate(route, param); };
  const [focusCard, setFocusCard] = useState<string | null>(null);

  useEffect(() => {
    const load = () => fetchStatus().then(setStatus).catch(() => setErr("상황 정보를 불러오지 못했어요. 마지막 화면이 오래됐을 수 있어요."));
    load();
    const t = setInterval(load, 30000);
    const onHash = () => setNav(parseHash());
    addEventListener("hashchange", onHash);
    return () => { clearInterval(t); removeEventListener("hashchange", onHash); };
  }, []);

  function onCertified(s: Submission) { setFocusCard(s.id); go("card", s.id); }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); go("home"); }}>
            <img className="brand-logo" src={ONE} alt="" width={40} height={40} />
            <span>
              <div className="display">부캉이 지금 있나</div>
              <small>북항 친수공원 · 비공식</small>
            </span>
          </a>
          <span className="spacer" />
          {status?.control ? <span className="pill crit">출입통제</span> : status?.demo ? <span className="pill warn">데모</span> : null}
          {nav.route === "admin" && <span className="pill est">운영자</span>}
        </div>
      </header>

      {status?.demo && <div className="demobar">서버에 연결되지 않았어요. 아래는 <b>예시 데이터</b>이고 제보는 되지 않아요.</div>}
      {err && <div className="page"><div className="alert warn" style={{ marginTop: "1rem" }}>{err}</div></div>}
      {!status && !err && <div className="page" style={{ paddingTop: "3rem", textAlign: "center", color: "var(--ink-3)" }}><img src={ONE} alt="" width={90} height={90} /><div>불러오는 중</div></div>}
      {status && nav.route === "home" && <Home status={status} onDraw={() => go("certify")} onHall={() => go("hall")} />}
      {status && nav.route === "certify" && <Certify status={status} onDone={onCertified} onTiers={() => go("tiers")} />}
      {status && nav.route === "card" && <Card status={status} focus={nav.param ?? focusCard} onTiers={() => go("tiers")} />}
      {nav.route === "admin" && <Admin />}
      {status && nav.route === "tiers" && <Tiers onBack={() => go("certify")} />}
      {status && nav.route === "hall" && <Hall onBack={() => go("home")} />}

      <nav className="nav">
        <div className="nav-inner nav-3">
          <a href="#/" className={nav.route === "home" ? "on" : ""} onClick={(e) => { e.preventDefault(); go("home"); }}>{Icon.home}지금</a>
          <a href="#/certify" className={nav.route === "certify" ? "on" : ""} onClick={(e) => { e.preventDefault(); go("certify"); }}>{Icon.certify}카드 뽑기</a>
          <a href="#/card" className={nav.route === "card" ? "on" : ""} onClick={(e) => { e.preventDefault(); go("card"); }}>{Icon.card}내 카드</a>
        </div>
      </nav>
    </div>
  );
}
