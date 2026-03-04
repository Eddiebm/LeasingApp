import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { data: applications, error } = await supabase
      .from("applications")
      .select(`
        id,
        status,
        credit_score,
        income,
        previous_landlord,
        created_at,
        tenants ( first_name, last_name, email, phone ),
        properties ( id, address, city, state, zip, rent )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    const list = (applications ?? []).map((a: Record<string, unknown>) => {
      const tenant = a.tenants as { first_name: string; last_name: string; email: string; phone: string } | null;
      const property = a.properties as { id: string; address: string; city: string; state: string; zip: string; rent: number } | null;
      return {
        id: a.id,
        status: a.status,
        creditScore: a.credit_score,
        income: a.income,
        previousLandlord: a.previous_landlord,
        createdAt: a.created_at,
        tenantName: tenant ? `${tenant.first_name} ${tenant.last_name}` : "",
        tenantEmail: tenant?.email ?? "",
        tenantPhone: tenant?.phone ?? "",
        propertyId: property?.id ?? null,
        propertyAddress: property ? `${property.address}, ${property.city}, ${property.state} ${property.zip}` : "",
        rent: property?.rent ?? null
      };
    });

    return res.status(200).json(list);
  }

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const data = req.body;

  const { data: tenantRow, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      email: data.email,
      dob: data.dob,
      ssn_last4: data.ssnLast4 ?? null
    })
    .select("id")
    .single();

  if (tenantError || !tenantRow) {
    console.error(tenantError);
    return res.status(500).json({ error: tenantError?.message ?? "Failed to create tenant" });
  }

  const incomeNum = data.monthlyIncome ? parseFloat(String(data.monthlyIncome).replace(/[^0-9.]/g, "")) : null;

  const { data: appRow, error: appError } = await supabase
    .from("applications")
    .insert({
      property_id: data.propertyId || null,
      tenant_id: tenantRow.id,
      employment: data.employer ? `${data.employer} – ${data.position || ""}`.trim() : null,
      income: incomeNum,
      previous_landlord: data.previousLandlord || null,
      status: "pending"
    })
    .select("id")
    .single();

  if (appError || !appRow) {
    console.error(appError);
    return res.status(500).json({ error: appError?.message ?? "Failed to create application" });
  }

  try {
    const { runScreening } = await import("../../../lib/runScreening");
    const screenData = await runScreening({
      firstName: data.firstName,
      lastName: data.lastName,
      dob: data.dob
    });
    await supabase
      .from("applications")
      .update({
        credit_score: screenData.credit_score ?? null,
        background_result: { evictions: screenData.evictions, criminal_record: screenData.criminal_record }
      })
      .eq("id", appRow.id);
  } catch (e) {
    console.error("Screening follow-up error", e);
  }

  return res.status(200).json({ success: true, applicationId: appRow.id });
}
