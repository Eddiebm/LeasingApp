type ScreeningInput = {
  firstName: string;
  lastName: string;
  dob: string;
};

export type ScreeningResult = {
  credit_score: number | null;
  evictions: string;
  criminal_record: string;
};

/** Mock result when no real provider is configured or as fallback. */
function mockResult(): ScreeningResult {
  return {
    credit_score: 682,
    evictions: "None",
    criminal_record: "None"
  };
}

/**
 * Real screening: call Checkr or RentPrep when API keys are set.
 * FCRA: ensure disclosure + consent before screening, and adverse-action flow when denying. See docs/SCREENING.md.
 */
async function realScreening(_input: ScreeningInput): Promise<ScreeningResult> {
  // RentPrep: POST to their tenant screening endpoint with applicant info; map response to ScreeningResult.
  // Checkr: create candidate + invitation or use their tenant product; map report to ScreeningResult.
  if (process.env.RENTPREP_API_KEY) {
    // TODO: https://www.rentprep.com/ – e.g. POST applicant, get report ID, poll or webhook for result
    console.log("RentPrep key set; real API call not yet implemented");
  }
  if (process.env.CHECKR_API_KEY) {
    // TODO: Checkr candidate/invitation or tenant screening flow; map report to ScreeningResult
    console.log("Checkr key set; real API call not yet implemented");
  }
  return mockResult();
}

export async function runScreening(input: ScreeningInput): Promise<ScreeningResult> {
  if (process.env.RENTPREP_API_KEY || process.env.CHECKR_API_KEY) {
    return realScreening(input);
  }
  console.log("Screening payload (mock)", input);
  return mockResult();
}
