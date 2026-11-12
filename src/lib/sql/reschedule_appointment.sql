-- =====================================================================
-- reschedule_appointment.sql — Atomic reschedule RPC for CareSlot
-- =====================================================================
-- HOW TO RUN
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. Run against your DEVELOPMENT project only
--   4. Re-run safely at any time — CREATE OR REPLACE is idempotent
--
-- Called from TypeScript via:
--   adminDb.rpc('reschedule_appointment', { p_patient_id, p_appointment_id, p_new_slot_id })
--
-- CONCURRENCY & DEADLOCK PREVENTATIVE DESIGN
--   - Locks appointment row with FOR UPDATE.
--   - Verifies ownership (p_patient_id = 'P001') and status = 'booked'.
--   - Identifies old slot ID and new slot ID.
--   - Locks BOTH slots in consistent ascending ID order:
--       SELECT * FROM slots WHERE id = min_id FOR UPDATE;
--       SELECT * FROM slots WHERE id = max_id FOR UPDATE;
--     This prevents database deadlocks when two transactions concurrently
--     swap or modify the same pair of slots.
--   - Validates that new slot is in the future and is_booked = false.
--   - In one atomic step:
--       * sets old slot is_booked = false
--       * sets new slot is_booked = true
--       * updates appointment slot_id = p_new_slot_id
--       * updates appointment doctor_id = new_slot.doctor_id (keeps denormalized column synced)
--   - On any failure or exception, transaction rolls back automatically.
-- =====================================================================

CREATE OR REPLACE FUNCTION reschedule_appointment(
  p_patient_id      text,
  p_appointment_id  bigint,
  p_new_slot_id     bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt           appointments%ROWTYPE;
  v_old_slot_id    bigint;
  v_first_slot_id  bigint;
  v_second_slot_id bigint;
  v_slot_lock      slots%ROWTYPE;
  v_old_slot       slots%ROWTYPE;
  v_new_slot       slots%ROWTYPE;
  v_new_doc        doctors%ROWTYPE;
BEGIN
  -- ── Step 1: Acquire exclusive row lock on appointment ─────────────────────
  SELECT *
  INTO   v_appt
  FROM   appointments
  WHERE  id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'NOT_FOUND',
      'message', format('Appointment %s not found', p_appointment_id)
    );
  END IF;

  -- ── Step 2: Strict patient boundary check ─────────────────────────────────
  IF v_appt.patient_id <> p_patient_id THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'FORBIDDEN',
      'message', format('Appointment %s does not belong to patient %s', p_appointment_id, p_patient_id)
    );
  END IF;

  -- ── Step 3: Validate appointment status ───────────────────────────────────
  IF v_appt.status <> 'booked' THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'INVALID_STATUS',
      'message', format('Appointment %s is currently %s; only booked appointments can be rescheduled', p_appointment_id, v_appt.status)
    );
  END IF;

  v_old_slot_id := v_appt.slot_id;

  -- ── Step 4: Disallow moving to the exact same slot ────────────────────────
  IF v_old_slot_id = p_new_slot_id THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'SAME_SLOT',
      'message', format('Appointment %s is already booked for slot %s', p_appointment_id, p_new_slot_id)
    );
  END IF;

  -- ── Step 5: Lock both slots in consistent ascending order (deadlock prevention)
  IF v_old_slot_id < p_new_slot_id THEN
    v_first_slot_id  := v_old_slot_id;
    v_second_slot_id := p_new_slot_id;
  ELSE
    v_first_slot_id  := p_new_slot_id;
    v_second_slot_id := v_old_slot_id;
  END IF;

  -- Lock first slot
  SELECT * INTO v_slot_lock FROM slots WHERE id = v_first_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'SLOT_NOT_FOUND',
      'message', format('Slot %s not found', v_first_slot_id)
    );
  END IF;

  -- Lock second slot
  SELECT * INTO v_slot_lock FROM slots WHERE id = v_second_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'SLOT_NOT_FOUND',
      'message', format('Slot %s not found', v_second_slot_id)
    );
  END IF;

  -- Fetch the locked rows
  SELECT * INTO v_old_slot FROM slots WHERE id = v_old_slot_id;
  SELECT * INTO v_new_slot FROM slots WHERE id = p_new_slot_id;

  -- ── Step 6: Validate new slot is currently free ───────────────────────────
  IF v_new_slot.is_booked THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'CONFLICT',
      'message', format('Slot %s is already booked by another appointment', p_new_slot_id)
    );
  END IF;

  -- ── Step 7: Validate new slot is in the future ────────────────────────────
  IF (v_new_slot.slot_date < current_date)
  OR (v_new_slot.slot_date = current_date AND v_new_slot.start_time <= current_time)
  THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'SLOT_PAST',
      'message', format('Slot %s on %s at %s is in the past', p_new_slot_id, v_new_slot.slot_date, v_new_slot.start_time)
    );
  END IF;

  -- ── Step 8: Validate and fetch doctor for new slot ────────────────────────
  SELECT * INTO v_new_doc FROM doctors WHERE id = v_new_slot.doctor_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'DOCTOR_NOT_FOUND',
      'message', format('Doctor %s for slot %s does not exist', v_new_slot.doctor_id, p_new_slot_id)
    );
  END IF;

  -- ── Step 9: Execute atomic swap in single transaction ─────────────────────
  -- Free the old slot
  UPDATE slots SET is_booked = false WHERE id = v_old_slot_id;

  -- Reserve the new slot
  UPDATE slots SET is_booked = true WHERE id = p_new_slot_id;

  -- Update appointment record: update slot_id and keep doctor_id in sync
  UPDATE appointments
  SET    slot_id   = p_new_slot_id,
         doctor_id = v_new_slot.doctor_id
  WHERE  id = p_appointment_id;

  -- ── Step 10: Return updated confirmed details ─────────────────────────────
  RETURN jsonb_build_object(
    'ok',             true,
    'appointment_id', v_appt.id,
    'patient_id',     p_patient_id,
    'doctor_id',      v_new_slot.doctor_id,
    'doctor_name',    v_new_doc.name,
    'qualification',  v_new_doc.qualification,
    'room',           v_new_doc.room,
    'old_slot_id',    v_old_slot_id,
    'new_slot_id',    p_new_slot_id,
    'slot_date',      v_new_slot.slot_date::text,
    'start_time',     v_new_slot.start_time::text,
    'reason',         v_appt.reason,
    'status',         'booked'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'DB_ERROR',
      'message', 'An unexpected database error occurred during rescheduling.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION reschedule_appointment(text, bigint, bigint)
  TO postgres, service_role;

