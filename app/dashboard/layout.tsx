"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const isLoginPage = pathname === "/dashboard/login";

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/dashboard/login");
      setChecking(false);
    });
  }, [router, isLoginPage]);

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Checking access…</p>
      </div>
    );
  }

  return <>{children}</>;
}
