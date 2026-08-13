import { createClient } from "@supabase/supabase-js";
import type { Lead, Call, Qualification, Appointment } from "./types";

const mockLeads: Lead[] = [
  { id: "11111111-1111-4111-a111-111111111111", first_name: "John", last_name: "Smith", email: "john.smith@example.com", phone: "+15550100001", property_address: "101 Sunflower Ave", address: "101 Sunflower Ave", lead_status: "new", created_at: new Date().toISOString() },
  { id: "22222222-2222-4222-a222-222222222222", first_name: "Michael", last_name: "Brown", email: "michael.brown@example.com", phone: "+15550100002", property_address: "202 Solar Way", address: "202 Solar Way", lead_status: "new", created_at: new Date().toISOString() },
  { id: "33333333-3333-4333-a333-333333333333", first_name: "Sarah", last_name: "Johnson", email: "sarah.johnson@example.com", phone: "+15550100003", property_address: "303 Bright Street", address: "303 Bright Street", lead_status: "new", created_at: new Date().toISOString() },
  { id: "44444444-4444-4444-a444-444444444444", first_name: "David", last_name: "Wilson", email: "david.wilson@example.com", phone: "+15550100004", property_address: "404 Power Lane", address: "404 Power Lane", lead_status: "new", created_at: new Date().toISOString() },
  { id: "55555555-5555-4555-a555-555555555555", first_name: "Emily", last_name: "Davis", email: "emily.davis@example.com", phone: "+15550100005", property_address: "505 Ray Court", address: "505 Ray Court", lead_status: "new", created_at: new Date().toISOString() }
];

const mockCalls: Call[] = [];
const mockQualifications: Qualification[] = [];
const mockAppointments: Appointment[] = [];

export function getSupabaseUrlAndKey() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://drpymjqvyetxhszhxtdd.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, key };
}

export function getSupabaseAdmin() {
  const { url, key } = getSupabaseUrlAndKey();
  if (!key) {
    // Return a mock database wrapper if key is not yet set
    return createMockSupabase();
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function createMockSupabase(): any {
  return {
    from: (table: string) => {
      let queryData: any[] = [];
      if (table === "leads") queryData = [...mockLeads];
      else if (table === "calls") queryData = [...mockCalls];
      else if (table === "lead_qualifications") queryData = [...mockQualifications];
      else if (table === "appointments") queryData = [...mockAppointments];

      const chain = {
        select: (_cols?: string) => chain,
        order: (_col: string, _opts?: any) => chain,
        limit: (n: number) => { queryData = queryData.slice(0, n); return chain; },
        eq: (col: string, val: any) => { queryData = queryData.filter(item => item[col] === val); return chain; },
        maybeSingle: async () => ({ data: queryData[0] || null, error: null }),
        single: async () => ({ data: queryData[0] || null, error: queryData[0] ? null : { message: "Not found" } }),
        insert: (rowOrRows: any) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
          rows.forEach(r => {
            const newRow = { id: r.id || crypto.randomUUID(), created_at: new Date().toISOString(), ...r };
            if (table === "leads") mockLeads.unshift(newRow);
            else if (table === "calls") mockCalls.unshift(newRow);
            else if (table === "lead_qualifications") mockQualifications.unshift(newRow);
            else if (table === "appointments") mockAppointments.unshift(newRow);
            queryData.unshift(newRow);
          });
          return {
            select: () => ({
              single: async () => ({ data: queryData[0], error: null }),
              then: (cb: any) => Promise.resolve({ data: queryData, error: null }).then(cb)
            }),
            then: (cb: any) => Promise.resolve({ data: queryData, error: null }).then(cb)
          };
        },
        update: (updates: any) => ({
          eq: (col: string, val: any) => {
            queryData.forEach(item => {
              if (item[col] === val) Object.assign(item, updates);
            });
            return Promise.resolve({ data: queryData, error: null });
          }
        }),
        upsert: (item: any, _opts?: any) => {
          if (table === "lead_qualifications") {
            const idx = mockQualifications.findIndex(q => q.lead_id === item.lead_id);
            const newRecord = { id: item.id || crypto.randomUUID(), created_at: new Date().toISOString(), ...item };
            if (idx >= 0) mockQualifications[idx] = newRecord;
            else mockQualifications.unshift(newRecord);
          }
          return Promise.resolve({ data: item, error: null });
        },
        then: (cb: any) => Promise.resolve({ data: queryData, error: null }).then(cb)
      };
      return chain;
    }
  };
}
