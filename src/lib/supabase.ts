import { createClient } from '@supabase/supabase-js';

export interface EmailLog {
  id: number;
  recipient: string;
  email_type: string | null;
  subject: string | null;
  body: string | null;
  variables: Record<string, any> | null;
  target_date: string;
  status: string;
  note: string | null;
  timestamp: string;
}

export interface Database {
  public: {
    Tables: {
      email_logs: {
        Row: EmailLog;
        Insert: Omit<EmailLog, 'id' | 'timestamp'>;
        Update: Partial<Omit<EmailLog, 'id' | 'timestamp'>>;
      };
    };
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please restart the dev server.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const getSupabaseUrl = () => supabaseUrl;
export const getSupabaseAnonKey = () => supabaseAnonKey;
