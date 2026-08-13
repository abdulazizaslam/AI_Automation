import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DashboardAutoRefresher } from "../components";
import type { Lead, Call, Appointment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function LeadsPage() {
  let leads: Lead[] = [];
  let calls: Call[] = [];
  let appointments: Appointment[] = [];

  try {
    const db = getSupabaseAdmin();
    const [l, c, a] = await Promise.all([
      db.from("leads").select("*").order("created_at", { ascending: false }),
      db.from("calls").select("*").order("created_at", { ascending: false }),
      db.from("appointments").select("*").order("appointment_datetime", { ascending: true })
    ]);
    leads = (l.data || []) as Lead[];
    calls = (c.data || []) as Call[];
    appointments = (a.data || []) as Appointment[];
  } catch (err) {
    console.error("Error loading leads:", err);
  }

  const latestCallMap = new Map<string, Call>();
  calls.forEach(call => {
    if (!latestCallMap.has(call.lead_id)) latestCallMap.set(call.lead_id, call);
  });

  const latestAppointmentMap = new Map<string, Appointment>();
  appointments.forEach(apt => {
    if (!latestAppointmentMap.has(apt.lead_id)) latestAppointmentMap.set(apt.lead_id, apt);
  });

  return (
    <div suppressHydrationWarning>
      <DashboardAutoRefresher />

      <div className="hero" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <div className="eyebrow" suppressHydrationWarning>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
            CALL CENTER DATABASE
          </div>
          <h1 suppressHydrationWarning>Leads & Speech Records</h1>
          <p className="muted" suppressHydrationWarning>
            All contacts in your Supabase database, live qualification states, and call activity logs.
          </p>
        </div>
        <Link className="button secondary" href="/" style={{ height: "44px" }}>
          ← Back to Dashboard
        </Link>
      </div>

      <div className="table-wrap" suppressHydrationWarning>
        <table className="table" suppressHydrationWarning>
          <thead suppressHydrationWarning>
            <tr suppressHydrationWarning>
              <th>Contact Name & Property</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Latest Call</th>
              <th>AI Outcome</th>
              <th>Appointment</th>
              <th>Telemetry</th>
            </tr>
          </thead>
          <tbody suppressHydrationWarning>
            {leads.map(lead => {
              const call = latestCallMap.get(lead.id);
              const apt = latestAppointmentMap.get(lead.id);
              return (
                <tr key={lead.id} suppressHydrationWarning>
                  <td suppressHydrationWarning>
                    <strong style={{ color: "#fff" }} suppressHydrationWarning>
                      {lead.first_name} {lead.last_name}
                    </strong>
                    <br />
                    <small style={{ color: "var(--text-muted)", fontSize: "12px" }} suppressHydrationWarning>
                      📍 {lead.property_address || lead.address}
                    </small>
                  </td>
                  <td suppressHydrationWarning style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12.5px" }}>
                    {lead.phone}
                  </td>
                  <td suppressHydrationWarning>
                    <span className="badge completed">{lead.lead_status || "new"}</span>
                  </td>
                  <td suppressHydrationWarning>
                    {call ? (
                      <span className={`badge ${call.call_status === "completed" ? "completed" : "pending"}`}>
                        {call.call_status}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>No Calls</span>
                    )}
                  </td>
                  <td suppressHydrationWarning style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                    {call?.call_outcome || "—"}
                  </td>
                  <td suppressHydrationWarning>
                    {apt ? (
                      <span className="badge completed" suppressHydrationWarning>
                        📅 {new Date(apt.appointment_datetime).toLocaleDateString()}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td suppressHydrationWarning>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="button secondary"
                      style={{ padding: "4px 10px", fontSize: "12px", height: "32px" }}
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!leads.length && <div className="empty" suppressHydrationWarning>No leads found in Supabase.</div>}
      </div>
    </div>
  );
}
