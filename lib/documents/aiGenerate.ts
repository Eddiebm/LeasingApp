/**
 * AI-generated state-specific legal document text.
 * Uses OpenAI (or Anthropic) to produce lease / eviction notice body text for a given state.
 * Not legal advice; documents should be reviewed by an attorney.
 */

import type { DocumentContext } from "./context";
import { formatCurrency, formatDate } from "./context";

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

function getStateName(code: string): string {
  return US_STATES[code.toUpperCase()] ?? code;
}

function buildFacts(ctx: DocumentContext): string {
  const parts: string[] = [
    `Landlord: ${ctx.landlordName}`,
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    `Rent: ${formatCurrency(ctx.rent)} per month`,
    `Security deposit: ${formatCurrency(ctx.deposit)}`,
    `Move-in date: ${ctx.moveInDate ?? "N/A"}`,
    `Document date: ${formatDate(ctx.date ?? new Date().toISOString().slice(0, 10))}`,
  ];
  if (ctx.amountDue != null) parts.push(`Amount due: ${formatCurrency(ctx.amountDue)}`);
  if (ctx.dueDate) parts.push(`Due date: ${formatDate(ctx.dueDate)}`);
  if (ctx.reason) parts.push(`Reason: ${ctx.reason}`);
  return parts.join("\n");
}

export type AiDocumentType = "lease" | "pay_or_quit" | "eviction_notice" | "notice_of_violation";

const SYSTEM_PROMPT = `You are a legal document assistant. You generate plain-text body content for landlord-tenant documents in the United States. Rules:
- Output ONLY the document body text. No titles, no "Here is the document", no commentary.
- Use the exact facts provided (names, addresses, amounts, dates). Do not invent facts.
- For the given state, include language and disclosures that are typically required or customary for that state. If you are unsure about a state requirement, say so in a short neutral sentence.
- Write in clear, formal English. Use short paragraphs (2-4 sentences). Do not use markdown or bullet points unless listing items.
- This is for informational use only; recommend that the party have an attorney review the document.`;

async function callOpenAI(
  apiKey: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from OpenAI");
  if (data.usage) {
    try {
      const { logAiUsage } = await import("../aiUsageLog");
      logAiUsage("aiGenerate", "gpt-4o-mini", data.usage);
    } catch {
      /* ignore */
    }
  }
  return text;
}

/**
 * Generate state-specific document body text via AI.
 * Returns null if API key missing, state missing, or request fails (caller can fall back to template).
 */
export async function generateAiDocumentBody(
  type: AiDocumentType,
  ctx: DocumentContext,
  options?: { apiKey?: string; openAiApiKey?: string }
): Promise<string | null> {
  const stateCode = ctx.stateCode?.trim().toUpperCase();
  if (!stateCode || stateCode.length !== 2) return null;

  const apiKey = options?.openAiApiKey ?? options?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const stateName = getStateName(stateCode);
  const facts = buildFacts(ctx);

  let userPrompt: string;
  switch (type) {
    case "lease":
      userPrompt = `Generate the body of a residential lease or rental agreement for ${stateName}. Use these facts:\n\n${facts}\n\nInclude typical lease terms (term, rent, deposit, use of premises, maintenance, entry, default, termination) and any disclosures commonly required in ${stateName}. Output only the document body.`;
      break;
    case "pay_or_quit":
      userPrompt = `Generate the body of a "Pay Rent or Quit" notice for ${stateName}. Use these facts:\n\n${facts}\n\nState the amount owed, the number of days to pay or vacate (use the notice period required or customary in ${stateName}), and that failure to pay or vacate may result in eviction. Output only the document body.`;
      break;
    case "eviction_notice":
      userPrompt = `Generate the body of an eviction / termination notice for ${stateName}. Use these facts:\n\n${facts}\n\nState that the tenancy is being terminated, the reason if given, the date by which the tenant must vacate (per ${stateName} law), and that the landlord may pursue an unlawful detainer action. Output only the document body.`;
      break;
    case "notice_of_violation":
      userPrompt = `Generate the body of a "Notice of Violation" or "Cure or Quit" notice for ${stateName}. Use these facts:\n\n${facts}\n\nState the lease violation, that the tenant must cure within a reasonable time (or as required by ${stateName}), and that failure to cure may result in termination. Output only the document body.`;
      break;
    default:
      return null;
  }

  try {
    return await callOpenAI(apiKey, userPrompt);
  } catch (e) {
    console.error("AI document generation failed:", e);
    return null;
  }
}

/** Disclaimer to append when AI was used (for PDF). */
export const AI_DISCLAIMER =
  "This document was generated with AI assistance and is not legal advice. Have an attorney review it before use. Laws vary by state and locality.";
