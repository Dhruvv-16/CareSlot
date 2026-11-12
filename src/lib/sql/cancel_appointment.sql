-- =====================================================================
-- cancel_appointment.sql — Atomic cancellation RPC for CareSlot
-- =====================================================================
-- HOW TO RUN
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. Run against your DEVELOPMENT project only
--   4. Re-run safely at any time — CREATE OR REPLACE is idempotent
--
-- Called from TypeScript via:
--   adminDb.rpc('cancel_appointment', { p_patient_id, p_appointment_id })
--
-- CONCURRENCY & INTEGRITY GUARANTEE
--   The function executes inside a single PostgreSQL transaction.
--   - SELECT ... FOR UPDATE locks the appointment row.
--   - Verifies the appointment belongs strictly to p_patient_id ('P001').
--   - Verifies current status is 'booked' (not 'cancelled' or 'completed').
--   - SELECT ... FOR UPDATE locks the linked slot row.
--   - Atomically updates appointment status to 'cancelled' and frees
--     the linked slot (is_booked = false).
--   - On any rejection or exception, no data is modified.
-- =====================================================================

CREATE OR REPLACE FUNCTION cancel_appointment(
  p_patient_id      text,
  p_appointment_id  bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt   appointments%ROWTYPE;
  v_slot   slots%ROWTYPE;
  v_doc    doctors%ROWTYPE;
BEGIN
  -- ── Step 1: Acquire exclusive row-level lock on appointment ───────────────
  SELECT *
  INTO   v_appt
  FROM   appointments
  WHERE  id = p_appointment_id
  FOR UPDATE;

  -- ── Step 2: Verify appointment exists ─────────────────────────────────────
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'NOT_FOUND',
      'message', format('Appointment %s not found', p_appointment_id)
    );
  END IF;

  -- ── Step 3: Verify appointment belongs to caller patient (P001) ───────────
  -- Strict cross-patient boundary: never allow modifying another patient's data
  IF v_appt.patient_id <> p_patient_id THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'FORBIDDEN',
      'message', format('Appointment %s does not belong to patient %s', p_appointment_id, p_patient_id)
    );
  END IF;

  -- ── Step 4: Verify appointment is currently 'booked' ──────────────────────
  IF v_appt.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'ALREADY_CANCELLED',
      'message', format('Appointment %s has already been cancelled', p_appointment_id)
    );
  END IF;

  IF v_appt.status = 'completed' THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'ALREADY_COMPLETED',
      'message', format('Appointment %s has already been completed and cannot be cancelled', p_appointment_id)
    );
  END IF;

  IF v_appt.status <> 'booked' THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'INVALID_STATUS',
      'message', format('Appointment %s status is %s, expected booked', p_appointment_id, v_appt.status)
    );
  END IF;

  -- ── Step 5: Lock linked slot and verify existence ─────────────────────────
  SELECT *
  INTO   v_slot
  FROM   slots
  WHERE  id = v_appt.slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'SLOT_NOT_FOUND',
      'message', format('Linked slot %s for appointment %s not found', v_appt.slot_id, p_appointment_id)
    );
  END IF;

  -- Fetch doctor details for confirmation receipt
  SELECT *
  INTO   v_doc
  FROM   doctors
  WHERE  id = v_appt.doctor_id;

  -- ── Step 6: Atomic update — mark cancelled and free slot ──────────────────
  UPDATE appointments
  SET    status = 'cancelled'
  WHERE  id = p_appointment_id;

  UPDATE slots
  SET    is_booked = false
  WHERE  id = v_appt.slot_id;

  -- ── Step 7: Return updated details ────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',              true,
    'appointment_id',  v_appt.id,
    'patient_id',      p_patient_id,
    'doctor_id',       v_appt.doctor_id,
    'doctor_name',     v_doc.name,
    'slot_id',         v_appt.slot_id,
    'slot_date',       v_slot.slot_date::text,
    'start_time',      v_slot.start_time::text,
    'reason',          v_appt.reason,
    'previous_status', 'booked',
    'status',          'cancelled',
    'cancelled_at',    now()::text
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'code',    'DB_ERROR',
      'message', 'An unexpected database error occurred during cancellation.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_appointment(text, bigint)
  TO postgres, service_role;

