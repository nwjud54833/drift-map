export function getProCheckoutUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_PRO_CHECKOUT_URL?.trim();
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")
      || /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)
      || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
      || host === "::1" || host.startsWith("[fc") || host.startsWith("[fd") || host.startsWith("[fe80")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
