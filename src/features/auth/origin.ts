export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) && (process.env.AUTH_FRONTEND_ORIGIN ? origin === process.env.AUTH_FRONTEND_ORIGIN : parsed.host === request.headers.get("host"));
  } catch { return false; }
}
