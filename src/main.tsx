import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

window.addEventListener("unhandledrejection", (e) => {
  console.error("[Unhandled Promise Rejection]", e.reason);
});

const rootEl = document.getElementById("root")!;

function showFatalError(err: unknown) {
  console.error("[Fatal] App failed to initialize:", err);
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0d0d0d;color:#f5e6cc;font-family:'Space Grotesk',system-ui,sans-serif;padding:1.5rem;text-align:center">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e09030" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:1rem"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem">Impossible de charger l'application</h1>
      <p style="color:#b0956a;max-width:28rem;margin-bottom:1.5rem">Une erreur critique est survenue au d\u00E9marrage. Veuillez recharger la page ou r\u00E9essayer plus tard.</p>
      <button onclick="location.reload()" style="background:linear-gradient(135deg,hsl(35,100%,55%),hsl(15,100%,50%));color:#0d0d0d;border:none;padding:0.75rem 1.5rem;border-radius:0.75rem;font-weight:600;font-size:1rem;cursor:pointer">Recharger la page</button>
    </div>
  `;
}

// Dynamic import so that module-level errors (e.g. missing Supabase env vars)
// are caught and the fallback error page is shown instead of a black screen.
import("./App.tsx")
  .then(({ default: App }) => {
    try {
      createRoot(rootEl).render(createElement(App));
    } catch (err) {
      showFatalError(err);
    }
  })
  .catch(showFatalError);
