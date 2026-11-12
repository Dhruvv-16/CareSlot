/**
 * database.types.ts
 *
 * TypeScript types derived from ps3_clinic_appointments.sql.
 * Strictly adheres to GenericSchema for @supabase/supabase-js v2.
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
          id: string;              // text PRIMARY KEY e.g. 'D01'
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
        Relationships: [];
      };

      doctors: {
        Row: {
          id: string;               // text PRIMARY KEY e.g. 'DR01'
          name: string;             // text NOT NULL
          department_id: string;    // text NOT NULL FK → departments(id)
          qualification: string;    // text NOT NULL
          experience_years: number; // int NOT NULL
          consultation_fee: number; // int NOT NULL (in INR ₹)
          languages: string[];      // text[] NOT NULL PostgreSQL array
          room: string;             // text NOT NULL e.g. 'G-01'
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
        Relationships: [
          {
            foreignKeyName: "doctors_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          }
        ];
      };

      slots: {
        Row: {
          id: number;           // bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
          doctor_id: string;    // text NOT NULL FK → doctors(id)
          slot_date: string;    // date NOT NULL ('YYYY-MM-DD')
          start_time: string;   // time NOT NULL ('HH:MM:SS')
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
        Relationships: [
          {
            foreignKeyName: "slots_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          }
        ];
      };

      patients: {
        Row: {
          id: string;    // text PRIMARY KEY e.g. 'P001'
          name: string;  // text NOT NULL
          phone: string; // text NOT NULL
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
        Relationships: [];
      };

      appointments: {
        Row: {
          id: number;           // bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
          patient_id: string;   // text NOT NULL FK → patients(id)
          doctor_id: string;    // text NOT NULL FK → doctors(id)
          slot_id: number;      // bigint NOT NULL FK → slots(id)
          reason: string | null;
          status: AppointmentStatus;
          created_at: string;
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
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "slots";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      book_appointment: {
        Args: {
          p_patient_id: string;
          p_doctor_id: string;
          p_slot_id: number;
          p_reason: string;
        };
        Returns: Json;
      };
      cancel_appointment: {
        Args: {
          p_patient_id: string;
          p_appointment_id: number;
        };
        Returns: Json;
      };
      reschedule_appointment: {
        Args: {
          p_patient_id: string;
          p_appointment_id: number;
          p_new_slot_id: number;
        };
        Returns: Json;
      };
    };
    Enums: {
      appointment_status: AppointmentStatus;
    };
  };
}

export type AppointmentStatus = "booked" | "cancelled" | "completed";
