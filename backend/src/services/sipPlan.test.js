import assert from "node:assert/strict";
import { test } from "node:test";
import { sipPlan } from "./sipPlan.js";

const sip = (code, date, amount = 10000) => ({ scheme_code: code, transaction_type: "SIP", units: amount / 100, nav: 100, transaction_date: date });

test("monthly SIP: latest amount, usual day, next date after today", () => {
  const tx = [sip("1", "2026-08-05"), sip("1", "2026-09-07"), sip("1", "2026-10-05"), sip("1", "2026-11-05", 9999.9)];
  assert.deepEqual(sipPlan(tx, ["1"], "2026-11-12"), { 1: { amount: 10000, day: 5, nextDate: "2026-12-05" } });
});

test("next date rolls forward when the last instalment is old", () => {
  const tx = [sip("1", "2026-01-10"), sip("1", "2026-02-10")];
  assert.equal(sipPlan(tx, ["1"], "2026-11-12")["1"].nextDate, "2026-12-10");
});

test("an instalment due today counts as upcoming", () => {
  const tx = [sip("1", "2026-09-12"), sip("1", "2026-10-12")];
  assert.equal(sipPlan(tx, ["1"], "2026-11-12")["1"].nextDate, "2026-11-12");
});

test("day 31 falls on the last day of a shorter month, across a year end", () => {
  const tx = [sip("1", "2026-12-31"), sip("1", "2027-01-31")];
  assert.equal(sipPlan(tx, ["1"], "2027-02-01")["1"].nextDate, "2027-02-28");
});

test("weekly SIPs and funds that are not live are left out", () => {
  const tx = [sip("1", "2026-10-01"), sip("1", "2026-10-08"), sip("1", "2026-10-15"), sip("2", "2026-09-05"), sip("2", "2026-10-05")];
  assert.deepEqual(sipPlan(tx, ["1"], "2026-11-12"), {});
});

test("scheme codes match whether they arrive as text or numbers", () => {
  const tx = [sip("7", "2026-09-05"), sip("7", "2026-10-05")];
  assert.equal(sipPlan(tx, [7], "2026-10-20")["7"].nextDate, "2026-11-05");
});
