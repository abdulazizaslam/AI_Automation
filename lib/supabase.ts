import { createClient } from "@supabase/supabase-js";
import type { Lead, Call, Qualification, Appointment } from "./types";

export const defaultSeedLeads: Lead[] = [
  { id: "11111111-1111-4111-a111-111111111111", first_name: "John", last_name: "Smith", email: "john.smith@example.com", phone: "+15550100001", property_address: "101 Sunflower Ave", address: "101 Sunflower Ave", lead_status: "new", created_at: new Date().toISOString() },
  { id: "22222222-2222-4222-a222-222222222222", first_name: "Michael", last_name: "Brown", email: "michael.brown@example.com", phone: "+15550100002", property_address: "202 Solar Way", address: "202 Solar Way", lead_status: "new", created_at: new Date().toISOString() },
  { id: "33333333-3333-4333-a333-333333333333", first_name: "Sarah", last_name: "Johnson", email: "sarah.johnson@example.com", phone: "+15550100003", property_address: "303 Bright Street", address: "303 Bright Street", lead_status: "new", created_at: new Date().toISOString() },
  { id: "44444444-4444-4444-a444-444444444444", first_name: "David", last_name: "Wilson", email: "david.wilson@example.com", phone: "+15550100004", property_address: "404 Power Lane", address: "404 Power Lane", lead_status: "new", created_at: new Date().toISOString() },
  { id: "55555555-5555-4555-a555-555555555555", first_name: "Emily", last_name: "Davis", email: "emily.davis@example.com", phone: "+15550100005", property_address: "505 Ray Court", address: "505 Ray Court", lead_status: "new", created_at: new Date().toISOString() }
];

type MockStore = {
  leads: Lead[];
  calls: Call[];
  qualifications: Qualification[];
  appointments: Appointment[];
};

export type SupabaseMode = "service_role" | "anon" | "mock";

const globalAny = globalThis as typeof globalThis & { mockStore?: MockStore };
if (!globalAny.mockStore) {
  globalAny.mockStore = {
    leads: [...defaultSeedLeads],
    calls: [],
    qualifications: [],
    appointments: []
  };
}

const mockStore = globalAny.mockStore!;

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null;

  const key = serviceRoleKey || anonKey;
  const mode: SupabaseMode = url && key
    ? (serviceRoleKey ? "service_role" : "anon")
    : "mock";

  return { url, key, mode };
}

export function getSupabaseUrlAndKey() {
  const { url, key } = getSupabaseConfig();
  return { url, key };
}

export function getSupabaseAdmin() {
  const { url, key, mode } = getSupabaseConfig();
  if (!url || !key) {
    return createMockSupabase();
  }

  if (mode === "anon" && process.env.NODE_ENV === "production") {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not configured; using anon key. Server writes require compatible RLS policies.");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function getMockLeadById(id: string): Lead {
  return mockStore.leads.find(lead => lead.id === id)
    || defaultSeedLeads.find(lead => lead.id === id)
    || defaultSeedLeads[0];
}

export function getMockLeads(): Lead[] {
  return mockStore.leads.length ? mockStore.leads : defaultSeedLeads;
}

function tableStore(table: string): Record<string, unknown>[] {
  if (table === "leads") return mockStore.leads as unknown as Record<string, unknown>[];
  if (table === "calls") return mockStore.calls as unknown as Record<string, unknown>[];
  if (table === "lead_qualifications") return mockStore.qualifications as unknown as Record<string, unknown>[];
  if (table === "appointments") return mockStore.appointments as unknown as Record<string, unknown>[];
  return [];
}

function createMockSupabase(): any {
  return {
    from: (table: string) => {
      const source = tableStore(table);
      let data = [...source];
      let pendingUpdate: Record<string, unknown> | null = null;
      let deleteMode = false;

      const applyFilter = (predicate: (item: Record<string, unknown>) => boolean) => {
        if (pendingUpdate) {
          source.forEach(item => {
            if (predicate(item)) Object.assign(item, pendingUpdate);
          });
          return { data: null, error: null };
        }

        if (deleteMode) {
          for (let index = source.length - 1; index >= 0; index--) {
            if (predicate(source[index])) source.splice(index, 1);
          }
          return { data: null, error: null };
        }

        data = data.filter(predicate);
        return null;
      };

      const chain: any = {
        select: (_cols?: string) => chain,
        order: (column: string, options?: { ascending?: boolean }) => {
          const ascending = options?.ascending !== false;
          data.sort((a, b) => {
            const left = a[column];
            const right = b[column];
            if (left === right) return 0;
            if (left == null) return 1;
            if (right == null) return -1;
            return String(left).localeCompare(String(right)) * (ascending ? 1 : -1);
          });
          return chain;
        },
        limit: (n: number) => {
          data = data.slice(0, n);
          return chain;
        },
        eq: (column: string, value: unknown) => {
          const result = applyFilter(item => String(item[column]) === String(value));
          return result ? Promise.resolve(result) : chain;
        },
        neq: (column: string, value: unknown) => {
          const result = applyFilter(item => String(item[column]) !== String(value));
          return result ? Promise.resolve(result) : chain;
        },
        maybeSingle: async () => ({ data: data[0] || null, error: null }),
        single: async () => ({ data: data[0] || null, error: data[0] ? null : { message: "Not found" } }),
        insert: (rowOrRows: Record<string, unknown> | Record<string, unknown>[]) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
          const inserted = rows.map(row => ({
            id: row.id || crypto.randomUUID(),
            created_at: row.created_at || new Date().toISOString(),
            ...row
          }));
          source.unshift(...inserted);
          data = inserted;
          return chain;
        },
        update: (updates: Record<string, unknown>) => {
          pendingUpdate = updates;
          return chain;
        },
        delete: () => {
          deleteMode = true;
          return chain;
        },
        upsert: async (item: Record<string, unknown>, options?: { onConflict?: string }) => {
          const conflictKey = options?.onConflict;
          const index = conflictKey
            ? source.findIndex(row => String(row[conflictKey]) === String(item[conflictKey]))
            : -1;
          const record = {
            id: item.id || (index >= 0 ? source[index].id : crypto.randomUUID()),
            created_at: item.created_at || (index >= 0 ? source[index].created_at : new Date().toISOString()),
            ...item
          };
          if (index >= 0) source[index] = record;
          else source.unshift(record);
          return { data: record, error: null };
        },
        then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve)
      };

      return chain;
    }
  };
}
