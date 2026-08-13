import { createClient } from "@supabase/supabase-js";
import type { Lead, Call, Qualification, Appointment } from "./types";

export const defaultSeedLeads: Lead[] = [
  { id: "11111111-1111-4111-a111-111111111111", first_name: "John", last_name: "Smith", email: "john.smith@example.com", phone: "+15550100001", property_address: "101 Sunflower Ave", address: "101 Sunflower Ave", lead_status: "new", created_at: new Date().toISOString() },
  { id: "22222222-2222-4222-a222-222222222222", first_name: "Michael", last_name: "Brown", email: "michael.brown@example.com", phone: "+15550100002", property_address: "202 Solar Way", address: "202 Solar Way", lead_status: "new", created_at: new Date().toISOString() },
  { id: "33333333-3333-4333-a333-333333333333", first_name: "Sarah", last_name: "Johnson", email: "sarah.johnson@example.com", phone: "+15550100003", property_address: "303 Bright Street", address: "303 Bright Street", lead_status: "new", created_at: new Date().toISOString() },
  { id: "44444444-4444-4444-a444-444444444444", first_name: "David", last_name: "Wilson", email: "david.wilson@example.com", phone: "+15550100004", property_address: "404 Power Lane", address: "404 Power Lane", lead_status: "new", created_at: new Date().toISOString() },
  { id: "55555555-5555-4555-a555-555555555555", first_name: "Emily", last_name: "Davis", email: "emily.davis@example.com", phone: "+15550100005", property_address: "505 Ray Court", address: "505 Ray Court", lead_status: "new", created_at: new Date().toISOString() }
];

const mockLeadsStore: Lead[] = [...defaultSeedLeads];
const mockCallsStore: Call[] = [];
const mockQualificationsStore: Qualification[] = [];
const mockAppointmentsStore: Appointment[] = [];

export function getSupabaseUrlAndKey() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://drpymjqvyetxhszhxtdd.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, key: key?.trim() ? key : null };
}

export function getSupabaseAdmin() {
  const { url, key } = getSupabaseUrlAndKey();
  if (!key) {
    return createMockSupabase();
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function getMockLeadById(id: string): Lead {
  return mockLeadsStore.find(l => l.id === id) || defaultSeedLeads.find(l => l.id === id) || defaultSeedLeads[0];
}

export function getMockLeads(): Lead[] {
  return mockLeadsStore.length ? mockLeadsStore : defaultSeedLeads;
}

function createMockSupabase(): any {
  return {
    from: (table: string) => {
      let data: any[] = [];
      if (table === "leads") data = mockLeadsStore.length ? [...mockLeadsStore] : [...defaultSeedLeads];
      else if (table === "calls") data = [...mockCallsStore];
      else if (table === "lead_qualifications") data = [...mockQualificationsStore];
      else if (table === "appointments") data = [...mockAppointmentsStore];

      const chain = {
        select: (_cols?: string) => chain,
        order: (_col: string, _opts?: any) => chain,
        limit: (n: number) => {
          data = data.slice(0, n);
          return chain;
        },
        eq: (col: string, val: any) => {
          data = data.filter(item => String(item[col]) === String(val));
          return chain;
        },
        maybeSingle: async () => ({ data: data[0] || null, error: null }),
        single: async () => ({ data: data[0] || null, error: data[0] ? null : { message: "Not found" } }),
        insert: (rowOrRows: any) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
          const inserted: any[] = [];
          rows.forEach(r => {
            const newRow = { id: r.id || crypto.randomUUID(), created_at: new Date().toISOString(), ...r };
            if (table === "leads") mockLeadsStore.unshift(newRow);
            else if (table === "calls") mockCallsStore.unshift(newRow);
            else if (table === "lead_qualifications") mockQualificationsStore.unshift(newRow);
            else if (table === "appointments") mockAppointmentsStore.unshift(newRow);
            inserted.push(newRow);
          });
          return {
            select: () => ({
              single: async () => ({ data: inserted[0], error: null }),
              then: (cb: any) => Promise.resolve({ data: inserted, error: null }).then(cb)
            }),
            then: (cb: any) => Promise.resolve({ data: inserted, error: null }).then(cb)
          };
        },
        update: (updates: any) => ({
          eq: (col: string, val: any) => {
            if (table === "calls") {
              mockCallsStore.forEach(item => {
                if (String(item[col as keyof Call]) === String(val)) Object.assign(item, updates);
              });
            } else if (table === "leads") {
              mockLeadsStore.forEach(item => {
                if (String(item[col as keyof Lead]) === String(val)) Object.assign(item, updates);
              });
            }
            return Promise.resolve({ data: updates, error: null });
          }
        }),
        upsert: (item: any, _opts?: any) => {
          if (table === "lead_qualifications") {
            const idx = mockQualificationsStore.findIndex(q => q.lead_id === item.lead_id);
            const newRecord = { id: item.id || crypto.randomUUID(), created_at: new Date().toISOString(), ...item };
            if (idx >= 0) mockQualificationsStore[idx] = newRecord;
            else mockQualificationsStore.unshift(newRecord);
          }
          return Promise.resolve({ data: item, error: null });
        },
        then: (cb: any) => Promise.resolve({ data, error: null }).then(cb)
      };
      return chain;
    }
  };
}
