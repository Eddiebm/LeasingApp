"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const LOGIN_SIGNUP_PATHS = ["/dashboard/login", "/dashboard/signup"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
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

  return <>{children}</>;
}
