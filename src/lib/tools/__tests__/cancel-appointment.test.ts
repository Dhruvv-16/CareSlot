/**
 * cancel-appointment.test.ts
 *
 * Unit tests for the Zod schema layer of cancelAppointment.
 * No database connection required.
 *
 * Key invariants verified:
 *   1. patient_id cannot be injected through the schema (Zod strips it)
 *   2. appointmentId must be a positive integer
 *   3. Rejection of zero, negative, float, string values
 *   4. DEMO_PATIENT_ID constant is strictly 'P001'
 *
 * Run with:  npx tsx src/lib/tools/__tests__/cancel-appointment.test.ts
 */

import { CancelAppointmentSchema } from "@/lib/schemas/tools";
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

test("valid: positive integer appointmentId", () => {
  const r = CancelAppointmentSchema.safeParse({ appointmentId: 1 });
  expect(r.success).toBeTruthy();
});

test("valid: large appointmentId", () => {
  const r = CancelAppointmentSchema.safeParse({ appointmentId: 1048576 });
  expect(r.success).toBeTruthy();
});

// ─── Security: patient_id stripping ───────────────────────────────────────────

test("security: patient_id injected by LLM is stripped by schema", () => {
  const r = CancelAppointmentSchema.safeParse({
    appointmentId: 1,
    patient_id: "P002", // malicious attempt to target another patient's appointment
  });
  expect(r.success).toBeTruthy();
  if (r.success) {
    expect("patient_id" in r.data).toBeFalsy();
  }
});

test("security: CancelAppointmentSchema has no patient_id field", () => {
  const shape = CancelAppointmentSchema.shape;
  expect("patient_id" in shape).toBeFalsy();
  expect("appointmentId" in shape).toBeTruthy();
});

test("security: server constant DEMO_PATIENT_ID is P001", () => {
  expect(DEMO_PATIENT_ID).toBe("P001");
});

// ─── Invalid inputs ───────────────────────────────────────────────────────────

test("invalid: appointmentId is 0", () => {
  const r = CancelAppointmentSchema.safeParse({ appointmentId: 0 });
  expect(r.success).toBeFalsy();
  if (!r.success) {
    expect(r.error.issues[0].message).toContain("positive integer");
  }
});

test("invalid: appointmentId is negative", () => {
  const r = CancelAppointmentSchema.safeParse({ appointmentId: -10 });
  expect(r.success).toBeFalsy();
});

test("invalid: appointmentId is float", () => {
  const r = CancelAppointmentSchema.safeParse({ appointmentId: 1.5 });
  expect(r.success).toBeFalsy();
});

test("invalid: appointmentId is string", () => {
  const r = CancelAppointmentSchema.safeParse({ appointmentId: "1" });
  expect(r.success).toBeFalsy();
});

test("invalid: appointmentId missing", () => {
  const r = CancelAppointmentSchema.safeParse({});
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

