export type Lead = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  property_address: string | null;
  address?: string | null;
  lead_status: string;
  created_at: string;
  updated_at?: string;
};

export type Call = {
  id: string;
  lead_id: string;
  external_call_id: string | null;
  call_status: string;
  call_outcome: string | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  appointment_booked: boolean;
  created_at: string;
};

export type Qualification = {
  id: string;
  lead_id: string;
  average_electric_bill: number | null;
  homeowner_confirmed: boolean | null;
  home_type: string | null;
  electricity_provider: string | null;
  credit_above_650: boolean | null;
  roof_shading: string | null;
  decision_maker: boolean | null;
  qualification_status: string | null;
  notes: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  lead_id: string;
  appointment_datetime: string;
  status: string;
  notes: string | null;
  created_at: string;
};
