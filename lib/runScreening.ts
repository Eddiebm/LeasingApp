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

export async function runScreening(input: ScreeningInput): Promise<ScreeningResult> {
  // TODO: Replace with real Checkr / RentPrep API call using process.env.CHECKR_API_KEY etc.
  console.log("Screening payload", input);
  return {
    credit_score: 682,
    evictions: "None",
    criminal_record: "None"
  };
}
