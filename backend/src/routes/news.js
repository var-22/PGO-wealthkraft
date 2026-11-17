import { Router } from "express";
import { requireAuth } from "./auth.js";
import { newsFor } from "../services/news.js";
import { readTransactions } from "../services/store.js";

export const newsRouter = Router();

/** The funds a customer has put money into, largest first, straight from their transactions. */
function fundsOf(userId) {
  const totals = new Map();
  for (const t of readTransactions(userId)?.transactions || []) {
    const code = String(t.scheme_code);
    const entry = totals.get(code) || { code, name: t.scheme_name, amount: 0 };
    const amount = t.units * t.nav;
    entry.amount += t.transaction_type === "SELL" ? -amount : t.transaction_type === "DIVIDEND" ? 0 : amount;
    totals.set(code, entry);
  }
  return [...totals.values()].filter((f) => f.amount > 0).sort((a, b) => b.amount - a.amount);
}

newsRouter.get("/api/news", requireAuth, async (req, res, next) => {
  try {
    res.json(await newsFor(fundsOf(req.user.id)));
  } catch (err) {
    next(err);
  }
});
