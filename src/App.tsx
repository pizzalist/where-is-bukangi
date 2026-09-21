import { useEffect, useState } from "react";
import type { Status, Submission } from "./lib/types";
import { loadStatus } from "./lib/store";
import Shark from "./components/Shark";
import Home from "./pages/Home";
import Certify from "./pages/Certify";
import Card from "./pages/Card";
import Admin from "./pages/Admin";

type Route = "home" | "certify" | "card" | "admin";

function parseHash(): { route: Route; param?: string } {
  const h = location.hash.replace(/^#\/?/, "");
  const [r, p] = h.split("/");
  if (r === "certify" || r === "card" || r === "admin") return { route: r, param: p };
  return { route: "home" };
}

const Icon = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  certify: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  card: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>,
  admin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
};

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nav, setNav] = useState(parseHash());
  const [focusCard, setFocusCard] = useState<string | null>(null);

  useEffect(() => {
    const load = () => loadStatus().then(setStatus).catch(() => setErr("상황 정보를 불러오지 못했어요. 마지막 화면이 오래됐을 수 있어요."));
    load();
    const t = setInterval(load, 30000);
    const onHash = () => setNav(parseHash());
    addEventListener("hashchange", onHash);
    return () => { clearInterval(t); removeEventListener("hashchange", onHash); };
  }, []);

  function onCertified(s: Submission) { setFocusCard(s.id); location.hash = "#/card"; }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/">
            <Shark size={40} swim={false} />
            <span>
              <div className="display">부캉이 지금 있나</div>
              <small>북항 친수공원 · 비공식</small>
            </span>
          </a>
          <span className="spacer" />
          {status?.control ? <span className="pill crit">출입통제</span> : <span className="pill">DRAFT</span>}
        </div>
      </header>

      {err && <div className="page"><div className="alert warn" style={{ marginTop: "1rem" }}>{err}</div></div>}
      {!status && !err && <div className="page" style={{ paddingTop: "3rem", textAlign: "center", color: "var(--ink-3)" }}><Shark size={90} /><div>불러오는 중</div></div>}
      {status && nav.route === "home" && <Home status={status} />}
      {status && nav.route === "certify" && <Certify status={status} onDone={onCertified} />}
      {status && nav.route === "card" && <Card status={status} focus={focusCard} />}
      {status && nav.route === "admin" && <Admin status={status} />}

      <nav className="nav">
        <div className="nav-inner">
          <a href="#/" className={nav.route === "home" ? "on" : ""}>{Icon.home}지금</a>
          <a href="#/certify" className={nav.route === "certify" ? "on" : ""}>{Icon.certify}인증받기</a>
          <a href="#/card" className={nav.route === "card" ? "on" : ""}>{Icon.card}내 카드</a>
          <a href="#/admin" className={nav.route === "admin" ? "on" : ""}>{Icon.admin}운영</a>
        </div>
      </nav>
    </div>
  );
}
