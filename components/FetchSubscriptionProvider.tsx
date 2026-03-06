"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { SubscriptionProvider } from "./SubscriptionContext";
import { DEFAULT_COUNTRY } from "../lib/subscription";

/**
 * Use on pages outside the dashboard (e.g. /generate-lease, /documents, /eviction)
 * so ProGate can read subscription status. Fetches /api/dashboard/me when user has a session.
 */
export function FetchSubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>("inactive");
  const [country, setCountry] = useState<"UK" | "US">(DEFAULT_COUNTRY);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        setSubscriptionStatus("inactive");
        return;
      }
      fetch("/api/dashboard/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          setSubscriptionStatus(data.subscription_status ?? data.landlord?.subscription_status ?? "inactive");
          setCountry((data.country as "UK" | "US") ?? DEFAULT_COUNTRY);
        })
        .catch(() => setSubscriptionStatus("inactive"));
    });
  }, []);

  return (
    <SubscriptionProvider subscription_status={subscriptionStatus} country={country}>
      {children}
    </SubscriptionProvider>
  );
}
