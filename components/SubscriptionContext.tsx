"use client";

import { createContext, useContext, type ReactNode } from "react";
import { isProSubscriber } from "../lib/subscription";

type SubscriptionContextValue = {
  subscription_status: string | null | undefined;
  isPro: boolean;
};

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription_status: "inactive",
  isPro: false,
});

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({
  children,
  subscription_status,
}: {
  children: ReactNode;
  subscription_status: string | null | undefined;
}) {
  const isPro = isProSubscriber(subscription_status);
  return (
    <SubscriptionContext.Provider value={{ subscription_status: subscription_status ?? "inactive", isPro }}>
      {children}
    </SubscriptionContext.Provider>
  );
}
