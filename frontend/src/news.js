// Loads the news once and shares it between the Home card and the News screen; a second look
// within a few minutes reuses what was fetched.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

const FRESH_MS = 5 * 60 * 1000;
let cache = null; // { at, data }
let pending = null;

function load(force) {
  if (!force && cache && Date.now() - cache.at < FRESH_MS) return Promise.resolve(cache.data);
  if (!pending) {
    pending = api.news()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/** Forget what was fetched (on sign-out, or when the customer's funds change). */
export function clearNews() {
  cache = null;
}

/** { status: "loading" | "ready" | "error", data, reload } */
export function useNews() {
  const [state, setState] = useState(() => (cache ? { status: "ready", data: cache.data } : { status: "loading", data: null }));

  const run = useCallback((force) => {
    let live = true;
    if (force || !cache) setState((s) => ({ ...s, status: "loading" }));
    load(force)
      .then((data) => live && setState({ status: "ready", data }))
      .catch(() => live && setState((s) => ({ status: s.data ? "ready" : "error", data: s.data })));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => run(false), [run]);
  return { ...state, reload: () => run(true) };
}
