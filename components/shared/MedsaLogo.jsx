// ─────────────────────────────────────────────────────────────────────────────
// components/shared/MedsaLogo.jsx
//
// The MEDSA LOGO — used in topbars across all three portals.
//
// Design spec:
//   - All lowercase letters
//   - Same x-height (no ascenders or descenders except the short d neck)
//   - Soft rounded curves — no sharp serifs or tails
//   - Open bowls on e and a
//   - Rounded humps on m, no tail
//   - Short neck on d
//   - Semi-transparent soft white when used on green backgrounds
//   - Accepts any color for use on light backgrounds (e.g. the landing page)
//
// Props:
//   height  — controls the rendered height in px (width scales automatically)
//   color   — fill colour (default: semi-transparent white for green topbars)
// ─────────────────────────────────────────────────────────────────────────────

export default function MedsaLogo({ height = 22, color = 'rgba(255,255,255,0.82)' }) {
  return (
    <svg
      height={height}
      viewBox="0 0 180 30"
      fill="none"
      style={{ display: 'block' }}
      aria-label="medsa"
    >
      {/* m — two rounded humps, same height, no tail */}
      <path
        d="M2 26L2 12Q2 7 7 7Q11 7 13 11Q15 7 19 7Q24 7 24 12L24 26L20 26L20 12Q20 10 18 10Q16 10 16 12L16 26L10 26L10 12Q10 10 8 10Q6 10 6 12L6 26Z"
        fill={color}
      />
      {/* e — open bowl counter */}
      <path
        d="M29 17Q29 7 37 7Q45 7 45 16L45 19L33 19Q34 23 37 23Q40 23 41 21L45 23Q43 27 37 27Q29 27 29 17ZM33 16L41 16Q41 11 37 11Q33 11 33 16Z"
        fill={color}
      />
      {/* d — short neck (just above x-height), round bowl */}
      <path
        d="M62 3L62 10Q60 7 56 7Q49 7 49 17Q49 27 56 27Q60 27 62 24L62 27L66 27L66 3ZM57 11Q61 11 62 15L62 19Q61 23 57 23Q53 23 53 17Q53 11 57 11Z"
        fill={color}
      />
      {/* s — soft curves */}
      <path
        d="M71 22L75 20Q76 24 80 24Q83 24 83 22Q83 20 79 19Q72 17 72 12Q72 7 79 7Q85 7 87 11L83 13Q82 10 79 10Q76 10 76 12Q76 14 80 15Q88 17 88 22Q88 27 80 27Q74 27 71 22Z"
        fill={color}
      />
      {/* a — open bowl, flat top, same x-height */}
      <path
        d="M93 12Q95 7 101 7Q108 7 108 13L108 27L104 27L104 25Q102 27 99 27Q94 27 94 22Q94 17 100 16L104 15L104 13Q104 11 101 11Q98 11 97 13ZM104 19L101 20Q98 21 98 23Q98 25 100 25Q103 25 104 23Z"
        fill={color}
      />
    </svg>
  )
}
