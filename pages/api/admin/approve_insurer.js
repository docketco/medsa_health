// pages/api/admin/approve_insurer.js
// ─────────────────────────────────────────────────────────────────────────────
// Approves a pending partnered-insurer application (see
// /api/insurer/signup.js) - moves it to active and issues its first
// password in one call, same pattern as create_tpa_clinic.js. Gated by
// middleware.js's /api/admin/:path* match, same as every other admin route.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyId } = req.body || {}
  if (!companyId) return res.status(400).json({ status: 'ERROR', message: 'companyId is required.' })

  const { data: company, error: updErr } = await supabase.from('insurance_companies')
    .update({ status: 'active' }).eq('id', companyId).select().maybeSingle()
  if (updErr || !company) return res.status(500).json({ status: 'ERROR', message: updErr?.message || 'Company not found.' })

  const tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}!`
  const { error: pwErr } = await supabase.rpc('set_insurance_company_password', { p_company_id: company.id, p_new_password: tempPassword })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: `Approved but password could not be set: ${pwErr.message}` })

  return res.status(200).json({ status: 'OK', companyName: company.name, tempPassword })
}
