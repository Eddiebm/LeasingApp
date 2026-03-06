"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { SubscriptionProvider, useSubscription } from "../../components/SubscriptionContext";

const LOGIN_SIGNUP_PATHS = ["/dashboard/login", "/dashboard/signup", "/dashboard/forgot-password", "/dashboard/reset-password"];

function FreePlanBanner() {
  const { isPro } = useSubscription();
  if (isPro) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs sm:text-sm text-amber-900">
      <span className="font-medium">
        Free plan · 1 property included
      </span>
      <Link
        href="/dashboard/billing"
        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-amber-700"
      >
        Upgrade to Pro →
      </Link>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [meData, setMeData] = useState<{ subscription_status?: string | null; country?: "UK" | "US"; needsOnboarding?: boolean; role?: string } | null>(null);
  const skipAuthCheck = LOGIN_SIGNUP_PATHS.some((p) => pathname === p);

  useEffect(() => {
    if (skipAuthCheck) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/dashboard/login");
        setChecking(false);
        return;
      }
      try {
        const res = await fetch("/api/dashboard/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => ({}));
        setMeData(data);
        if (data.needsOnboarding && pathname !== "/dashboard/onboarding") {
          router.replace("/dashboard/onboarding");
        } else if (pathname === "/dashboard/onboarding" && data.role) {
          router.replace("/dashboard");
        }
      } catch {
        // allow through; API may 401
      }
      setChecking(false);
    });
  }, [router, pathname, skipAuthCheck]);

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Checking access…</p>
      </div>
    );
  }

  const subscriptionStatus = meData?.subscription_status ?? "inactive";
  const country = (meData?.country as "US" | "UK") ?? "US";
  const showBanner = !skipAuthCheck && pathname !== "/dashboard/onboarding";

  return (
    <SubscriptionProvider subscription_status={subscriptionStatus} country={country}>
      {showBanner && <FreePlanBanner />}
      {children}
    </SubscriptionProvider>
  );
}
