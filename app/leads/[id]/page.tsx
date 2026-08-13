import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Lead, Call, Qualification, Appointment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getSupabaseAdmin();

  const [l, c, q, a] = await Promise.all([
    db.from("leads").select("*").eq("id", id).maybeSingle(),
    db.from("calls").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    db.from("lead_qualifications").select("*").eq("lead_id", id).maybeSingle(),
    db.from("appointments").select("*").eq("lead_id", id).order("appointment_datetime", { ascending: true })
  ]);

  if (!l.data) notFound();

  const lead = l.data as Lead;
  const calls = (c.data || []) as Call[];
  const qualification = q.data as Qualification | null;
  const appointments = (a.data || []) as Appointment[];
  const latestCall = calls[0];

  const field = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

  return (
    <>
      <div className="hero">
        <div>
          <Link href="/leads" style={{ textDecoration: "none", color: "#246b48", fontWeight: 700, fontSize: "14px" }}>
            ← Back to Leads
          </Link>
          <h1 style={{ marginTop: "8px" }}>
            {lead.first_name} {lead.last_name}
          </h1>
          <p className="muted">
            📞 {lead.phone} · ✉️ {lead.email || "No email"} · 📍 {lead.property_address || lead.address || "No address"}
          </p>
        </div>
        <Link className="button secondary" href="/">
          Dashboard
        </Link>
      </div>

      <div className="detail">
        {/* Qualification Section */}
        <div className="card">
          <h2>Qualification Details</h2>
          <div className="kvs">
            <div className="kv">
              <small>Status</small>
              <strong>
                <span className={`badge ${qualification?.qualification_status === "Qualified" ? "completed" : "pending"}`}>
                  {field(qualification?.qualification_status || "Pending")}
                </span>
              </strong>
            </div>
            <div className="kv">
              <small>Avg Electric Bill</small>
              <strong>{qualification?.average_electric_bill ? `$${qualification.average_electric_bill}/mo` : "—"}</strong>
            </div>
            <div className="kv">
              <small>Homeowner</small>
              <strong>{qualification?.homeowner_confirmed ? "Yes" : qualification?.homeowner_confirmed === false ? "No" : "—"}</strong>
            </div>
            <div className="kv">
              <small>Home Type</small>
              <strong>{field(qualification?.home_type)}</strong>
            </div>
            <div className="kv">
              <small>Electricity Provider</small>
              <strong>{field(qualification?.electricity_provider)}</strong>
            </div>
            <div className="kv">
              <small>Credit &gt; 650</small>
              <strong>{qualification?.credit_above_650 ? "Yes" : qualification?.credit_above_650 === false ? "No" : "—"}</strong>
            </div>
            <div className="kv">
              <small>Roof Shading</small>
              <strong>{field(qualification?.roof_shading)}</strong>
            </div>
            <div className="kv">
              <small>Decision Maker</small>
              <strong>{qualification?.decision_maker ? "Yes" : qualification?.decision_maker === false ? "No" : "—"}</strong>
            </div>
          </div>
          {qualification?.notes && (
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #e8eee9" }}>
              <small className="muted">Qualification Notes:</small>
              <p style={{ margin: "4px 0 0", fontSize: "14px" }}>{qualification.notes}</p>
            </div>
          )}
        </div>

        {/* Latest Call Section */}
        <div className="card">
          <h2>Latest Call Details</h2>
          {latestCall ? (
            <>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px" }}>
                <span className={`badge ${latestCall.call_status === "completed" ? "completed" : "pending"}`}>
                  {latestCall.call_status}
                </span>
                <strong style={{ fontSize: "15px" }}>{latestCall.call_outcome || "Outcome N/A"}</strong>
                <span className="muted" style={{ marginLeft: "auto", fontSize: "12px" }}>
                  {new Date(latestCall.created_at).toLocaleString()}
                </span>
              </div>

              {latestCall.summary && (
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "14px", margin: "0 0 6px", color: "#163b2a" }}>🤖 AI Call Summary</h3>
                  <div className="alert success" style={{ margin: 0 }}>
                    {latestCall.summary}
                  </div>
                </div>
              )}

              {latestCall.recording_url && (
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "14px", margin: "0 0 6px", color: "#163b2a" }}>🔊 Call Audio Recording</h3>
                  <audio controls className="audio-player" src={latestCall.recording_url}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {latestCall.transcript && (
                <div>
                  <h3 style={{ fontSize: "14px", margin: "0 0 6px", color: "#163b2a" }}>📝 Call Transcript</h3>
                  <div className="transcript">{latestCall.transcript}</div>
                </div>
              )}
            </>
          ) : (
            <div className="empty">No call activity recorded for this lead yet.</div>
          )}
        </div>
      </div>

      <div className="section-title">
        <h2>Booked Appointments</h2>
      </div>

      <div className="card">
        {appointments.length ? (
          <div className="call-list">
            {appointments.map(apt => (
              <div className="call-row" key={apt.id}>
                <strong>📅 {new Date(apt.appointment_datetime).toLocaleString()}</strong>
                <span className="muted">
                  Status: <span className="badge completed">{apt.status}</span>
                </span>
                {apt.notes && <p style={{ margin: "6px 0 0", fontSize: "14px" }}>{apt.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No appointment booked for this lead.</div>
        )}
      </div>
    </>
  );
}
