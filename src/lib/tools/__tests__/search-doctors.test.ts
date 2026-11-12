/**
 * search-doctors.test.ts
 *
 * Unit tests for the Zod schema layer of searchDoctors.
 * These run without a database connection — they verify that:
 *   - Valid inputs pass validation
 *   - Invalid inputs are rejected with clear messages
 *   - patient_id cannot be injected through the schema
 *
 * Run with:  npx tsx src/lib/tools/__tests__/search-doctors.test.ts
 */

import { SearchDoctorsSchema } from "@/lib/schemas/tools";

type TestCase = {
  label: string;
  input: unknown;
  expectValid: boolean;
  expectError?: string;
};

const cases: TestCase[] = [
  // ── Valid inputs ────────────────────────────────────────────────────────────
  {
    label: "empty object — returns all doctors",
    input: {},
    expectValid: true,
  },
  {
    label: "valid departmentId D02",
    input: { departmentId: "D02" },
    expectValid: true,
  },
  {
    label: "valid language Tamil",
    input: { language: "Tamil" },
    expectValid: true,
  },
  {
    label: "valid language in lowercase (agent may send it lowercase)",
    input: { language: "tamil" },
    expectValid: true,
  },
  {
    label: "valid doctorName partial",
    input: { doctorName: "Kavitha" },
    expectValid: true,
  },
  {
    label: "valid keyword skin rash",
    input: { keyword: "skin rash" },
    expectValid: true,
  },
  {
    label: "all filters combined",
    input: {
      departmentId: "D01",
      language: "Tamil",
      doctorName: "Dr.",
      keyword: "diabetes",
    },
    expectValid: true,
  },
  {
    label: "whitespace trimmed from language",
    input: { language: "  Hindi  " },
    expectValid: true,
  },

  // ── Invalid inputs ──────────────────────────────────────────────────────────
  {
    label: "departmentId wrong format (lowercase)",
    input: { departmentId: "d02" },
    expectValid: false,
    expectError: "departmentId must be like 'D01'",
  },
  {
    label: "departmentId with no leading zero",
    input: { departmentId: "D2" },
    expectValid: false,
    expectError: "departmentId must be like 'D01'",
  },
  {
    label: "language empty string",
    input: { language: "" },
    expectValid: false,
  },
  {
    label: "language over 50 chars",
    input: { language: "A".repeat(51) },
    expectValid: false,
  },
  {
    label: "doctorName empty string",
    input: { doctorName: "" },
    expectValid: false,
  },
  {
    label: "keyword empty string",
    input: { keyword: "" },
    expectValid: false,
  },
  {
    label: "keyword over 200 chars",
    input: { keyword: "A".repeat(201) },
    expectValid: false,
  },
  {
    label: "patient_id cannot be injected (extra key ignored by Zod strip)",
    // Zod strips unknown keys by default — no security risk, just ignored
    input: { patient_id: "P002", language: "Tamil" },
    expectValid: true, // schema passes; patient_id silently stripped
  },
];

let passed = 0;
let failed = 0;

for (const tc of cases) {
  const result = SearchDoctorsSchema.safeParse(tc.input);
  const isValid = result.success;

  if (isValid !== tc.expectValid) {
    console.error(`❌ FAIL [${tc.label}]`);
    console.error(`   Expected valid=${tc.expectValid}, got valid=${isValid}`);
    if (!result.success) {
      console.error("   Errors:", result.error.issues);
    }
    failed++;
    continue;
  }

  if (!tc.expectValid && tc.expectError) {
    const messages = !result.success
      ? result.error.issues.map((i) => i.message).join(" | ")
      : "";
    if (!messages.includes(tc.expectError)) {
      console.error(`❌ FAIL [${tc.label}] — wrong error message`);
      console.error(`   Expected to contain: "${tc.expectError}"`);
      console.error(`   Got: "${messages}"`);
      failed++;
      continue;
    }
  }

  // Verify patient_id is stripped even if supplied
  if (tc.label.includes("patient_id") && result.success) {
    const data = result.data as Record<string, unknown>;
    if ("patient_id" in data) {
      console.error(`❌ FAIL [${tc.label}] — patient_id leaked through schema`);
      failed++;
      continue;
    }
  }

  console.log(`✅ PASS [${tc.label}]`);
  passed++;
}

console.log(`\n${passed} passed, ${failed} failed out of ${cases.length} tests`);
if (failed > 0) process.exit(1);

