// A small JSON-file store (users, each customer's transactions, and the day's analysis), written
// atomically. Everything lives under DATA_DIR so one folder is the whole backup.
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");

function file(...parts) {
  return path.join(DATA_DIR, ...parts);
}

function readJson(target, fallback) {
  if (!existsSync(target)) return fallback;
  try {
    return JSON.parse(readFileSync(target, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(target, value) {
  mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${randomUUID()}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, target);
}

// ---- JWT secret: from .env, else generated once and kept with the data ----
export function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const target = file("jwt-secret");
  if (!existsSync(target)) {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(target, randomBytes(48).toString("hex"));
  }
  return readFileSync(target, "utf8").trim();
}

// ---- users ----
const USERS = () => file("users.json");

export function findUserByEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  return readJson(USERS(), []).find((u) => u.email === normalized) || null;
}

export function findUserById(id) {
  return readJson(USERS(), []).find((u) => u.id === id) || null;
}

export function createUser({ name, email, passwordHash }) {
  const users = readJson(USERS(), []);
  const normalized = String(email).trim().toLowerCase();
  if (users.some((u) => u.email === normalized)) throw new Error("EMAIL_IN_USE");
  const user = { id: randomUUID(), name: String(name).trim(), email: normalized, passwordHash, createdAt: new Date().toISOString() };
  users.push(user);
  writeJson(USERS(), users);
  return user;
}

/** Changes the given fields of one user and returns the updated user (null if the user is gone). */
export function updateUser(id, patch) {
  const users = readJson(USERS(), []);
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  Object.assign(user, patch);
  writeJson(USERS(), users);
  return user;
}

/** Removes the user and everything kept for them. */
export function deleteUser(id) {
  writeJson(USERS(), readJson(USERS(), []).filter((u) => u.id !== id));
  clearTransactions(id);
}

// ---- a customer's transactions ----
const txFile = (userId) => file("portfolios", `${userId}.json`);
const analysisFile = (userId) => file("analysis", `${userId}.json`);

export function readTransactions(userId) {
  return readJson(txFile(userId), null);
}

export function saveTransactions(userId, record) {
  writeJson(txFile(userId), record);
  rmSync(analysisFile(userId), { force: true });
}

export function clearTransactions(userId) {
  rmSync(txFile(userId), { force: true });
  rmSync(analysisFile(userId), { force: true });
}

// ---- the calc-service result for a customer, kept for the day it was computed ----
export function readAnalysis(userId) {
  return readJson(analysisFile(userId), null);
}

export function saveAnalysis(userId, record) {
  writeJson(analysisFile(userId), record);
}
