"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import Image from "next/image";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();
  const processed = useRef(false);

  // Derive error state from search params (no setState in effect)
  const token = searchParams.get("token");
  const redirectPath = searchParams.get("redirect");
  const hasError = !token;

  useEffect(() => {
    if (processed.current || !token) return;
    processed.current = true;

    // Store token and redirect to target (or dashboard)
    localStorage.setItem("osr_token", token);
    refresh().then(() => {
      router.replace(redirectPath || "/dashboard");
    });
  }, [token, router, refresh, redirectPath]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto max-w-sm text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
          <Image src="/osr-icon-red-512.svg" alt="OSR" width={32} height={32} />
          <h1 className="text-2xl font-bold tracking-tight">
            OpenStreamRotator
          </h1>
        </div>

        {hasError ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">No token received from Discord. Please try signing in again.</p>
            </div>
            <Link
              href="/"
              className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Signing you in...</p>
          </div>
        )}
      </div>
    </div>
  );
}
