# Tenant screening

## Current behavior

- **Mock (default):** `lib/runScreening.ts` returns placeholder credit score and “None” for evictions/criminal when no provider keys are set.
- **Real screening:** Set `RENTPREP_API_KEY` or `CHECKR_API_KEY` in ENV. The code path in `runScreening` can then call the provider’s API. Until that integration is implemented, the same mock result is returned.

## FCRA and compliance

Before using screening results for approval/denial you must:

1. **Disclosure & consent** – Get a clear, standalone disclosure that a consumer report may be obtained, and written consent (e.g. on the application or a separate step).
2. **Adverse action** – If you deny or take other adverse action based in whole or in part on the report, you must:
   - Send an adverse action notice (oral, written, or electronic as allowed).
   - Include the name/contact of the CRA that supplied the report and a statement that the CRA did not make the decision.
   - Inform the applicant of their right to obtain a free copy of the report and to dispute accuracy with the CRA.
3. **Use a licensed CRA** – RentPrep and similar tenant-screening services are CRAs; use their official APIs and follow their disclosure/consent requirements.

See [FTC FCRA summary](https://www.ftc.gov/legal-library/browse/statutes/fair-credit-reporting-act) and your provider’s docs (e.g. [RentPrep](https://www.rentprep.com/), [Checkr](https://docs.checkr.com/)) for exact flows.

## Wiring a real provider

- **RentPrep:** Typically provides a REST API for tenant credit/eviction/criminal; add a `realScreening` implementation that POSTs applicant info and maps the response to `ScreeningResult`.
- **Checkr:** Often uses a candidate + invitation flow; the applicant completes checks in Checkr’s flow and you receive results via webhook or polling. Map the final report to `ScreeningResult` and ensure disclosures/consent are shown in the apply flow before creating the check.

Keep consent and “screening may be used for approval/denial” language in the application flow and in any provider-hosted steps.
