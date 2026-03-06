export type SubscriptionStatus = "active" | "trialing" | "inactive" | "canceled" | "past_due";

export function isProSubscriber(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export const FREE_PROPERTY_LIMIT = 1;
