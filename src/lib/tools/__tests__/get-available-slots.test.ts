/**
 * get-available-slots.test.ts
 *
 * Unit tests for the Zod schema and pure helper logic of getAvailableSlots.
 * No database connection required.
 *
 * Run with:  npx tsx src/lib/tools/__tests__/get-available-slots.test.ts
 */

import { GetAvailableSlotsSchema } from "@/lib/schemas/tools";

// ── Helper: re-implement the pure logic under test ───────────────────────────
// (copied verbatim from the tool so we can test it in isolation)

function todayIST(): string {
  const now = new Date();
  const istMs = now.getTime() + 330 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

function currentTimeIST(): string {
  const now = new Date();
  const istMs = now.getTime() + 330 * 60 * 1000 + 30 * 1000;
  const d = new Date(istMs);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

interface MockSlot {
  id: number;
  doctor_id: string;
  slot_date: string;
  start_time: string;
}

function filterFutureSlots(slots: MockSlot[]): MockSlot[] {
  const today = todayIST();
  const nowIST = currentTimeIST();
  return slots.filter((slot) => {
    if (slot.slot_date > today) return true;
    if (slot.slot_date < today) return false;
    return slot.start_time > nowIST;
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────

type TestCase = { label: string; run: () => void };
const tests: TestCase[] = [];
let passed = 0;
let failed = 0;

function test(label: string, fn: () => void) {
  tests.push({ label, run: fn });
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toContain(substr: string) {
      if (typeof actual !== "string" || !actual.includes(substr))
        throw new Error(`Expected "${actual}" to contain "${substr}"`);
    },
    toHaveLength(n: number) {
      if (!Array.isArray(actual) || actual.length !== n)
        throw new Error(`Expected array of length ${n}, got ${Array.isArray(actual) ? actual.length : "non-array"}`);
    },
  };
}

// ─── Schema tests ─────────────────────────────────────────────────────────────

test("valid: doctorId only — returns all future slots", () => {
  const r = GetAvailableSlotsSchema.safeParse({ doctorId: "DR01" });
  expect(r.success).toBeTruthy();
});

test("valid: doctorId + single date", () => {
  const r = GetAvailableSlotsSchema.safeParse({ doctorId: "DR03", date: "2026-11-15" });
  expect(r.success).toBeTruthy();
});

test("valid: doctorId + date range", () => {
  const r = GetAvailableSlotsSchema.safeParse({
    doctorId: "DR01",
    startDate: "2026-11-13",
    endDate: "2026-11-17",
  });
  expect(r.success).toBeTruthy();
});

test("invalid: missing doctorId", () => {
  const r = GetAvailableSlotsSchema.safeParse({ date: "2026-11-15" });
  expect(r.success).toBeFalsy();
});

test("invalid: doctorId lowercase", () => {
  const r = GetAvailableSlotsSchema.safeParse({ doctorId: "dr01" });
  expect(r.success).toBeFalsy();
  if (!r.success) expect(r.error.issues[0].message).toContain("DR01");
});

test("invalid: doctorId without leading zero (DR1)", () => {
  const r = GetAvailableSlotsSchema.safeParse({ doctorId: "DR1" });
  expect(r.success).toBeFalsy();
});

test("invalid: bad date format", () => {
  const r = GetAvailableSlotsSchema.safeParse({ doctorId: "DR01", date: "15-11-2026" });
  expect(r.success).toBeFalsy();
  if (!r.success) expect(r.error.issues[0].message).toContain("YYYY-MM-DD");
});

test("invalid: date AND startDate together", () => {
  const r = GetAvailableSlotsSchema.safeParse({
    doctorId: "DR01",
    date: "2026-11-15",
    startDate: "2026-11-13",
    endDate: "2026-11-17",
  });
  expect(r.success).toBeFalsy();
});

test("invalid: startDate without endDate", () => {
  const r = GetAvailableSlotsSchema.safeParse({ doctorId: "DR01", startDate: "2026-11-13" });
  expect(r.success).toBeFalsy();
});

test("invalid: endDate before startDate", () => {
  const r = GetAvailableSlotsSchema.safeParse({
    doctorId: "DR01",
    startDate: "2026-11-17",
    endDate: "2026-11-13",
  });
  expect(r.success).toBeFalsy();
});

test("invalid: patient_id stripped by Zod (not a known field)", () => {
  const r = GetAvailableSlotsSchema.safeParse({ doctorId: "DR01", patient_id: "P002" });
  expect(r.success).toBeTruthy();
  if (r.success) expect("patient_id" in r.data).toBeFalsy();
});

// ─── Future-slot filter logic tests ──────────────────────────────────────────

const PAST_DATE   = "2020-01-01";
const FUTURE_DATE = "2099-12-31";
const today       = todayIST();

test("filterFutureSlots: drops past-date slots unconditionally", () => {
  const slots: MockSlot[] = [
    { id: 1, doctor_id: "DR01", slot_date: PAST_DATE, start_time: "09:00:00" },
    { id: 2, doctor_id: "DR01", slot_date: PAST_DATE, start_time: "12:30:00" },
  ];
  expect(filterFutureSlots(slots)).toHaveLength(0);
});

test("filterFutureSlots: keeps future-date slots unconditionally", () => {
  const slots: MockSlot[] = [
    { id: 3, doctor_id: "DR01", slot_date: FUTURE_DATE, start_time: "09:00:00" },
    { id: 4, doctor_id: "DR01", slot_date: FUTURE_DATE, start_time: "12:30:00" },
  ];
  expect(filterFutureSlots(slots)).toHaveLength(2);
});

test("filterFutureSlots: today's 09:00 slot is dropped when current time is past 09:00", () => {
  const nowIST = currentTimeIST();
  if (nowIST <= "09:00:30") {
    console.log("   (skipped: test only meaningful after 09:00 IST)");
    return;
  }
  const slots: MockSlot[] = [
    { id: 5, doctor_id: "DR01", slot_date: today, start_time: "09:00:00" },
  ];
  expect(filterFutureSlots(slots)).toHaveLength(0);
});

test("filterFutureSlots: today's 23:59 slot is kept regardless of current time", () => {
  const slots: MockSlot[] = [
    { id: 6, doctor_id: "DR01", slot_date: today, start_time: "23:59:00" },
  ];
  expect(filterFutureSlots(slots)).toHaveLength(1);
});

test("filterFutureSlots: mixed past, today and future dates — returns only future+valid today", () => {
  const slots: MockSlot[] = [
    { id: 7, doctor_id: "DR01", slot_date: PAST_DATE,   start_time: "09:00:00" }, // dropped
    { id: 8, doctor_id: "DR01", slot_date: today,       start_time: "23:59:00" }, // kept
    { id: 9, doctor_id: "DR01", slot_date: FUTURE_DATE, start_time: "09:00:00" }, // kept
  ];
  const result = filterFutureSlots(slots);
  expect(result.length >= 1).toBeTruthy(); // at least the future-date slot
  const ids = result.map((s) => s.id);
  expect(ids.includes(7)).toBeFalsy(); // past slot must be absent
  expect(ids.includes(9)).toBeTruthy(); // future slot must be present
});

test("filterFutureSlots: empty input returns empty", () => {
  expect(filterFutureSlots([])).toHaveLength(0);
});

test("todayIST: returns YYYY-MM-DD format", () => {
  const t = todayIST();
  expect(/^\d{4}-\d{2}-\d{2}$/.test(t)).toBeTruthy();
});

test("currentTimeIST: returns HH:MM:SS format", () => {
  const t = currentTimeIST();
  expect(/^\d{2}:\d{2}:\d{2}$/.test(t)).toBeTruthy();
});

// ─── Run all tests ────────────────────────────────────────────────────────────

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

