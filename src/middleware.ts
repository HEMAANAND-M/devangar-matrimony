import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request nonce-based Content Security Policy. Next.js reads the nonce from the request's
 * CSP header and applies it to its own inline scripts, so only scripts we serve can run.
 */
// Pages that need a signed-in member. The cookie's validity is still checked on the page itself;
// this only gives signed-out visitors an immediate redirect instead of a flash of loading skeleton.
const MEMBER_PATHS = [
  "/dashboard", "/search", "/interests", "/shortlist", "/profile", "/profiles", "/photos",
  "/settings", "/admin", "/upgrade", "/verify-id", "/verify", "/verify-photo", "/messages", "/visitors",
  "/invoices",
];
const SESSION_COOKIES = ["__Host-dm_session", "dm_session"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isMemberPath = MEMBER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isMemberPath && !SESSION_COOKIES.some((name) => request.cookies.get(name)?.value)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  // Only ask browsers to upgrade to HTTPS when we are served over HTTPS; on plain HTTP (LAN testing)
  // the upgraded script requests would fail and the site would stop working.
  const https = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")).split(",")[0].trim() === "https";

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' lets nonce-approved scripts load their chunks; dev needs eval for fast refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.razorpay.com",
    "font-src 'self'",
    `connect-src 'self' https://*.razorpay.com${dev ? " ws: wss:" : ""}`,
    // Razorpay Checkout renders its payment form in an iframe.
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Pages only: skip static assets, image optimisation, metadata files and photo bytes.
    {
      source: "/((?!api/|_next/static|_next/image|icon|apple-icon|manifest|opengraph-image|robots.txt|sitemap.xml|favicon).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
