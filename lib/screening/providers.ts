export type Jurisdiction = "us" | "uk";

export type ScreeningContext = {
  tenantId: string;
  jurisdiction: Jurisdiction;
  tenantData: {
    firstName: string;
    lastName: string;
    dob: string;
    ssnLast4?: string;
    nationalId?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateOrRegion?: string;
    postalCode?: string;
    country?: string;
    email?: string;
    phone?: string;
    monthlyIncome?: number;
    employerName?: string;
    employmentStatus?: string;
    previousLandlordName?: string;
    previousLandlordEmail?: string;
  };
};

export type ScreeningSummary = {
  provider: "transunion_smartmove" | "rentprep" | "checkr" | "openrent" | "rentprofile" | "mock";
  jurisdiction: Jurisdiction;
  creditScore: number | null;
  riskLevel: "low" | "medium" | "high";
  incomeVerified: boolean | null;
  identityVerified: boolean | null;
  evictionHistory: string;
  criminalRecords: string;
  rightToRent: "verified" | "not_verified" | "not_applicable" | null;
  landlordReference: string | null;
};

export type StartScreeningResult = {
  providerRequestId: string | null;
};

export interface ScreeningProvider {
  startScreening(ctx: ScreeningContext, screeningId: string): Promise<StartScreeningResult>;
  fetchResult(providerRequestId: string): Promise<ScreeningSummary>;
}

function mockSummary(ctx: ScreeningContext): ScreeningSummary {
  return {
    provider: "mock",
    jurisdiction: ctx.jurisdiction,
    creditScore: 682,
    riskLevel: "low",
    incomeVerified: null,
    identityVerified: true,
    evictionHistory: "None",
    criminalRecords: "None",
    rightToRent: ctx.jurisdiction === "uk" ? "verified" : "not_applicable",
    landlordReference: null
  };
}

export class MockScreeningProvider implements ScreeningProvider {
  async startScreening(_ctx: ScreeningContext, _screeningId: string): Promise<StartScreeningResult> {
    // No async start needed for mock; everything is synchronous in fetchResult.
    return { providerRequestId: null };
  }

  async fetchResult(ctxOrId: ScreeningContext | string): Promise<ScreeningSummary> {
    // Allow calling with either a context (preferred) or an ID (for symmetry with real providers).
    if (typeof ctxOrId === "string") {
      return mockSummary({ jurisdiction: "us", tenantId: ctxOrId, tenantData: { firstName: "", lastName: "", dob: "" } });
    }
    return mockSummary(ctxOrId);
  }
}

export function selectProvider(jurisdiction: Jurisdiction): ScreeningProvider {
  // For now, always return mock. Manus can replace this with real providers:
  // - US: TransUnion SmartMove / Checkr / RentPrep
  // - UK: OpenRent / RentProfile
  return new MockScreeningProvider();
}

