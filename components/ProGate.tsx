"use client";

import { type ReactNode, useState } from "react";
import { useSubscription } from "./SubscriptionContext";
import { UpgradePrompt } from "./UpgradePrompt";

type ProGateProps = {
  children: ReactNode;
  feature: string;
};

export function ProGate({ children, feature }: ProGateProps) {
  const { isPro } = useSubscription();
  const [showPrompt, setShowPrompt] = useState(false);

  if (isPro) return <>{children}</>;
  if (showPrompt) return <UpgradePrompt feature={feature} onClose={() => setShowPrompt(false)} />;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <p className="text-sm font-medium text-amber-900">{feature}</p>
      <p className="mt-1 text-sm text-amber-800">This feature requires a Pro subscription.</p>
      <button
        type="button"
        onClick={() => setShowPrompt(true)}
        className="mt-4 rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-700"
      >
        See Pro benefits
      </button>
    </div>
  );
}
