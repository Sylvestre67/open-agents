"use client";

import { SignInGoogleButton } from "@/components/auth/sign-in-google-button";

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold">Open Agents</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <SignInGoogleButton size="lg" callbackUrl="/sessions" />
      </div>
    </div>
  );
}
