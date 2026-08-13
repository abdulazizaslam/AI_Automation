import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { StartCallButton, ResetDatabaseButton, DashboardAutoRefresher } from "./components";
import type { Call, Appointment, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function Dashboard() {
  let leads: Lead[] = [];
  let calls: Call[] = [];
  let appointments: Appointment[] = [];
  let error = "";

  try {
    const db = getSupabaseAdmin();
    const [l, c, a] = await Promise.all([
      db.from("leads").select("*").order("created_at", { ascending: false }),
      db.from("calls").select("*").order("created_at", { ascending: false }).limit(6),
      db.from("appointments").select("*").order("appointment_datetime", { ascending: true }).limit(6)
    ]);
    leads = (l.data || []) as Lead[];
    calls = (c.data || []) as Call[];
    appointments = (a.data || []) as Appointment[];
  } catch (e) {
    error = e instanceof Error ? e.message : "Database error";
  }

  const names = new Map(leads.map(lead => [lead.id, `${lead.first_name} ${lead.last_name}`]));

  return (
    <div suppressHydrationWarning>
      <DashboardAutoRefresher />
      <div className="hero" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <div className="eyebrow" suppressHydrationWarning>Solar Automation Pipeline</div>
          <h1 suppressHydrationWarning>Solar Voice Agent</h1>
          <p className="muted" suppressHydrationWarning>
            Launch AI-driven solar sales consultations, qualify homeowners, and book appointments automatically.
          </p>
        </div>
        <div className="actions" suppressHydrationWarning style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          <StartCallButton />
          <Link className="button secondary" href="/leads">
            View Leads & Calls →
          </Link>
          <ResetDatabaseButton />
        </div>
      </div>

      {error && <div className="alert" suppressHydrationWarning>{error}</div>}

      <div className="grid" suppressHydrationWarning>
        <div className="card" suppressHydrationWarning>
          <div className="muted" suppressHydrationWarning>Test Leads</div>
          <div className="stat" suppressHydrationWarning>{leads.length}</div>
        </div>
        <div className="card" suppressHydrationWarning>
          <div className="muted" suppressHydrationWarning>Recent Calls</div>
          <div className="stat" suppressHydrationWarning>{calls.length}</div>
        </div>
        <div className="card" suppressHydrationWarning>
          <div className="muted" suppressHydrationWarning>Booked Appointments</div>
          <div className="stat" suppressHydrationWarning>{appointments.length}</div>
        </div>
      </div>

      <div className="section-title" suppressHydrationWarning>
        <h2 suppressHydrationWarning>Recent Activity & Calls</h2>
        <Link href="/leads">View all leads & calls →</Link>
      </div>

      <div className="card table-wrap" suppressHydrationWarning>
        {calls.length ? (
          <table className="table" suppressHydrationWarning>
            <thead suppressHydrationWarning>
              <tr suppressHydrationWarning>
                <th>Lead Name</th>
                <th>Status</th>
                <th>Outcome</th>
                <th>Audio</th>
                <th>Booked</th>
                <th>Date & Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody suppressHydrationWarning>
              {calls.map(call => (
                <tr key={call.id} suppressHydrationWarning>
                  <td suppressHydrationWarning>
                    <Link href={`/leads/${call.lead_id}`}>
                      {names.get(call.lead_id) || "Test Lead"}
                    </Link>
                  </td>
                  <td suppressHydrationWarning>
                    <span className={`badge ${call.call_status === "completed" ? "completed" : "pending"}`}>
                      {call.call_status}
                    </span>
                  </td>
                  <td suppressHydrationWarning>{call.call_outcome || "—"}</td>
                  <td suppressHydrationWarning>
                    {call.recording_url ? (
                      <Link href={`/leads/${call.lead_id}`} style={{ textDecoration: "none" }}>
                        <span className="badge completed" style={{ fontSize: "11px", cursor: "pointer" }}>
                          🔊 Play Audio
                        </span>
                      </Link>
                    ) : (
                      <span className="muted" style={{ fontSize: "12px" }}>—</span>
                    )}
                  </td>
                  <td suppressHydrationWarning>
                    {call.appointment_booked ? (
                      <span className="badge completed">Confirmed</span>
                    ) : (
                      <span className="badge pending">No Appointment</span>
                    )}
                  </td>
                  <td suppressHydrationWarning>{new Date(call.created_at).toLocaleString()}</td>
                  <td suppressHydrationWarning>
                    <Link href={`/leads/${call.lead_id}`} className="button secondary" style={{ padding: "6px 12px", fontSize: "12px" }}>
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty" suppressHydrationWarning>
            No calls placed yet. Click <strong>Start AI Call</strong> above to test a live call with a random Supabase lead!
          </div>
        )}
      </div>

      <div className="section-title" suppressHydrationWarning>
        <h2 suppressHydrationWarning>Upcoming Appointments</h2>
      </div>

      <div className="card" suppressHydrationWarning>
        {appointments.length ? (
          <div className="call-list" suppressHydrationWarning>
            {appointments.map(a => (
              <div className="call-row" key={a.id} suppressHydrationWarning>
                <strong suppressHydrationWarning>{names.get(a.lead_id) || "Lead Consultation"}</strong>
                <span className="muted" suppressHydrationWarning>
                  📅 <span suppressHydrationWarning>{new Date(a.appointment_datetime).toLocaleString()}</span> · Status: <span className="badge completed">{a.status}</span>
                </span>
                {a.notes && <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#4f5e55" }} suppressHydrationWarning>{a.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" suppressHydrationWarning>No appointments booked yet.</div>
        )}
      </div>
    </div>
  );
}
