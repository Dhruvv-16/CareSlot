/**
 * get-my-appointments.test.ts
 *
 * Unit tests for GetMyAppointmentsSchema.
 * No database connection required.
 */

import { GetMyAppointmentsSchema } from "@/lib/schemas/tools";
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
  };
}

test("valid: empty input (no status filter)", () => {
  const r = GetMyAppointmentsSchema.safeParse({});
  expect(r.success).toBeTruthy();
});

test("valid: status booked", () => {
  const r = GetMyAppointmentsSchema.safeParse({ status: "booked" });
  expect(r.success).toBeTruthy();
});

test("valid: status cancelled", () => {
  const r = GetMyAppointmentsSchema.safeParse({ status: "cancelled" });
  expect(r.success).toBeTruthy();
});

test("valid: status completed", () => {
  const r = GetMyAppointmentsSchema.safeParse({ status: "completed" });
  expect(r.success).toBeTruthy();
});

test("invalid: status unknown", () => {
  const r = GetMyAppointmentsSchema.safeParse({ status: "pending" });
  expect(r.success).toBeFalsy();
});

test("security: patient_id is not in schema and stripped", () => {
  const r = GetMyAppointmentsSchema.safeParse({
    patient_id: "P003",
    status: "booked",
  });
  expect(r.success).toBeTruthy();
  if (r.success) {
    expect("patient_id" in r.data).toBeFalsy();
  }
});

test("security: DEMO_PATIENT_ID is P001", () => {
  expect(DEMO_PATIENT_ID).toBe("P001");
});

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

