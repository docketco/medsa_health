// middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Password-gates the admin/data-import pages - these write straight to the
// database with no login screen of their own, so anyone with the URL could
// otherwise use them. Requires ADMIN_GATE_PASSWORD to be set in Vercel; if
// it isn't set, these pages are locked out entirely rather than left open.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'

export function middleware(req) {
  const password = process.env.ADMIN_GATE_PASSWORD
  if (!password) {
    return new NextResponse('Admin tools are not configured. Set ADMIN_GATE_PASSWORD in Vercel.', { status: 503 })
  }

  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6))
    const suppliedPassword = decoded.slice(decoded.indexOf(':') + 1)
    if (suppliedPassword === password) return NextResponse.next()
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Medsa Admin Tools"' },
  })
}

export const config = {
  matcher: ['/csv-import', '/import-doctors-csv', '/directory-import', '/seed-osm-clinics', '/content-manager'],
}
