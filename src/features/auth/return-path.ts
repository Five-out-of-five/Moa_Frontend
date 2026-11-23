export function getAuthReturnPath(value: unknown) {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value) || /%(?:0a|0d|5c|2f)/i.test(value)) return null;
  const url = new URL(value, "https://moa.invalid");
  if (url.origin !== "https://moa.invalid" || url.pathname.startsWith("//") || /^\/(?:auth|api|login|signup)(?:\/|$)/.test(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
