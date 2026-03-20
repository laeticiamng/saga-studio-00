import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

window.addEventListener("unhandledrejection", (e) => {
  console.error("[Unhandled Promise Rejection]", e.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
