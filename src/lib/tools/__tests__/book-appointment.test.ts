/**
 * book-appointment.test.ts
 *
 * Unit tests for the Zod schema layer of bookAppointment.
 * No database connection required.
 *
 * Key invariants verified:
 *   1. patient_id cannot be injected through the schema (Zod strips it)
 *   2. doctorId must match DR\d{2} pattern
 *   3. slotId must be a positive integer
 *   4. reason is required (non-empty, max 500 chars)
 *   5. All valid inputs pass through cleanly
 *
 * Run with:  npx tsx src/lib/tools/__tests__/book-appointment.test.ts
 */

import { BookAppointmentSchema } from "@/lib/schemas/tools";
import { DEMO_PATIENT_ID } from "@/lib/constants";

// ── Tiny test harness ─────────────────────────────────────────────────────────

type Test = { label: string; run: () => void };
const tests: Test[] = [];
let passed = 0, failed = 0;

function test(label: string, fn: () => void) { tests.push({ label, run: fn }); }

function expect(actual: unknown) {
  return {
    toBe:       (e: unknown) => { if (actual !== e) throw new Error(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`); },
    toBeTruthy: ()           => { if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`); },
    toBeFalsy:  ()           => { if (actual)  throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`); },
    toContain:  (s: string)  => { if (typeof actual !== "string" || !actual.includes(s)) throw new Error(`Expected "${actual}" to contain "${s}"`); },
    toEqual:    (e: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(e)) throw new Error(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`); },
  };
}

// ─── Schema: valid inputs ─────────────────────────────────────────────────────

test("valid: minimal valid input", () => {
  const r = BookAppointmentSchema.safeParse({
    doctorId: "DR01",
    slotId: 42,
    reason: "Skin rash on arm",
  });
  expect(r.success).toBeTruthy();
});

test("valid: reason at max 500 chars", () => {
  const r = BookAppointmentSchema.safeParse({
    doctorId: "DR15",
    slotId: 999,
    reason: "A".repeat(500),
  });
  expect(r.success).toBeTruthy();
});

test("valid: doctorId DR15 (highest seeded)", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "DR15", slotId: 1, reason: "Check-up" });
  expect(r.success).toBeTruthy();
});

// ─── Schema: patient_id MUST NOT leak through ────────────────────────────────

test("security: patient_id from LLM is stripped by Zod", () => {
  const r = BookAppointmentSchema.safeParse({
    doctorId: "DR01",
    slotId: 42,
    reason: "Test",
    patient_id: "P002",   // LLM injection attempt
  });
  // Schema still passes (Zod strips unknown keys), but patient_id disappears
  expect(r.success).toBeTruthy();
  if (r.success) {
    expect("patient_id" in r.data).toBeFalsy();
  }
});

test("security: DEMO_PATIENT_ID constant is P001", () => {
  expect(DEMO_PATIENT_ID).toBe("P001");
});

test("security: DEMO_PATIENT_ID is a compile-time const — not 'any' type", () => {
  // The type is 'P001' (string literal), not string
  const pid: "P001" = DEMO_PATIENT_ID;
  expect(pid).toBe("P001");
});

// ─── Schema: doctorId validation ──────────────────────────────────────────────

test("invalid: doctorId lowercase 'dr01'", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "dr01", slotId: 1, reason: "Test" });
  expect(r.success).toBeFalsy();
  if (!r.success) expect(r.error.issues[0].message).toContain("DR01");
});

test("invalid: doctorId 'DR1' (missing leading zero)", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "DR1", slotId: 1, reason: "Test" });
  expect(r.success).toBeFalsy();
});

test("invalid: doctorId arbitrary string", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "GENERAL", slotId: 1, reason: "Test" });
  expect(r.success).toBeFalsy();
});

test("invalid: doctorId missing entirely", () => {
  const r = BookAppointmentSchema.safeParse({ slotId: 1, reason: "Test" });
  expect(r.success).toBeFalsy();
});

// ─── Schema: slotId validation ────────────────────────────────────────────────

test("invalid: slotId = 0", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "DR01", slotId: 0, reason: "Test" });
  expect(r.success).toBeFalsy();
  if (!r.success) expect(r.error.issues[0].message).toContain("positive integer");
});

test("invalid: slotId negative", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "DR01", slotId: -5, reason: "Test" });
  expect(r.success).toBeFalsy();
});

test("invalid: slotId float", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "DR01", slotId: 1.5, reason: "Test" });
  expect(r.success).toBeFalsy();
});

test("invalid: slotId string", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "DR01", slotId: "forty-two", reason: "Test" });
  expect(r.success).toBeFalsy();
});

test("invalid: slotId missing", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "DR01", reason: "Test" });
  expect(r.success).toBeFalsy();
});

// ─── Schema: reason validation ────────────────────────────────────────────────

test("invalid: reason empty string", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "DR01", slotId: 1, reason: "" });
  expect(r.success).toBeFalsy();
  if (!r.success) expect(r.error.issues[0].message).toContain("required");
});

test("invalid: reason whitespace only (trimmed to empty)", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "DR01", slotId: 1, reason: "   " });
  expect(r.success).toBeFalsy();
});

test("invalid: reason over 500 chars", () => {
  const r = BookAppointmentSchema.safeParse({
    doctorId: "DR01",
    slotId: 1,
    reason: "A".repeat(501),
  });
  expect(r.success).toBeFalsy();
});

test("invalid: reason missing", () => {
  const r = BookAppointmentSchema.safeParse({ doctorId: "DR01", slotId: 1 });
  expect(r.success).toBeFalsy();
});

// ─── Concurrency: verify the tool never reads patient_id from outside ─────────

test("design: BookAppointmentSchema has no patient_id field", () => {
  const shape = BookAppointmentSchema.shape;
  expect("patient_id" in shape).toBeFalsy();
  expect("doctorId" in shape).toBeTruthy();
  expect("slotId" in shape).toBeTruthy();
  expect("reason" in shape).toBeTruthy();
});

// ─── Run all ──────────────────────────────────────────────────────────────────

for (const tc of tests) {
  try {
    tc.run();
    console.log(`✅ PASS [${tc.label}]`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL [${tc.label}]`);
    console.error(`   ${(err as Error).message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests`);
if (failed > 0) process.exit(1);

