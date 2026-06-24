// ─────────────────────────────────────────────────────────────────────────────
// pages/_app.jsx
//
// This is the ROOT wrapper for the entire Medsa app.
// Every page in the app passes through here first.
// It loads the global CSS so styles apply everywhere.
//
// You generally don't need to touch this file unless you want to add
// something that appears on EVERY page (like an analytics script or a
// global error boundary).
// ─────────────────────────────────────────────────────────────────────────────

import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
