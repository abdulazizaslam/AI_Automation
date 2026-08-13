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
          <div className="eyebrow" suppressHydrationWarning>Backend Lead Management</div>
          <h1 suppressHydrationWarning>Leads & Calls</h1>
          <p className="muted" suppressHydrationWarning>All test leads from Supabase and their latest voice agent status.</p>
        </div>
        <Link className="button secondary" href="/">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="card table-wrap" suppressHydrationWarning>
        <table className="table" suppressHydrationWarning>
          <thead suppressHydrationWarning>
            <tr suppressHydrationWarning>
              <th>Lead Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Last Call</th>
              <th>Result</th>
              <th>Appointment</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody suppressHydrationWarning>
            {leads.map(lead => {
              const call = latestCallMap.get(lead.id);
              const apt = latestAppointmentMap.get(lead.id);
              return (
                <tr key={lead.id} suppressHydrationWarning>
                  <td suppressHydrationWarning>
                    <strong suppressHydrationWarning>
                      {lead.first_name} {lead.last_name}
                    </strong>
                    <br />
                    <small className="muted" suppressHydrationWarning>{lead.property_address || lead.address}</small>
                  </td>
                  <td suppressHydrationWarning>{lead.phone}</td>
                  <td suppressHydrationWarning>
                    <span className="badge completed">{lead.lead_status || "new"}</span>
                  </td>
                  <td suppressHydrationWarning>
                    {call ? (
                      <span className={`badge ${call.call_status === "completed" ? "completed" : "pending"}`}>
                        {call.call_status}
                      </span>
                    ) : (
                      <span className="muted">No Calls</span>
                    )}
                  </td>
                  <td suppressHydrationWarning>{call?.call_outcome || "—"}</td>
                  <td suppressHydrationWarning>
                    {apt ? (
                      <span className="badge completed" suppressHydrationWarning>
                        {new Date(apt.appointment_datetime).toLocaleDateString()}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td suppressHydrationWarning>
                    <Link href={`/leads/${lead.id}`} className="button secondary" style={{ padding: "6px 12px", fontSize: "12px" }}>
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!leads.length && <div className="empty" suppressHydrationWarning>No leads found.</div>}
      </div>
    </div>
  );
}
