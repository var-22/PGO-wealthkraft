// Installing the app on a phone or computer ("Add to Home screen").
// The browser offers installation through one event, which can arrive before the screens are
// drawn, so it is caught here as soon as the app's code loads.
import { useEffect, useState } from "react";

let promptEvent = null;
let installed = false;
const listeners = new Set();
const tell = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // we show our own button instead of the browser's bar
    promptEvent = event;
    tell();
  });
  window.addEventListener("appinstalled", () => {
    promptEvent = null;
    installed = true;
    tell();
  });
}

/** Registers the service worker. Only in a built app: during development it would serve stale files. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // not allowed here (plain http on a network address, private window): the app still works in the browser
    });
  });
}

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

/**
 * state is "installed" (already running as an app), "ready" (the Install button will work),
 * "ios" (iPhone: installed by hand from the Share menu) or "unavailable".
 */
export function useInstall() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  const state = installed || isStandalone() ? "installed" : promptEvent ? "ready" : isIos() ? "ios" : "unavailable";

  async function install() {
    if (!promptEvent) return false;
    const event = promptEvent;
    event.prompt();
    const choice = await event.userChoice.catch(() => null);
    promptEvent = null; // the browser allows one use per event
    tell();
    return choice?.outcome === "accepted";
  }

  return { state, install };
}
