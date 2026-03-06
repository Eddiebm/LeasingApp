import { selectProvider, type ScreeningSummary } from "./screening/providers";

export type ScreeningInput = {
  firstName: string;
  lastName: string;
  dob: string;
};

export type ScreeningResult = {
  credit_score: number | null;
  evictions: string;
  criminal_record: string;
};

export async function runScreening(input: ScreeningInput): Promise<ScreeningResult> {
  // For now, always use the mock provider through the abstraction layer.
  // Manus can extend this to pass full tenant context + jurisdiction and select
  // real US/UK providers based on configuration.
  const provider = selectProvider("us");
  const summary: ScreeningSummary = await provider.fetchResult({
    tenantId: "unknown",
    jurisdiction: "us",
    tenantData: {
      firstName: input.firstName,
      lastName: input.lastName,
      dob: input.dob
    }
  });

  return {
    credit_score: summary.creditScore,
    evictions: summary.evictionHistory,
    criminal_record: summary.criminalRecords
  };
}

