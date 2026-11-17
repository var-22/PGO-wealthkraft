async function call(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Can't reach the server. Check your connection and try again."), { status: 0 });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.error || "Something went wrong. Please try again."), { status: response.status, details: data.details, rejected: data.rejected });
  }
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The first calculation of the day can take minutes; the server answers "preparing" and the app
// checks back until the portfolio is ready.
async function whenReady(first) {
  let data = await first();
  while (data.preparing) {
    await sleep(5000);
    data = await call("/api/portfolio");
  }
  return data;
}

export const api = {
  me: () => call("/api/auth/me"),
  signIn: (email, password) => call("/api/auth/signin", { method: "POST", body: { email, password } }),
  signUp: (name, email, password) => call("/api/auth/signup", { method: "POST", body: { name, email, password } }),
  signOut: () => call("/api/auth/signout", { method: "POST" }),
  portfolio: () => whenReady(() => call("/api/portfolio")),
  refresh: () => whenReady(() => call("/api/portfolio/refresh", { method: "POST" })),
  importCsv: (csv) => call("/api/portfolio/import", { method: "POST", body: { csv } }),
  useSample: () => call("/api/portfolio/sample", { method: "POST" }),
  removePortfolio: () => call("/api/portfolio", { method: "DELETE" }),
  transactions: () => call("/api/portfolio/transactions"),
  news: () => call("/api/news"),
  updateName: (name) => call("/api/auth/profile", { method: "PATCH", body: { name } }),
  changePassword: (currentPassword, newPassword) => call("/api/auth/password", { method: "POST", body: { currentPassword, newPassword } }),
  deleteAccount: (password) => call("/api/auth/account", { method: "DELETE", body: { password } }),
};
