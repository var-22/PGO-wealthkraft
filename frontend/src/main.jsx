import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { registerServiceWorker } from "./install.js";
import { applyTheme, readPref } from "./prefs.js";
import "./styles.css";

applyTheme(readPref("theme", "system")); // before the first paint, so the chosen theme never flashes
registerServiceWorker();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
