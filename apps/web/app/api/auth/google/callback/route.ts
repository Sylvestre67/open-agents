import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import { encrypt } from "@/lib/crypto";
import { upsertUser } from "@/lib/db/users";
import { encryptJWE } from "@/lib/jwe/encrypt";
import { SESSION_COOKIE_NAME } from "@/lib/session/constants";
import { exchangeGoogleCode, getGoogleUserInfo } from "@/lib/google/oauth";

function clearGoogleOauthCookies(store: Awaited<ReturnType<typeof cookies>>) {
  store.delete("google_auth_state");
  store.delete("google_code_verifier");
  store.delete("google_auth_redirect_to");
}

export async function GET(req: NextRequest): Promise<Response> {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();

  const storedState = cookieStore.get("google_auth_state")?.value;
  const codeVerifier = cookieStore.get("google_code_verifier")?.value;
  const rawRedirectTo =
    cookieStore.get("google_auth_redirect_to")?.value ?? "/";

  const storedRedirectTo =
    rawRedirectTo.startsWith("/") && !rawRedirectTo.startsWith("//")
      ? rawRedirectTo
      : "/";

  if (!code || !state || storedState !== state || !codeVerifier) {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response("Google OAuth not configured", { status: 500 });
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;

    const tokens = await exchangeGoogleCode({
      code,
      codeVerifier,
      clientId,
      clientSecret,
      redirectUri,
    });

    const userInfo = await getGoogleUserInfo(tokens.access_token);

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const username = userInfo.email ?? userInfo.sub;

    const userId = await upsertUser({
      provider: "google",
      externalId: userInfo.sub,
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : undefined,
      scope: tokens.scope,
      username,
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.picture,
      tokenExpiresAt,
    });

    const session = {
      created: Date.now(),
      authProvider: "google" as const,
      user: {
        id: userId,
        username,
        email: userInfo.email,
        name: userInfo.name ?? username,
        avatar: userInfo.picture ?? "",
      },
    };

    const sessionToken = await encryptJWE(session, "1y");
    const expires = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toUTCString();

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: storedRedirectTo,
      },
    });

    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=${sessionToken}; Path=/; Max-Age=${365 * 24 * 60 * 60}; Expires=${expires}; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}SameSite=Lax`,
    );

    clearGoogleOauthCookies(cookieStore);

    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return new Response("Authentication failed", { status: 500 });
  }
}
