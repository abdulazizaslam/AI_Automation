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
          <Link href="/leads" style={{ textDecoration: "none", color: "var(--accent-emerald)", fontWeight: 700, fontSize: "13px" }}>
            ← Back to All Leads
          </Link>
          <h1 style={{ marginTop: "8px" }} suppressHydrationWarning>
            {lead.first_name} {lead.last_name}
          </h1>
          <p className="muted" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }} suppressHydrationWarning>
            <span>📞 {lead.phone}</span>
            <span>✉️ {lead.email || "No email"}</span>
            <span>📍 {lead.property_address || lead.address || "No address"}</span>
          </p>
        </div>
        <Link className="button secondary" href="/" style={{ height: "44px" }}>
          Dashboard
        </Link>
      </div>

      <div className="detail" suppressHydrationWarning>
        {/* Qualification Section */}
        <div className="card" suppressHydrationWarning>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0 }} suppressHydrationWarning>⚡ Solar Qualification Metrics</h2>
            <span className={`badge ${qualification?.qualification_status === "Qualified" ? "completed" : "pending"}`}>
              {field(qualification?.qualification_status || "Pending")}
            </span>
          </div>

          <div className="kvs" suppressHydrationWarning>
            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Avg Electric Bill</small>
              <strong suppressHydrationWarning style={{ color: "var(--accent-emerald)" }}>
                {qualification?.average_electric_bill ? `$${qualification.average_electric_bill}/mo` : "—"}
              </strong>
            </div>

            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Homeowner Confirmed</small>
              <strong suppressHydrationWarning>
                {qualification?.homeowner_confirmed ? "Yes (Owner)" : qualification?.homeowner_confirmed === false ? "No (Renter)" : "—"}
              </strong>
            </div>

            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Home Structure</small>
              <strong suppressHydrationWarning>{field(qualification?.home_type)}</strong>
            </div>

            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Utility Provider</small>
              <strong suppressHydrationWarning>{field(qualification?.electricity_provider)}</strong>
            </div>

            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Credit Score &gt; 650</small>
              <strong suppressHydrationWarning>
                {qualification?.credit_above_650 ? "Yes" : qualification?.credit_above_650 === false ? "No" : "—"}
              </strong>
            </div>

            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Roof Shading</small>
              <strong suppressHydrationWarning>{field(qualification?.roof_shading)}</strong>
            </div>

            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Decision Maker</small>
              <strong suppressHydrationWarning>
                {qualification?.decision_maker ? "Yes" : qualification?.decision_maker === false ? "No" : "—"}
              </strong>
            </div>

            <div className="kv" suppressHydrationWarning>
              <small suppressHydrationWarning>Database Status</small>
              <strong suppressHydrationWarning>{field(lead.lead_status || "new")}</strong>
            </div>
          </div>

          {qualification?.notes && (
            <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }} suppressHydrationWarning>
              <small className="muted" style={{ textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.06em" }} suppressHydrationWarning>
                Auditor & Qualification Notes:
              </small>
              <p style={{ margin: "6px 0 0", fontSize: "13.5px", color: "var(--text-secondary)" }} suppressHydrationWarning>
                {qualification.notes}
              </p>
            </div>
          )}
        </div>

        {/* Latest Call Section */}
        <div className="card" suppressHydrationWarning>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0 }} suppressHydrationWarning>🎙 Latest Voice Call Activity</h2>
            {latestCall && (
              <span className={`badge ${latestCall.call_status === "completed" ? "completed" : "pending"}`}>
                {latestCall.call_status}
              </span>
            )}
          </div>

          {latestCall ? (
            <>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px" }} suppressHydrationWarning>
                <strong style={{ fontSize: "15px", color: "#fff" }} suppressHydrationWarning>
                  {latestCall.call_outcome || "Outcome N/A"}
                </strong>
                <span className="muted" style={{ marginLeft: "auto", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace" }} suppressHydrationWarning>
                  {new Date(latestCall.created_at).toLocaleString()}
                </span>
              </div>

              {latestCall.summary && (
                <div style={{ marginBottom: "16px" }} suppressHydrationWarning>
                  <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px", color: "var(--accent-emerald)" }} suppressHydrationWarning>
                    🤖 AI Synthesis Summary
                  </h3>
                  <div className="alert success" style={{ margin: 0 }} suppressHydrationWarning>
                    {latestCall.summary}
                  </div>
                </div>
              )}

              {latestCall.recording_url ? (
                <div style={{ marginBottom: "18px", background: "rgba(15, 23, 42, 0.9)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "14px" }} suppressHydrationWarning>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <h3 style={{ fontSize: "13px", margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }} suppressHydrationWarning>
                      <span>🔊</span> Audio Stream Recording
                    </h3>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span className="badge completed" style={{ fontSize: "10px" }}>Supabase Stored</span>
                      <a
                        href={latestCall.recording_url}
                        download={`call-recording-${lead.first_name}-${latestCall.id.slice(0, 8)}.webm`}
                        className="button secondary"
                        style={{ padding: "2px 8px", fontSize: "11px", height: "26px", textDecoration: "none" }}
                      >
                        ⬇ Download
                      </a>
                    </div>
                  </div>
                  <audio controls className="audio-player" style={{ width: "100%", outline: "none", height: "38px" }} src={latestCall.recording_url}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              ) : (
                <div className="alert info" style={{ margin: "0 0 16px" }}>
                  ℹ️ Audio recording saved as transcript below.
                </div>
              )}

              {latestCall.transcript && (
                <div suppressHydrationWarning>
                  <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px", color: "var(--text-muted)" }} suppressHydrationWarning>
                    📝 Speech-To-Text Call Transcript
                  </h3>
                  <div className="transcript" suppressHydrationWarning>{latestCall.transcript}</div>
                </div>
              )}
            </>
          ) : (
            <div className="empty" suppressHydrationWarning>No call activity recorded for this lead yet.</div>
          )}
        </div>
      </div>

      <div className="section-title" suppressHydrationWarning style={{ marginTop: "32px" }}>
        <h2 suppressHydrationWarning>
          <span>📅</span> Booked Consultations for {lead.first_name}
        </h2>
      </div>

      <div className="card" suppressHydrationWarning>
        {appointments.length ? (
          <div className="call-list" suppressHydrationWarning>
            {appointments.map(apt => (
              <div className="call-row" key={apt.id} suppressHydrationWarning>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontFamily: "'JetBrains Mono', monospace" }} suppressHydrationWarning>
                    📅 {new Date(apt.appointment_datetime).toLocaleString()}
                  </strong>
                  <span className="badge completed">{apt.status}</span>
                </div>
                {apt.notes && (
                  <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--text-secondary)" }} suppressHydrationWarning>
                    {apt.notes}
                  </p>
                )}
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
