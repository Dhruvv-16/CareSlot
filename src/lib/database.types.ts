/**
 * database.types.ts
 *
 * TypeScript types derived from ps3_clinic_appointments.sql.
 * Keep in sync with the actual schema — do NOT invent columns.
 *
 * Generated manually from the authoritative SQL file.
 * When Supabase CLI is available, regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;              // text PRIMARY KEY  e.g. 'D01'
          name: string;            // text NOT NULL
          common_issues: string;   // text NOT NULL — LLM routing vocabulary
        };
        Insert: {
          id: string;
          name: string;
          common_issues: string;
        };
        Update: {
          id?: string;
          name?: string;
          common_issues?: string;
        };
      };

      doctors: {
        Row: {
          id: string;               // text PRIMARY KEY  e.g. 'DR01'
          name: string;             // text NOT NULL
          department_id: string;    // text NOT NULL  FK → departments(id)
          qualification: string;    // text NOT NULL
          experience_years: number; // int NOT NULL
          consultation_fee: number; // int NOT NULL  (in INR ₹)
          languages: string[];      // text[] NOT NULL  PostgreSQL array
          room: string;             // text NOT NULL  e.g. 'G-01'
        };
        Insert: {
          id: string;
          name: string;
          department_id: string;
          qualification: string;
          experience_years: number;
          consultation_fee: number;
          languages: string[];
          room: string;
        };
        Update: {
          id?: string;
          name?: string;
          department_id?: string;
          qualification?: string;
          experience_years?: number;
          consultation_fee?: number;
          languages?: string[];
          room?: string;
        };
      };

      slots: {
        Row: {
          id: number;           // bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
          doctor_id: string;    // text NOT NULL  FK → doctors(id)
          slot_date: string;    // date NOT NULL  (ISO 8601: 'YYYY-MM-DD')
          start_time: string;   // time NOT NULL  ('HH:MM:SS')
          is_booked: boolean;   // boolean NOT NULL DEFAULT false
        };
        Insert: {
          doctor_id: string;
          slot_date: string;
          start_time: string;
          is_booked?: boolean;
        };
        Update: {
          doctor_id?: string;
          slot_date?: string;
          start_time?: string;
          is_booked?: boolean;
        };
      };

      patients: {
        Row: {
          id: string;    // text PRIMARY KEY  e.g. 'P001'
          name: string;  // text NOT NULL
          phone: string; // text NOT NULL  (no format constraint in schema)
          age: number;   // int NOT NULL
          city: string;  // text NOT NULL
        };
        Insert: {
          id: string;
          name: string;
          phone: string;
          age: number;
          city: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          age?: number;
          city?: string;
        };
      };

      appointments: {
        Row: {
          id: number;           // bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
          patient_id: string;   // text NOT NULL  FK → patients(id)
          doctor_id: string;    // text NOT NULL  FK → doctors(id)  (denormalized)
          slot_id: number;      // bigint NOT NULL  FK → slots(id)
          reason: string | null; // text  (nullable)
          status: AppointmentStatus; // text NOT NULL DEFAULT 'booked'
          created_at: string;   // timestamptz NOT NULL DEFAULT now()
        };
        Insert: {
          patient_id: string;
          doctor_id: string;
          slot_id: number;
          reason?: string | null;
          status?: AppointmentStatus;
        };
        Update: {
          patient_id?: string;
          doctor_id?: string;
          slot_id?: number;
          reason?: string | null;
          status?: AppointmentStatus;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      appointment_status: AppointmentStatus;
    };
  };
}

/** Valid values for appointments.status (matches SQL CHECK constraint) */
export type AppointmentStatus = "booked" | "cancelled" | "completed";
