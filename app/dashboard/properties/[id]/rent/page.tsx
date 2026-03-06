"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";

type Property = { id: string; address: string; city: string; state: string; zip: string; rent?: number };
type Application = { id: string; tenantId: string | null; tenantName: string; tenantEmail: string; status: string };
type Schedule = {
  id: string;
  propertyId: string;
  amountCents: number;
  currency: string;
  dueDayOfMonth: number;
  lateFeeCents: number;
  lateFeeGraceDays: number;
  tenantId: string | null;
  applicationId: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  payments?: { id: string; amountCents: number; status: string; dueDate: string | null; paidAt: string | null; periodStart: string | null; periodEnd: string | null }[];
};

export default function PropertyRentPage() {
  const params = useParams();
  const propertyId = typeof params.id === "string" ? params.id : "";
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState(1);
  const [lateFee, setLateFee] = useState(50);
  const [graceDays, setGraceDays] = useState(5);
  const [currency, setCurrency] = useState("usd");
  const [tenantName, setTenantName] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s ?? null));
  }, []);

  useEffect(() => {
    if (!session?.access_token || !propertyId) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };
    fetch("/api/properties?for=dashboard", { headers })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const p = list.find((x: Property) => x.id === propertyId);
        setProperty(p ?? null);
      })
      .catch(() => setProperty(null));
  }, [session?.access_token, propertyId]);

  useEffect(() => {
    if (!session?.access_token || !propertyId) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };
    fetch(`/api/rent-schedules?propertyId=${encodeURIComponent(propertyId)}`, { headers })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setSchedules(list);
        const first = list[0];
        if (first) {
          setSchedule(first);
          setAmount(String((first.amountCents ?? 0) / 100));
          setDueDay(first.dueDayOfMonth ?? 1);
          setLateFee((first.lateFeeCents ?? 5000) / 100);
          setGraceDays(first.lateFeeGraceDays ?? 5);
          setCurrency(first.currency ?? "usd");
          setTenantName(first.tenantName ?? "");
          setSelectedApplicationId(first.applicationId ?? "");
        }
      })
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, [session?.access_token, propertyId]);

  useEffect(() => {
    if (!session?.access_token || !propertyId) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };
    fetch(`/api/applications?propertyId=${encodeURIComponent(propertyId)}`, { headers })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setApplications(
          list
            .filter((a: { tenantId?: string | null }) => a.tenantId)
            .map((a: { id: string; tenantId: string | null; tenantName: string; tenantEmail: string; status: string }) => ({
              id: a.id,
              tenantId: a.tenantId,
              tenantName: a.tenantName,
              tenantEmail: a.tenantEmail,
              status: a.status
            }))
        );
      })
      .catch(() => setApplications([]));
  }, [session?.access_token, propertyId]);

  useEffect(() => {
    if (!schedule?.id || !session?.access_token) return;
    fetch(`/api/rent-schedules/${schedule.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.payments) setSchedule((s) => (s ? { ...s, payments: data.payments } : null));
      })
      .catch(() => {});
  }, [schedule?.id, session?.access_token]);

  const propertyAddress = property
    ? `${property.address}, ${property.city}, ${property.state} ${property.zip}`
    : "";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !propertyId) return;
    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(amount || "0") * 100);
      const lateFeeCents = Math.round(lateFee * 100);
      if (schedule?.id) {
        const selectedApp = applications.find((a) => a.id === selectedApplicationId);
        const res = await fetch(`/api/rent-schedules/${schedule.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amountCents,
            dueDayOfMonth: dueDay,
            lateFeeCents,
            lateFeeGraceDays: graceDays,
            currency,
            tenantId: selectedApp?.tenantId ?? null,
            applicationId: selectedApp?.id ?? null
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to update");
        const updated = await res.json();
        setSchedule(updated);
      } else {
        const selectedApp = applications.find((a) => a.id === selectedApplicationId);
        const res = await fetch("/api/rent-schedules", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            propertyId,
            amountCents,
            dueDayOfMonth: dueDay,
            lateFeeCents,
            lateFeeGraceDays: graceDays,
            currency,
            tenantId: selectedApp?.tenantId ?? null,
            applicationId: selectedApp?.id ?? null
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to create");
        const created = await res.json();
        const selectedApp = applications.find((a) => a.id === selectedApplicationId);
        const newSchedule: Schedule = {
          id: created.id,
          propertyId,
          amountCents: Math.round(parseFloat(amount || "0") * 100),
          currency,
          dueDayOfMonth: dueDay,
          lateFeeCents: Math.round(lateFee * 100),
          lateFeeGraceDays: graceDays,
          tenantId: selectedApp?.tenantId ?? null,
          applicationId: selectedApp?.id ?? null,
          tenantName: selectedApp?.tenantName ?? null,
          tenantEmail: selectedApp?.tenantEmail ?? null,
          payments: []
        };
        setSchedules((s) => [newSchedule, ...s]);
        setSchedule(newSchedule);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPayment = async () => {
    if (!schedule?.id || !session?.access_token) return;
    setRequesting(true);
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const res = await fetch("/api/rent-payments/request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rentScheduleId: schedule.id,
          periodStart,
          periodEnd,
          includeLateFee: false
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send request");
      alert("Payment request sent to tenant.");
      setSchedule((s) => (s ? { ...s, payments: [] } : null));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to request payment");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (!property) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <p className="text-slate-600">Property not found.</p>
        <Link href="/dashboard" className="text-sm text-blue-600 underline">Back to dashboard</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rent &amp; payments</h1>
          <p className="text-sm text-slate-600">{propertyAddress}</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to dashboard
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Rent schedule</h2>
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Monthly rent</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Due day of month</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={dueDay}
              onChange={(e) => setDueDay(Number(e.target.value))}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Late fee ($)</label>
            <input
              type="number"
              min="0"
              step="1"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={lateFee}
              onChange={(e) => setLateFee(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Late fee grace days</label>
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={graceDays}
              onChange={(e) => setGraceDays(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Currency</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="usd">USD</option>
              <option value="gbp">GBP</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Tenant</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={selectedApplicationId}
              onChange={(e) => setSelectedApplicationId(e.target.value)}
            >
              <option value="">Not assigned</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.tenantName} {app.tenantEmail ? `(${app.tenantEmail})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save rent schedule"}
          </button>
        </form>
      </section>

      {schedule?.id && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Payment history</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pr-4">Period</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Date paid</th>
                  </tr>
                </thead>
                <tbody>
                  {(schedule.payments ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-slate-500">
                        No payments yet.
                      </td>
                    </tr>
                  )}
                  {(schedule.payments ?? []).map((pay) => (
                    <tr key={pay.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">
                        {pay.periodStart && pay.periodEnd
                          ? new Date(pay.periodStart).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                          : pay.dueDate
                            ? new Date(pay.dueDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                            : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        ${((pay.amountCents ?? 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            pay.status === "succeeded"
                              ? "text-emerald-600"
                              : pay.status === "failed"
                                ? "text-red-600"
                                : "text-amber-600"
                          }
                        >
                          {pay.status === "succeeded" ? "✓ Paid" : pay.status === "failed" ? "Failed" : pay.status}
                        </span>
                      </td>
                      <td className="py-2">
                        {pay.paidAt ? new Date(pay.paidAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={handleRequestPayment}
              disabled={requesting || !schedule.tenantEmail}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {requesting ? "Sending…" : "Request payment"}
            </button>
            {!schedule.tenantEmail && (
              <p className="mt-2 text-xs text-slate-500">Assign a tenant to the schedule to request payment.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
