import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { StartCallButton } from "./components";
import type { Call, Appointment, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    <>
      <div className="hero">
        <div>
          <div className="eyebrow">Solar Automation Pipeline</div>
          <h1>Solar Voice Agent</h1>
          <p className="muted">
            Launch AI-driven solar sales consultations, qualify homeowners, and book appointments automatically.
          </p>
        </div>
        <div className="actions">
          <StartCallButton />
          <Link className="button secondary" href="/leads">
            View Leads & Calls →
          </Link>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="grid">
        <div className="card">
          <div className="muted">Test Leads</div>
          <div className="stat">{leads.length}</div>
        </div>
        <div className="card">
          <div className="muted">Recent Calls</div>
          <div className="stat">{calls.length}</div>
        </div>
        <div className="card">
          <div className="muted">Booked Appointments</div>
          <div className="stat">{appointments.length}</div>
        </div>
      </div>

      <div className="section-title">
        <h2>Recent Activity & Calls</h2>
        <Link href="/leads">View all leads & calls →</Link>
      </div>

      <div className="card table-wrap">
        {calls.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Lead Name</th>
                <th>Status</th>
                <th>Outcome</th>
                <th>Booked</th>
                <th>Date & Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(call => (
                <tr key={call.id}>
                  <td>
                    <Link href={`/leads/${call.lead_id}`}>
                      {names.get(call.lead_id) || "Test Lead"}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${call.call_status === "completed" ? "completed" : "pending"}`}>
                      {call.call_status}
                    </span>
                  </td>
                  <td>{call.call_outcome || "—"}</td>
                  <td>
                    {call.appointment_booked ? (
                      <span className="badge completed">Confirmed</span>
                    ) : (
                      <span className="badge pending">No Appointment</span>
                    )}
                  </td>
                  <td>{new Date(call.created_at).toLocaleString()}</td>
                  <td>
                    <Link href={`/leads/${call.lead_id}`}>View details →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            No calls placed yet. Click <strong>Start AI Call</strong> above to test a live call with a random Supabase lead!
          </div>
        )}
      </div>

      <div className="section-title">
        <h2>Upcoming Appointments</h2>
      </div>

      <div className="card">
        {appointments.length ? (
          <div className="call-list">
            {appointments.map(a => (
              <div className="call-row" key={a.id}>
                <strong>{names.get(a.lead_id) || "Lead Consultation"}</strong>
                <span className="muted">
                  📅 {new Date(a.appointment_datetime).toLocaleString()} · Status: <span className="badge completed">{a.status}</span>
                </span>
                {a.notes && <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#4f5e55" }}>{a.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No appointments booked yet.</div>
        )}
      </div>
    </>
  );
}
