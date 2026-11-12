-- =====================================================================
-- book_appointment.sql — Atomic booking RPC for CareSlot
-- =====================================================================
-- HOW TO RUN
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. Run against your DEVELOPMENT project only (the seed SQL drops tables)
--   4. Re-run safely at any time — CREATE OR REPLACE is idempotent
--
-- Called from TypeScript via:
--   adminDb.rpc('book_appointment', { p_patient_id, p_doctor_id, p_slot_id, p_reason })
--
-- CONCURRENCY GUARANTEE
--   The function body runs inside a single PostgreSQL transaction.
--   `SELECT ... FOR UPDATE` on the slot row acquires a row-level exclusive lock.
--   A second concurrent call on the same slot_id will BLOCK at that SELECT
--   until the first transaction commits or rolls back. After the first
--   commits with is_booked=true, the second will see is_booked=true and
--   return { ok: false, code: 'CONFLICT' } — exactly one booking succeeds.
--
-- SECURITY
--   SECURITY DEFINER: the function runs with the privileges of its owner
--   (the postgres superuser), bypassing RLS. This is intentional — the
--   service-role key already bypasses RLS; this keeps the execution model
--   consistent and means TypeScript doesn't need to issue multiple
--   round-trips that could leave state partially updated.
--
--   p_patient_id is supplied by the TypeScript server layer (always 'P001'),
--   NEVER from the LLM or the browser client.
-- =====================================================================

CREATE OR REPLACE FUNCTION book_appointment(
  p_patient_id  text,
  p_doctor_id   text,
  p_slot_id     bigint,
  p_reason      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- prevents search_path injection attacks
AS $$
DECLARE
  v_slot        slots%ROWTYPE;
  v_appt_id     bigint;
BEGIN
  -- ── Step 1: Acquire exclusive row-level lock on target slot ───────────────
  -- FOR UPDATE blocks any concurrent SELECT FOR UPDATE on the same row.
  -- If the slot row does not exist, v_slot is null and FOUND = false.
  SELECT *
  INTO   v_slot
  FROM   slots
  WHERE  id = p_slot_id
  FOR UPDATE;

  -- ── Step 2: Verify slot exists ────────────────────────────────────────────
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'NOT_FOUND',
      'message', format('Slot %s does not exist', p_slot_id)
    );
  END IF;

  -- ── Step 3: Verify slot belongs to the requested doctor ───────────────────
  IF v_slot.doctor_id <> p_doctor_id THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'DOCTOR_MISMATCH',
      'message', format(
        'Slot %s belongs to doctor %s, not %s',
        p_slot_id, v_slot.doctor_id, p_doctor_id
      )
    );
  END IF;

  -- ── Step 4: Verify slot is in the future (clinic-local date/time) ─────────
  -- current_date and current_time use the PostgreSQL server timezone.
  -- Supabase defaults to UTC; the application layer must pass future dates
  -- (IST date + time are both in the future, so UTC checks are conservative).
  IF (v_slot.slot_date < current_date)
  OR (v_slot.slot_date = current_date AND v_slot.start_time <= current_time)
  THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'SLOT_PAST',
      'message', format(
        'Slot %s on %s at %s is in the past',
        p_slot_id, v_slot.slot_date, v_slot.start_time
      )
    );
  END IF;

  -- ── Step 5: Verify slot is not already booked (THE CONCURRENCY GUARD) ─────
  -- After the FOR UPDATE lock, this is the definitive check. If two concurrent
  -- requests raced here, the loser now sees is_booked=true and returns CONFLICT.
  IF v_slot.is_booked THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'CONFLICT',
      'message', format('Slot %s is already booked', p_slot_id)
    );
  END IF;

  -- ── Step 6: Mark slot as booked ───────────────────────────────────────────
  UPDATE slots
  SET    is_booked = true
  WHERE  id = p_slot_id;

  -- ── Step 7: Create appointment record ────────────────────────────────────
  INSERT INTO appointments (patient_id, doctor_id, slot_id, reason, status)
  VALUES (p_patient_id, p_doctor_id, p_slot_id, p_reason, 'booked')
  RETURNING id INTO v_appt_id;

  -- ── Step 8: Return committed success payload ──────────────────────────────
  -- This RETURN only executes after both UPDATE and INSERT succeed.
  -- If anything above raised an exception the transaction rolls back
  -- automatically and no partial state is committed.
  RETURN jsonb_build_object(
    'ok',             true,
    'appointment_id', v_appt_id,
    'slot_id',        p_slot_id,
    'doctor_id',      p_doctor_id,
    'patient_id',     p_patient_id,
    'slot_date',      v_slot.slot_date::text,
    'start_time',     v_slot.start_time::text,
    'reason',         p_reason,
    'status',         'booked'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Catch unexpected errors (FK violation, etc.) and surface them cleanly
    -- without leaking internal Postgres error codes to the client.
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'DB_ERROR',
      'message', 'An unexpected database error occurred. Please try again.'
    );
END;
$$;

-- Grant execute permission to the postgres role used by Supabase service key
-- (adjust role name if your Supabase project uses a different role)
GRANT EXECUTE ON FUNCTION book_appointment(text, text, bigint, text)
  TO postgres, service_role;

