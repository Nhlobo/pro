import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Recover automatically when a lazy-loaded route chunk can no longer be
// fetched (e.g. the tab was left open across a new deploy and the old
// hashed JS file, like "Index-BIXBzzWa.js", was replaced on the server).
// Vite dispatches this event whenever a dynamic import()/preload fails.
// Reloading once picks up the fresh index.html + current chunk hashes.
// The sessionStorage guard prevents a reload loop if the chunk is missing
// for a real, persistent reason (e.g. a genuinely broken deploy).
window.addEventListener("vite:preloadError", () => {
  const key = "chunk-reload-attempted";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);

// The app rendered successfully, so clear the guard a few seconds later.
// This keeps the "reload once" protection scoped to a single failure
// instead of permanently disabling recovery for the rest of the tab's life.
window.setTimeout(() => sessionStorage.removeItem("chunk-reload-attempted"), 5000);
