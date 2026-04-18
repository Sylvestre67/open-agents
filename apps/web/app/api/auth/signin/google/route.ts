import { generateState } from "arctic";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getGoogleAuthorizationUrl,
} from "@/lib/google/oauth";

export async function GET(req: NextRequest): Promise<Response> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;

  if (!clientId) {
    return Response.redirect(new URL("/?error=google_not_configured", req.url));
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const store = await cookies();
  const redirectTo = req.nextUrl.searchParams.get("next") ?? "/";

  store.set("google_auth_state", state, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  store.set("google_code_verifier", codeVerifier, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  store.set("google_auth_redirect_to", redirectTo, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  const url = getGoogleAuthorizationUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge,
  });

  return Response.redirect(url);
}
