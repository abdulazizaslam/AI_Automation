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
      db.from("calls").select("*").order("created_at", { ascending: false }).limit(8),
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

      {/* Telemetry Hero Command Banner */}
      <div className="hero" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <div className="eyebrow" suppressHydrationWarning>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
            AUTONOMOUS CALL CENTER OPERATING SYSTEM
          </div>
          <h1 suppressHydrationWarning>Solar AI Voice Agent</h1>
          <p className="muted" suppressHydrationWarning>
            Autonomous conversational agent qualifying leads against SGIP guidelines & booking engineer consultations.
          </p>
        </div>

        <div className="actions" suppressHydrationWarning>
          <StartCallButton />
          <Link
            className="button secondary"
            href="/leads"
            style={{
              height: "44px",
              padding: "0 18px",
              display: "inline-flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              textDecoration: "none",
              boxSizing: "border-box"
            }}
          >
            View Leads & Calls →
          </Link>
          <ResetDatabaseButton />
        </div>
      </div>

      {error && <div className="alert failed" suppressHydrationWarning>{error}</div>}

      {/* High-Tech Stat Cards */}
      <div className="grid" suppressHydrationWarning>
        <div className="card" suppressHydrationWarning>
          <div className="card-top" suppressHydrationWarning>
            <span className="muted" style={{ fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }} suppressHydrationWarning>
              Target Leads in Pipeline
            </span>
            <div className="stat-icon stat-leads" suppressHydrationWarning>👥</div>
          </div>
          <div className="stat" suppressHydrationWarning>{leads.length}</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }} suppressHydrationWarning>
            Active database records
          </div>
        </div>

        <div className="card" suppressHydrationWarning>
          <div className="card-top" suppressHydrationWarning>
            <span className="muted" style={{ fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }} suppressHydrationWarning>
              Realtime Calls Placed
            </span>
            <div className="stat-icon stat-calls" suppressHydrationWarning>📞</div>
          </div>
          <div className="stat" style={{ color: "var(--accent-emerald)" }} suppressHydrationWarning>{calls.length}</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }} suppressHydrationWarning>
            Recorded speech sessions
          </div>
        </div>

        <div className="card" suppressHydrationWarning>
          <div className="card-top" suppressHydrationWarning>
            <span className="muted" style={{ fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }} suppressHydrationWarning>
              Booked Engineer Visits
            </span>
            <div className="stat-icon stat-apts" suppressHydrationWarning>📅</div>
          </div>
          <div className="stat" style={{ color: "var(--accent-amber)" }} suppressHydrationWarning>{appointments.length}</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }} suppressHydrationWarning>
            Locked consultations
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="section-title" suppressHydrationWarning>
        <h2 suppressHydrationWarning>
          <span>🎙</span> Realtime Telemetry & Call Logs
        </h2>
        <Link href="/leads">Full Database View →</Link>
      </div>

      <div className="table-wrap" suppressHydrationWarning>
        {calls.length ? (
          <table className="table" suppressHydrationWarning>
            <thead suppressHydrationWarning>
              <tr suppressHydrationWarning>
                <th>Lead Contact</th>
                <th>Call Status</th>
                <th>AI Disposition</th>
                <th>Audio Stream</th>
                <th>Appointment</th>
                <th>Timestamp</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody suppressHydrationWarning>
              {calls.map(call => (
                <tr key={call.id} suppressHydrationWarning>
                  <td suppressHydrationWarning>
                    <Link href={`/leads/${call.lead_id}`} style={{ fontWeight: 700 }}>
                      {names.get(call.lead_id) || "Direct Lead"}
                    </Link>
                  </td>
                  <td suppressHydrationWarning>
                    <span className={`badge ${call.call_status === "completed" ? "completed" : "pending"}`}>
                      {call.call_status}
                    </span>
                  </td>
                  <td suppressHydrationWarning style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                    {call.call_outcome || "—"}
                  </td>
                  <td suppressHydrationWarning>
                    {call.recording_url ? (
                      <Link href={`/leads/${call.lead_id}`} style={{ textDecoration: "none" }}>
                        <span className="badge completed" style={{ fontSize: "11px", cursor: "pointer" }}>
                          🔊 Play Audio
                        </span>
                      </Link>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>
                    )}
                  </td>
                  <td suppressHydrationWarning>
                    {call.appointment_booked ? (
                      <span className="badge completed">Confirmed</span>
                    ) : (
                      <span className="badge pending">No Appointment</span>
                    )}
                  </td>
                  <td suppressHydrationWarning style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                    {new Date(call.created_at).toISOString().slice(11, 16)} · {new Date(call.created_at).toISOString().slice(0, 10)}
                  </td>
                  <td suppressHydrationWarning>
                    <Link href={`/leads/${call.lead_id}`} className="button secondary" style={{ padding: "4px 10px", fontSize: "12px", height: "32px" }}>
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty" suppressHydrationWarning>
            No calls placed yet. Click <strong>Start Real-Time Voice Call</strong> to initiate an autonomous consultation.
          </div>
        )}
      </div>

      {/* Upcoming Appointments */}
      <div className="section-title" suppressHydrationWarning style={{ marginTop: "36px" }}>
        <h2 suppressHydrationWarning>
          <span>📅</span> Confirmed Field Engineer Consultations
        </h2>
      </div>

      <div className="card" suppressHydrationWarning>
        {appointments.length ? (
          <div className="call-list" suppressHydrationWarning>
            {appointments.map(a => (
              <div className="call-row" key={a.id} suppressHydrationWarning>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <strong style={{ fontSize: "15px" }} suppressHydrationWarning>
                    {names.get(a.lead_id) || "Homeowner Consultation"}
                  </strong>
                  <span className="badge completed">{a.status}</span>
                </div>
                <div className="muted" style={{ fontSize: "13px", fontFamily: "'JetBrains Mono', monospace" }} suppressHydrationWarning>
                  📅 <span suppressHydrationWarning>{new Date(a.appointment_datetime).toISOString().replace('T', ' ').slice(0, 16)} UTC</span>
                </div>
                {a.notes && (
                  <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }} suppressHydrationWarning>
                    {a.notes}
                  </p>
                )}
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
