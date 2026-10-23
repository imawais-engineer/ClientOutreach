import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Lead } from '@/lib/leads';

type LeadInsert = Partial<{ [K in keyof Lead]: Lead[K] | null }> & {
  business: string;
  need: string;
};
type LeadUpdate = { [K in keyof Lead]?: Lead[K] | null };

type Database = {
  public: {
    Tables: {
      leads: {
        Row: Lead;
        Insert: LeadInsert;
        Update: LeadUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const key =
    serviceKey && !serviceKey.startsWith('(') ? serviceKey : anonKey;
  if (!url || !key) {
    throw new Error('Supabase env vars missing');
  }

  client = createClient<Database>(url, key, { auth: { persistSession: false } });
  return client;
}
