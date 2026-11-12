/**
 * gemini-tools.test.ts
 *
 * Unit tests for Gemini tool declarations and confirmation safeguards.
 * No database or live Gemini API call required.
 */

// Mock server-only before imports for standalone test execution
require.cache[require.resolve("server-only")] = { exports: {} } as any;

// Set dummy env variables for unit test run if not present
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://dummy.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-secret-key";

import {
  CARESLOT_TOOLS,
  hasExplicitConfirmation,
  executeTool,
} from "@/lib/gemini-tools";

type Test = { label: string; run: () => void | Promise<void> };
const tests: Test[] = [];
let passed = 0,
  failed = 0;

function test(label: string, fn: () => void | Promise<void>) {
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
    toEqual: (e: unknown) => {
      if (JSON.stringify(actual) !== JSON.stringify(e))
        throw new Error(
          `Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`
        );
    },
    toHaveLength: (n: number) => {
      if (!Array.isArray(actual) || actual.length !== n)
        throw new Error(
          `Expected length ${n}, got ${
            Array.isArray(actual) ? actual.length : "non-array"
          }`
        );
    },
  };
}

// ─── Tool Declaration Invariants ──────────────────────────────────────────────

test("declarations: exposes exactly 6 tools", () => {
  const decls = CARESLOT_TOOLS[0].functionDeclarations;
  expect(decls).toHaveLength(6);

  const names = decls.map((d) => d.name).sort();
  expect(names).toEqual([
    "bookAppointment",
    "cancelAppointment",
    "getAvailableSlots",
    "getMyAppointments",
    "rescheduleAppointment",
    "searchDoctors",
  ]);
});

test("security: patient_id is NOT in any tool's declared parameters", () => {
  const decls = CARESLOT_TOOLS[0].functionDeclarations;
  for (const tool of decls) {
    const props = (tool.parameters?.properties || {}) as Record<string, unknown>;
    if ("patient_id" in props || "patientId" in props) {
      throw new Error(`Tool ${tool.name} leaked patient_id in parameter schema!`);
    }
  }
});

// ─── Confirmation Safeguard Logic ─────────────────────────────────────────────

test("confirmation: recognizes common affirmative statements", () => {
  expect(hasExplicitConfirmation("yes")).toBeTruthy();
  expect(hasExplicitConfirmation("Yes, please proceed")).toBeTruthy();
  expect(hasExplicitConfirmation("Confirm")).toBeTruthy();
  expect(hasExplicitConfirmation("Go ahead")).toBeTruthy();
  expect(hasExplicitConfirmation("Book it")).toBeTruthy();
  expect(hasExplicitConfirmation("Sure")).toBeTruthy();
  expect(hasExplicitConfirmation("Please confirm the booking")).toBeTruthy();
});

test("confirmation: rejects initial inquiries without confirmation", () => {
  expect(
    hasExplicitConfirmation("I have a skin rash, book me with a doctor")
  ).toBeFalsy();
  expect(
    hasExplicitConfirmation("Show me available doctors for tomorrow")
  ).toBeFalsy();
  expect(
    hasExplicitConfirmation("Which Tamil speaking doctors are available?")
  ).toBeFalsy();
  expect(
    hasExplicitConfirmation("What are your clinic hours?")
  ).toBeFalsy();
});

test("safeguard: bookAppointment blocks execution when unconfirmed", async () => {
  const res = await executeTool(
    "bookAppointment",
    { doctorId: "DR01", slotId: 10, reason: "Check-up" },
    "I have a fever, book an appointment on Friday" // No explicit confirmation
  );

  expect(res.isError).toBeTruthy();
  const result = res.result as { success: boolean; error: { code: string } };
  expect(result.success).toBeFalsy();
  expect(result.error.code).toBe("CONFIRMATION_REQUIRED");
});

test("safeguard: rescheduleAppointment blocks execution when unconfirmed", async () => {
  const res = await executeTool(
    "rescheduleAppointment",
    { appointmentId: 1, newSlotId: 25 },
    "Move my appointment to tomorrow" // No explicit confirmation
  );

  expect(res.isError).toBeTruthy();
  const result = res.result as { success: boolean; error: { code: string } };
  expect(result.success).toBeFalsy();
  expect(result.error.code).toBe("CONFIRMATION_REQUIRED");
});

test("safeguard: cancelAppointment blocks execution when unconfirmed", async () => {
  const res = await executeTool(
    "cancelAppointment",
    { appointmentId: 1 },
    "I might want to cancel my visit" // No explicit confirmation
  );

  expect(res.isError).toBeTruthy();
  const result = res.result as { success: boolean; error: { code: string } };
  expect(result.success).toBeFalsy();
  expect(result.error.code).toBe("CONFIRMATION_REQUIRED");
});

// ─── Run All Tests ────────────────────────────────────────────────────────────

async function runAll() {
  for (const tc of tests) {
    try {
      await tc.run();
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
}

runAll();
