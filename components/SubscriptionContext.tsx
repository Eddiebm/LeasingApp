"use client";

import { createContext, useContext, type ReactNode } from "react";
import { isProSubscriber } from "../lib/subscription";

type SubscriptionContextValue = {
  subscription_status: string | null | undefined;
  isPro: boolean;
  country: "UK" | "US";
};

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription_status: "inactive",
  isPro: false,
  country: "UK",
});

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({
  children,
  subscription_status,
  country,
}: {
  children: ReactNode;
  subscription_status: string | null | undefined;
  country: "UK" | "US";
}) {
  const isPro = isProSubscriber(subscription_status);
  return (
    <SubscriptionContext.Provider
      value={{
        subscription_status: subscription_status ?? "inactive",
        isPro,
        country,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
