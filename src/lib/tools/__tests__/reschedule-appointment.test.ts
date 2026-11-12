/**
 * reschedule-appointment.test.ts
 *
 * Unit tests for the Zod schema layer of rescheduleAppointment.
 * No database connection required.
 *
 * Key invariants verified:
 *   1. patient_id cannot be injected through the schema (Zod strips it)
 *   2. appointmentId and newSlotId must be positive integers
 *   3. Rejection of zero, negative, float, string values
 *   4. DEMO_PATIENT_ID constant is strictly 'P001'
 *
 * Run with:  npx tsx src/lib/tools/__tests__/reschedule-appointment.test.ts
 */

import { RescheduleAppointmentSchema } from "@/lib/schemas/tools";
import { DEMO_PATIENT_ID } from "@/lib/constants";

type Test = { label: string; run: () => void };
const tests: Test[] = [];
let passed = 0,
  failed = 0;

function test(label: string, fn: () => void) {
  tests.push({ label, run: fn });
}

function expect(actual: unknown) {
  return {
    toBe: (e: unknown) => {
      if (actual !== e)
        throw new Error(
          `Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`
        );
    },
    toBeTruthy: () => {
      if (!actual)
        throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy: () => {
      if (actual)
        throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toContain: (s: string) => {
      if (typeof actual !== "string" || !actual.includes(s))
        throw new Error(`Expected "${actual}" to contain "${s}"`);
    },
  };
}

// ─── Valid inputs ─────────────────────────────────────────────────────────────

test("valid: positive integer appointmentId and newSlotId", () => {
  const r = RescheduleAppointmentSchema.safeParse({
    appointmentId: 1,
    newSlotId: 45,
  });
  expect(r.success).toBeTruthy();
});

test("valid: large IDs", () => {
  const r = RescheduleAppointmentSchema.safeParse({
    appointmentId: 2048,
    newSlotId: 99999,
  });
  expect(r.success).toBeTruthy();
});

// ─── Security: patient_id stripping ───────────────────────────────────────────

test("security: patient_id injected by LLM is stripped by schema", () => {
  const r = RescheduleAppointmentSchema.safeParse({
    appointmentId: 1,
    newSlotId: 10,
    patient_id: "P002",
  });
  expect(r.success).toBeTruthy();
  if (r.success) {
    expect("patient_id" in r.data).toBeFalsy();
  }
});

test("security: RescheduleAppointmentSchema has no patient_id field", () => {
  const shape = RescheduleAppointmentSchema.shape;
  expect("patient_id" in shape).toBeFalsy();
  expect("appointmentId" in shape).toBeTruthy();
  expect("newSlotId" in shape).toBeTruthy();
});

test("security: server constant DEMO_PATIENT_ID is P001", () => {
  expect(DEMO_PATIENT_ID).toBe("P001");
});

// ─── Invalid inputs ───────────────────────────────────────────────────────────

test("invalid: appointmentId is 0", () => {
  const r = RescheduleAppointmentSchema.safeParse({
    appointmentId: 0,
    newSlotId: 10,
  });
  expect(r.success).toBeFalsy();
  if (!r.success) {
    expect(r.error.issues[0].message).toContain("positive integer");
  }
});

test("invalid: newSlotId is 0", () => {
  const r = RescheduleAppointmentSchema.safeParse({
    appointmentId: 1,
    newSlotId: 0,
  });
  expect(r.success).toBeFalsy();
  if (!r.success) {
    expect(r.error.issues[0].message).toContain("positive integer");
  }
});

test("invalid: negative IDs", () => {
  const r = RescheduleAppointmentSchema.safeParse({
    appointmentId: -1,
    newSlotId: 10,
  });
  expect(r.success).toBeFalsy();
});

test("invalid: float IDs", () => {
  const r = RescheduleAppointmentSchema.safeParse({
    appointmentId: 1.5,
    newSlotId: 10,
  });
  expect(r.success).toBeFalsy();
});

test("invalid: string IDs", () => {
  const r = RescheduleAppointmentSchema.safeParse({
    appointmentId: "1",
    newSlotId: "10",
  });
  expect(r.success).toBeFalsy();
});

test("invalid: missing newSlotId", () => {
  const r = RescheduleAppointmentSchema.safeParse({
    appointmentId: 1,
  });
  expect(r.success).toBeFalsy();
});

test("invalid: missing appointmentId", () => {
  const r = RescheduleAppointmentSchema.safeParse({
    newSlotId: 10,
  });
  expect(r.success).toBeFalsy();
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

