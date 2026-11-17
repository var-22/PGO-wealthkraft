import { readFileSync } from "node:fs";
import { Router } from "express";
import { requireAuth } from "./auth.js";
import { PREPARING, portfolioFor, transactionsFor } from "../services/portfolio.js";
import { clearTransactions, saveTransactions } from "../services/store.js";
import { parseTransactionsCsv } from "../services/transactionsCsv.js";

export const portfolioRouter = Router();
portfolioRouter.use("/api/portfolio", requireAuth);

const SAMPLE_CSV = new URL("../sample/sample-portfolio.csv", import.meta.url);

async function sendPortfolio(req, res, options) {
  try {
    const portfolio = await portfolioFor(req.user.id, options);
    if (portfolio === PREPARING) return res.status(202).json({ preparing: true });
    res.json({ portfolio });
  } catch (err) {
    if (err.message === "NO_SCHEMES") {
      return res.status(422).json({ error: "None of the funds in your statement could be matched to an AMFI scheme code.", rejected: err.rejected });
    }
    console.error(JSON.stringify({ level: "error", event: "portfolio_failure", message: err.message }));
    res.status(502).json({ error: "We couldn't refresh your portfolio just now. Please try again in a moment." });
  }
}

portfolioRouter.get("/api/portfolio", (req, res) => sendPortfolio(req, res, {}));
portfolioRouter.post("/api/portfolio/refresh", (req, res) => sendPortfolio(req, res, { force: true }));
portfolioRouter.get("/api/portfolio/transactions", (req, res) => res.json({ transactions: transactionsFor(req.user.id) }));

function store(req, res, text, source) {
  const { transactions, errors } = parseTransactionsCsv(text);
  if (errors.length || !transactions.length) {
    return res.status(400).json({ error: "This file couldn't be read.", details: errors.slice(0, 12) });
  }
  saveTransactions(req.user.id, { source, importedAt: new Date().toISOString(), transactions });
  res.json({ ok: true, count: transactions.length });
}

// The customer's own transaction list, as CSV text in the fixed layout (see transactionsCsv.js).
portfolioRouter.post("/api/portfolio/import", (req, res) => store(req, res, req.body?.csv, "statement"));

// A sample portfolio of real funds, so the app can be explored before a statement is added.
portfolioRouter.post("/api/portfolio/sample", (req, res) => store(req, res, readFileSync(SAMPLE_CSV, "utf8"), "sample"));

portfolioRouter.delete("/api/portfolio", (req, res) => {
  clearTransactions(req.user.id);
  res.json({ ok: true });
});
