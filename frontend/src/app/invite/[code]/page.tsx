"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getInviteInfo,
  acceptInvite,
  getApiBase,
  type InviteInfo,
  ApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, Loader2, AlertCircle, CheckCircle2, Users } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  content_manager: "Content Manager",
  moderator: "Moderator",
  viewer: "Viewer",
};

export default function InviteAcceptPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [apiBase, setApiBase] = useState("");
  const fetched = useRef(false);

  useEffect(() => {
    setApiBase(getApiBase());
  }, []);

  // Fetch invite info (no auth required)
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    getInviteInfo(params.code)
      .then(setInvite)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("This invite link is invalid or doesn't exist.");
        } else {
          setError("Failed to load invite info.");
        }
      })
      .finally(() => setLoading(false));
  }, [params.code]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      await acceptInvite(params.code);
      setAccepted(true);
      // Redirect to dashboard after a short delay
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to accept invite.");
      }
    } finally {
      setAccepting(false);
    }
  }

  // Full-page loading
  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-3">
        <Radio className="h-8 w-8 text-red-500" />
        <h1 className="text-2xl font-bold tracking-tight">
          OpenStreamRotator
        </h1>
      </div>

      <Card className="w-full max-w-md">
        {accepted ? (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <CardTitle>You&apos;re in!</CardTitle>
              <CardDescription>
                You&apos;ve joined <strong>{invite?.team_name}</strong> as{" "}
                <strong>{ROLE_LABELS[invite?.role ?? "viewer"]}</strong>.
                Redirecting to dashboard...
              </CardDescription>
            </CardHeader>
          </>
        ) : error && !invite ? (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <CardTitle>Invalid Invite</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button variant="outline" onClick={() => router.push("/")}>
                Go Home
              </Button>
            </CardFooter>
          </>
        ) : invite ? (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Team Invite</CardTitle>
              <CardDescription>
                You&apos;ve been invited to join a team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Team</span>
                  <span className="font-medium">{invite.team_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Role</span>
                  <Badge variant="secondary">
                    {ROLE_LABELS[invite.role]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Invited by
                  </span>
                  <span className="text-sm">{invite.created_by}</span>
                </div>
                {invite.expires_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Expires
                    </span>
                    <span className="text-sm">
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {!invite.is_valid && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  This invite has expired or reached its usage limit.
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              {!user ? (
                <>
                  <Button asChild className="w-full" size="lg">
                    <a
                      href={`${apiBase}/auth/discord/login?redirect=/invite/${params.code}`}
                    >
                      <svg
                        className="h-5 w-5 mr-2"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                      </svg>
                      Sign in with Discord to Accept
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    You need to sign in before you can accept this invite
                  </p>
                </>
              ) : invite.is_valid ? (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleAccept}
                  disabled={accepting}
                >
                  {accepting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Accept Invite
                </Button>
              ) : (
                <Button className="w-full" variant="outline" onClick={() => router.push("/dashboard")}>
                  Go to Dashboard
                </Button>
              )}
            </CardFooter>
          </>
        ) : null}
      </Card>
    </div>
  );
}
