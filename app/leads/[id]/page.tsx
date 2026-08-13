import Link from "next/link";
import { getSupabaseAdmin, getMockLeadById } from "@/lib/supabase";
import { DashboardAutoRefresher } from "@/app/components";
import type { Lead, Call, Qualification, Appointment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getSupabaseAdmin();

  let lead: Lead = getMockLeadById(id);
  let calls: Call[] = [];
  let qualification: Qualification | null = null;
  let appointments: Appointment[] = [];

  try {
    const [l, c, q, a] = await Promise.all([
      db.from("leads").select("*").eq("id", id).maybeSingle(),
      db.from("calls").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      db.from("lead_qualifications").select("*").eq("lead_id", id).maybeSingle(),
      db.from("appointments").select("*").eq("lead_id", id).order("appointment_datetime", { ascending: true })
    ]);

    if (l.data) lead = l.data as Lead;
    calls = (c.data || []) as Call[];
    qualification = q.data as Qualification | null;
    appointments = (a.data || []) as Appointment[];
  } catch (err) {
    console.error("Error fetching lead detail:", err);
  }

  const latestCall = calls[0];
  const field = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

  return (
    <div suppressHydrationWarning>
      <DashboardAutoRefresher />
      <div className="hero" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <Link href="/leads" style={{ textDecoration: "none", color: "#246b48", fontWeight: 700, fontSize: "14px" }}>
            ← Back to Leads
          </Link>
          <h1 style={{ marginTop: "8px" }} suppressHydrationWarning>
            {lead.first_name} {lead.last_name}
          </h1>
          <p className="muted" suppressHydrationWarning>
            📞 {lead.phone} · ✉️ {lead.email || "No email"} · 📍 {lead.property_address || lead.address || "No address"}
          </p>
        </div>
        <Link className="button secondary" href="/">
          Dashboard
        </Link>
      </div>

      <div className="detail" suppressHydrationWarning>
        {/* Qualification Section */}
        <div className="card" suppressHydrationWarning>
          <h2 suppressHydrationWarning>Qualification Details</h2>
          <div className="kvs" suppressHydrationWarning>
            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Status</small>
              <strong suppressHydrationWarning>
                <span className={`badge ${qualification?.qualification_status === "Qualified" ? "completed" : "pending"}`}>
                  {field(qualification?.qualification_status || "Pending")}
                </span>
              </strong>
            </div>
            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Avg Electric Bill</small>
              <strong suppressHydrationWarning>{qualification?.average_electric_bill ? `$${qualification.average_electric_bill}/mo` : "—"}</strong>
            </div>
            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Homeowner</small>
              <strong suppressHydrationWarning>{qualification?.homeowner_confirmed ? "Yes" : qualification?.homeowner_confirmed === false ? "No" : "—"}</strong>
            </div>
            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Home Type</small>
              <strong suppressHydrationWarning>{field(qualification?.home_type)}</strong>
            </div>
            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Electricity Provider</small>
              <strong suppressHydrationWarning>{field(qualification?.electricity_provider)}</strong>
            </div>
            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Credit &gt; 650</small>
              <strong suppressHydrationWarning>{qualification?.credit_above_650 ? "Yes" : qualification?.credit_above_650 === false ? "No" : "—"}</strong>
            </div>
            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Roof Shading</small>
              <strong suppressHydrationWarning>{field(qualification?.roof_shading)}</strong>
            </div>
            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Decision Maker</small>
              <strong suppressHydrationWarning>{qualification?.decision_maker ? "Yes" : qualification?.decision_maker === false ? "No" : "—"}</strong>
            </div>
          </div>
          {qualification?.notes && (
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #e8eee9" }} suppressHydrationWarning>
              <small className="muted" suppressHydrationWarning>Qualification Notes:</small>
              <p style={{ margin: "4px 0 0", fontSize: "14px" }} suppressHydrationWarning>{qualification.notes}</p>
            </div>
          )}
        </div>

        {/* Latest Call Section */}
        <div className="card" suppressHydrationWarning>
          <h2 suppressHydrationWarning>Latest Call Details</h2>
          {latestCall ? (
            <>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px" }} suppressHydrationWarning>
                <span className={`badge ${latestCall.call_status === "completed" ? "completed" : "pending"}`}>
                  {latestCall.call_status}
                </span>
                <strong style={{ fontSize: "15px" }} suppressHydrationWarning>{latestCall.call_outcome || "Outcome N/A"}</strong>
                <span className="muted" style={{ marginLeft: "auto", fontSize: "12px" }} suppressHydrationWarning>
                  {new Date(latestCall.created_at).toLocaleString()}
                </span>
              </div>

              {latestCall.summary && (
                <div style={{ marginBottom: "16px" }} suppressHydrationWarning>
                  <h3 style={{ fontSize: "14px", margin: "0 0 6px", color: "#163b2a" }} suppressHydrationWarning>🤖 AI Call Summary</h3>
                  <div className="alert success" style={{ margin: 0 }} suppressHydrationWarning>
                    {latestCall.summary}
                  </div>
                </div>
              )}

              {latestCall.recording_url ? (
                <div style={{ marginBottom: "18px", background: "#f5f9f6", border: "1px solid #dbe6dd", borderRadius: "14px", padding: "16px" }} suppressHydrationWarning>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <h3 style={{ fontSize: "14px", margin: 0, color: "#163b2a", display: "flex", alignItems: "center", gap: "6px" }} suppressHydrationWarning>
                      <span>🔊</span> Call Audio Recording
                    </h3>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span className="badge completed" style={{ fontSize: "11px" }}>Saved in Supabase</span>
                      <a
                        href={latestCall.recording_url}
                        download={`call-recording-${lead.first_name}-${latestCall.id.slice(0, 8)}.webm`}
                        className="button secondary"
                        style={{ padding: "4px 10px", fontSize: "11px", textDecoration: "none" }}
                      >
                        ⬇ Download
                      </a>
                    </div>
                  </div>
                  <audio controls className="audio-player" style={{ width: "100%", outline: "none", height: "42px" }} src={latestCall.recording_url}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              ) : (
                <div className="alert info" style={{ margin: "0 0 16px" }}>
                  ℹ️ Audio recording processing or saved as transcript.
                </div>
              )}

              {latestCall.transcript && (
                <div suppressHydrationWarning>
                  <h3 style={{ fontSize: "14px", margin: "0 0 6px", color: "#163b2a" }} suppressHydrationWarning>📝 Call Transcript</h3>
                  <div className="transcript" suppressHydrationWarning>{latestCall.transcript}</div>
                </div>
              )}
            </>
          ) : (
            <div className="empty" suppressHydrationWarning>No call activity recorded for this lead yet.</div>
          )}
        </div>
      </div>

      <div className="section-title" suppressHydrationWarning>
        <h2 suppressHydrationWarning>Booked Appointments</h2>
      </div>

      <div className="card" suppressHydrationWarning>
        {appointments.length ? (
          <div className="call-list" suppressHydrationWarning>
            {appointments.map(apt => (
              <div className="call-row" key={apt.id} suppressHydrationWarning>
                <strong suppressHydrationWarning>📅 <span suppressHydrationWarning>{new Date(apt.appointment_datetime).toLocaleString()}</span></strong>
                <span className="muted" suppressHydrationWarning>
                  Status: <span className="badge completed">{apt.status}</span>
                </span>
                {apt.notes && <p style={{ margin: "6px 0 0", fontSize: "14px" }} suppressHydrationWarning>{apt.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" suppressHydrationWarning>No appointment booked for this lead.</div>
        )}
      </div>
    </div>
  );
}
