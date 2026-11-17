import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createUser, deleteUser, findUserByEmail, findUserById, jwtSecret, updateUser } from "../services/store.js";

export const authRouter = Router();

const TOKEN_TTL = "30d";
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sign-in is slowed after repeated wrong passwords for one email + address.
const failures = new Map();
const MAX_FAILURES = 8;
const LOCK_MS = 10 * 60 * 1000;

function isLocked(key) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > LOCK_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function noteFailure(key) {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > LOCK_MS) failures.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, jwtSecret(), { expiresIn: TOKEN_TTL });
  // secure follows the request's own protocol, so the cookie still works over plain http in dev.
  res.cookie("pgo_session", token, { httpOnly: true, secure: res.req.secure, sameSite: "lax", maxAge: COOKIE_MAX_AGE_MS });
}

const userJson = (user) => ({ name: user.name, email: user.email, createdAt: user.createdAt });

export function requireAuth(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies?.pgo_session || "", jwtSecret());
    const user = findUserById(payload.sub);
    if (!user) throw new Error("gone");
    // Changing the password signs out every other device: older cookies stop working.
    if (user.passwordChangedAt && payload.iat * 1000 < Date.parse(user.passwordChangedAt) - 1000) throw new Error("stale");
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Please sign in again." });
  }
}

authRouter.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  // One address can only open a handful of accounts in a short while.
  const signupKey = `signup|${req.ip}`;
  if (isLocked(signupKey)) return res.status(429).json({ error: "Too many new accounts from this device. Please try again in a few minutes." });
  if (!name?.trim() || !email || !password) return res.status(400).json({ error: "Name, email and password are required." });
  if (!EMAIL_PATTERN.test(String(email).trim())) return res.status(400).json({ error: "That email address doesn't look right." });
  if (String(password).length < 8) return res.status(400).json({ error: "Use a password of at least 8 characters." });
  try {
    const user = createUser({ name: String(name).slice(0, 80), email, passwordHash: await bcrypt.hash(String(password), 10) });
    noteFailure(signupKey);
    setSession(res, user);
    res.json(userJson(user));
  } catch (err) {
    if (err.message === "EMAIL_IN_USE") return res.status(409).json({ error: "An account with this email already exists." });
    throw err;
  }
});

authRouter.post("/api/auth/signin", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  const key = `${String(email).trim().toLowerCase()}|${req.ip}`;
  if (isLocked(key)) return res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
  const user = findUserByEmail(email);
  const ok = user && (await bcrypt.compare(String(password), user.passwordHash));
  if (!ok) {
    noteFailure(key);
    // The same message for an unknown email and a wrong password.
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  failures.delete(key);
  setSession(res, user);
  res.json(userJson(user));
});

authRouter.post("/api/auth/signout", (req, res) => {
  res.clearCookie("pgo_session");
  res.json({ ok: true });
});

authRouter.get("/api/auth/me", requireAuth, (req, res) => res.json(userJson(req.user)));

// ---- the signed-in customer's own account ----

authRouter.patch("/api/auth/profile", requireAuth, (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Please enter your name." });
  if (name.length > 80) return res.status(400).json({ error: "That name is too long (80 characters at most)." });
  res.json(userJson(updateUser(req.user.id, { name })));
});

/** Checks the current password, with the same slow-down as sign-in. Answers the request itself when it fails. */
async function confirmPassword(req, res) {
  const key = `confirm|${req.user.id}`;
  if (isLocked(key)) {
    res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
    return false;
  }
  const given = req.body?.currentPassword ?? req.body?.password;
  if (!given || !(await bcrypt.compare(String(given), req.user.passwordHash))) {
    noteFailure(key);
    res.status(403).json({ error: "Your current password is not correct." });
    return false;
  }
  failures.delete(key);
  return true;
}

authRouter.post("/api/auth/password", requireAuth, async (req, res, next) => {
  try {
    const next_ = String(req.body?.newPassword ?? "");
    if (next_.length < 8) return res.status(400).json({ error: "Use a new password of at least 8 characters." });
    if (!(await confirmPassword(req, res))) return undefined;
    const user = updateUser(req.user.id, { passwordHash: await bcrypt.hash(next_, 10), passwordChangedAt: new Date().toISOString() });
    setSession(res, user); // this device stays signed in; every other one is signed out
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

authRouter.delete("/api/auth/account", requireAuth, async (req, res, next) => {
  try {
    if (!(await confirmPassword(req, res))) return undefined;
    deleteUser(req.user.id);
    res.clearCookie("pgo_session");
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});
