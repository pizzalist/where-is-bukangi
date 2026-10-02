import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";
import { initGA } from "./lib/ga";

// 앱이 주소의 ?s= 등을 지우기 전에 GA가 원래 주소(utm 유입 경로)를 잡도록 먼저 켠다
initGA();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
