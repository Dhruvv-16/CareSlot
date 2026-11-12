/**
 * search-doctors.ts — H4: `searchDoctors` tool implementation
 *
 * Queries the `doctors` table (joined with `departments`) using the filters
 * the LLM provides. All filter logic runs in PostgreSQL — no post-processing
 * in TypeScript that could accidentally invent or drop records.
 *
 * Filter behaviour (all optional, combinable):
 *
 *   departmentId  → exact match on doctors.department_id
 *   language      → case-insensitive PostgreSQL array containment:
 *                   doctors.languages @> ARRAY[?]::text[]
 *                   We use ilike on each element via the `cs` (contains)
 *                   filter with a cast, plus a fallback manual filter for
 *                   case-insensitivity (see note below).
 *   doctorName    → case-insensitive ILIKE '%name%'
 *   keyword       → case-insensitive ILIKE against doctor name, department
 *                   name, and department common_issues
 *
 * Language matching note:
 *   Supabase's PostgREST `.contains()` on arrays is case-sensitive.
 *   To support 'tamil' matching 'Tamil', we apply a PostgreSQL function
 *   filter via `.filter()` with a raw SQL expression using `cs` (contains)
 *   on the lower-cased array. Because PostgREST doesn't expose array
 *   element transforms natively, we fetch with other filters applied and
 *   do the case-insensitive language check in a single JS `.filter()` call
 *   on the already-DB-filtered result set. This is safe because:
 *     - The result set after other filters is small (≤15 doctors total).
 *     - We NEVER invent doctors — we only filter the DB rows.
 *     - The language value itself comes from `doctors.languages`; we merely
 *       compare it case-insensitively.
 *
 * Returns: SearchDoctorResult[] — only columns declared in the SQL schema.
 */

import "server-only";

import { adminDb } from "@/lib/supabase-admin";
import {
  SearchDoctorsSchema,
  type SearchDoctorsInput,
} from "@/lib/schemas/tools";

// ── Return type ───────────────────────────────────────────────────────────────

/** Shape returned to the LLM and UI. Only real DB columns, no invented fields. */
export interface SearchDoctorResult {
  id: string;
  name: string;
  department_id: string;
  department_name: string;
  qualification: string;
  experience_years: number;
  consultation_fee: number; // in INR ₹
  languages: string[];      // exactly as stored in doctors.languages
  room: string;
}

// ── Tool error ────────────────────────────────────────────────────────────────

export interface ToolError {
  error: string;
  code: "VALIDATION_ERROR" | "DATABASE_ERROR" | "NOT_FOUND";
}

export type SearchDoctorsResult =
  | { success: true; data: SearchDoctorResult[] }
  | { success: false; error: ToolError };

// ── Implementation ────────────────────────────────────────────────────────────

export async function searchDoctors(
  rawInput: unknown
): Promise<SearchDoctorsResult> {
  // ── 1. Validate inputs ──────────────────────────────────────────────────────
  const parsed = SearchDoctorsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        error: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
    };
  }

  const { departmentId, language, doctorName, keyword } = parsed.data;

  // ── 2. Build Supabase query ─────────────────────────────────────────────────
  //
  // Base: join departments so we get department_name in one round-trip.
  // `doctors (*, departments!inner (name))` — inner join ensures only doctors
  // with a valid department row are returned (FK guarantees this, but explicit
  // is clearer).
  let query = adminDb
    .from("doctors")
    .select(
      `
      id,
      name,
      department_id,
      qualification,
      experience_years,
      consultation_fee,
      languages,
      room,
      departments!inner ( name )
    `
    )
    .order("name", { ascending: true });

  // ── Filter: departmentId (exact) ────────────────────────────────────────────
  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

  // ── Filter: doctorName (case-insensitive partial match) ─────────────────────
  if (doctorName) {
    query = query.ilike("name", `%${doctorName}%`);
  }

  // ── Filter: keyword — matches doctor name OR department name OR common_issues
  // PostgREST doesn't support OR across related table columns natively in one
  // filter call, so we use `or` with an embedded foreign-table filter.
  // Pattern: or=name.ilike.%kw%,departments.name.ilike.%kw%,...
  // However, filtering on a related table column via `or` is not supported by
  // PostgREST. Instead we do two passes:
  //   Pass A: filter doctors.name ILIKE %kw% → collect IDs
  //   Pass B: filter departments.common_issues / name ILIKE %kw% → collect IDs
  // Then union them. Because the total dataset is tiny (15 rows) we
  // actually fetch ALL with the other filters applied, then JS-filter by keyword.
  // This is a deliberate simplification — no invented data risk since we only
  // ever return rows the DB gave us.

  // ── 3. Execute query ────────────────────────────────────────────────────────
  const { data, error } = await query;

  if (error) {
    return {
      success: false,
      error: {
        code: "DATABASE_ERROR",
        error: `Database query failed: ${error.message}`,
      },
    };
  }

  if (!data) {
    return { success: true, data: [] };
  }

  // ── 4. Post-query filters (applied to the already-DB-filtered result set) ───
  //
  // These are applied in TypeScript because PostgREST cannot express them
  // natively (array element case-insensitivity, cross-table OR keyword match).
  // The DB already applied `departmentId` and `doctorName` filters above.

  // Supabase returns the joined `departments` as a nested object.
  // We cast through `unknown` because the generic inference on a dynamic
  // select string with an inner join collapses to `never` for the join column.
  interface RawRow {
    id: string;
    name: string;
    department_id: string;
    qualification: string;
    experience_years: number;
    consultation_fee: number;
    languages: string[];
    room: string;
    departments: { name: string } | null;
  }

  let results = (data as unknown) as RawRow[];

  // ── Filter: language (case-insensitive array element match) ─────────────────
  if (language) {
    const langLower = language.toLowerCase();
    results = results.filter((row) =>
      row.languages.some((l) => l.toLowerCase() === langLower)
    );
  }

  // ── Filter: keyword (doctor name OR department name OR common_issues) ────────
  if (keyword) {
    // We need common_issues for the keyword match — fetch it separately
    // only when keyword is provided (avoid the extra column in normal path).
    const kwLower = keyword.toLowerCase();

    // Fetch departments with common_issues for the filtered doctor IDs
    const doctorIds = results.map((r) => r.id);
    if (doctorIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data: deptData, error: deptError } = await adminDb
      .from("departments")
      .select("id, name, common_issues");

    if (deptError) {
      return {
        success: false,
        error: {
          code: "DATABASE_ERROR",
          error: `Department lookup failed: ${deptError.message}`,
        },
      };
    }

    interface DeptRow { id: string; name: string; common_issues: string }
    const deptRows = (deptData ?? []) as unknown as DeptRow[];

    const deptMap = new Map(
      deptRows.map((d) => [d.id, d])
    );

    results = results.filter((row) => {
      const dept = deptMap.get(row.department_id);
      const deptName = dept?.name?.toLowerCase() ?? "";
      const commonIssues = dept?.common_issues?.toLowerCase() ?? "";
      const docName = row.name.toLowerCase();

      return (
        docName.includes(kwLower) ||
        deptName.includes(kwLower) ||
        commonIssues.includes(kwLower)
      );
    });
  }

  // ── 5. Shape the output — only columns from the actual schema ───────────────
  const shaped: SearchDoctorResult[] = results.map((row) => ({
    id: row.id,
    name: row.name,
    department_id: row.department_id,
    department_name: row.departments?.name ?? "",
    qualification: row.qualification,
    experience_years: row.experience_years,
    consultation_fee: row.consultation_fee,
    languages: row.languages,  // verbatim from DB — never modified
    room: row.room,
  }));

  return { success: true, data: shaped };
}
