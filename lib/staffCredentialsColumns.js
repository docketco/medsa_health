// lib/staffCredentialsColumns.js
// ─────────────────────────────────────────────────────────────────────────────
// staff_credentials holds password/OTP secrets (pin, pin_hash,
// password_reset_otp_hash, device_otp_hash, and their sent_at/expires_at
// pairs) that the anon role is deliberately not granted SELECT on - see
// migration lock_down_credential_secrets. A plain `select('*')` from the
// browser now fails outright (Postgres errors the whole query if any
// selected column, wildcard included, isn't granted), so every client-side
// read of this table must name its columns explicitly. This is that list,
// kept in one place so it can't drift out of sync with the grant.
// ─────────────────────────────────────────────────────────────────────────────

export const STAFF_CREDENTIALS_SAFE_COLUMNS = [
  'id','institution_source','medsa_id','full_name','role','department','specialty',
  'registration_number','has_epc','epc_link','registration_expiry','verification_status',
  'last_verified_at','identity_doc_url','contract_url','qualification_doc_url',
  'registration_doc_url','insurance_type','insurance_provider','insurance_reg_number',
  'insurance_expiry','scrc_verified','scrc_verified_date','employment_type','schedule_type',
  'start_date','emergency_contact_name','emergency_contact_phone','supervisor_medsa_id',
  'status','onboarded_by','confirmed_by','offboarded_by','offboarded_at','created_at',
  'updated_at','disciplinary_status','disciplinary_notes','tier','specialty_type',
  'head_track','mchk_declaration_agreed','mchk_declaration_timestamp','languages_spoken',
  'fee_range_min','fee_range_max','affiliated_hospitals','sex','date_of_birth','schemes',
  'institution_id','is_nurse','practitioner_portal_enabled','practitioner_portal_granted_by',
  'practitioner_portal_granted_at','hkid','practitioner_identity_id','email','registering_body',
].join(',')
