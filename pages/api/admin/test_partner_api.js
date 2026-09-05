// One-click tester for the direct insurer API (/api/v1/eligibility,
// /api/v1/adjudicate) from inside medsa-admin's API Clients tab. Exists
// because the real audience for these routes (an insurer's own backend)
// calls them with a raw HTTP tool, but medsa-admin is a browser UI with no
// such tool available - this makes a genuine, unmocked server-to-server
// call to the real live route (same auth, same DB writes, same response)
// and hands the raw result back, so testing this API needs nothing more
// than clicking a button here.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { endpoint, apiKey, body } = req.body || {}
  if (!['eligibility', 'adjudicate'].includes(endpoint)) {
    return res.status(400).json({ status: 'ERROR', message: 'endpoint must be eligibility or adjudicate.' })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  try {
    const upstream = await fetch(`${siteUrl}/api/v1/${endpoint}`, {
      method: 'POST', headers, body: JSON.stringify(body || {}),
    })
    const data = await upstream.json().catch(() => ({}))
    return res.status(200).json({ status: 'OK', httpStatus: upstream.status, response: data })
  } catch (e) {
    return res.status(200).json({ status: 'ERROR', message: `Could not reach the live API route: ${e.message}` })
  }
}
