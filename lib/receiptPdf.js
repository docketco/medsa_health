// lib/receiptPdf.js
//
// Single source of truth for the consultation receipt and treatment plan
// receipt PDFs. Both ClinicOpsApp.jsx (staff side) and PatientApp.jsx
// (patient side) import these same functions, so a patient's downloaded
// receipt for a visit is exactly the same document the clinic downloads
// for it - not a simplified look-alike that drifts out of sync every
// time one side gets a formatting fix and the other doesn't.

// Fetches a clinic's uploaded receipt logo and decodes it into what
// jsPDF's addImage needs (a data URL, its pixel dimensions, and its
// format). Never throws - a broken/unreachable logo should degrade to
// the text-only header, not break receipt generation.
export async function loadLogoForPdf(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const { width, height } = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = reject
      img.src = dataUrl
    })
    if (!width || !height) return null
    const format = /^data:image\/png/i.test(dataUrl) ? 'PNG' : /^data:image\/(jpe?g)/i.test(dataUrl) ? 'JPEG' : /^data:image\/webp/i.test(dataUrl) ? 'WEBP' : null
    if (!format) return null
    return { dataUrl, format, aspect: width / height }
  } catch {
    return null
  }
}

const RECEIPT_COLORS = { GREEN: [0,98,65], GREEN_LIGHT: [234,243,239], GRAY: [110,110,110], GRAY_LIGHT: [246,246,244], INK: [26,26,26], BORDER: [222,220,214] }

function hexToRgb(hex) {
  if (!hex) return null
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n>>16)&255, (n>>8)&255, n&255]
}
// Blends a color toward white - used to derive the light background tint
// (e.g. the treatment-plan banner, the Amount Paid box) from whatever
// accent color the clinic picked, the same way GREEN_LIGHT is a light
// tint of GREEN.
function lightenColor([r,g,b], t=0.9) {
  return [Math.round(r+(255-r)*t), Math.round(g+(255-g)*t), Math.round(b+(255-b)*t)]
}
// A clinic can pick ANY color for the banner - including something pale
// (light yellow, white, pastel pink) that white text would be unreadable
// against. Rather than trust the choice blindly and risk an invisible
// "Amount Paid" figure, this picks white or dark ink text based on the
// color's actual brightness, the same way a UI would auto-pick readable
// text over a custom background.
function readableTextOn([r,g,b]) {
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255
  return luminance > 0.6 ? RECEIPT_COLORS.INK : [255,255,255]
}
function darkenColor([r,g,b], t) {
  return [Math.round(r*(1-t)), Math.round(g*(1-t)), Math.round(b*(1-t))]
}

// Resolves the accent color a clinic chose (or the default green) into
// everything the receipt needs: the solid accent, its light tint for
// backgrounds, a readable text color for text sitting on a solid fill of
// it, and a contrast-safe version of the accent for text/borders drawn
// IN the accent color (the "Amount Paid" figure, the treatment-plan
// banner). That last one matters because a pale accent (pastel yellow,
// white) has no contrast against its own light tint or the white page -
// text drawn in the raw accent color would be effectively invisible, so
// a pale accent gets darkened specifically for that use, while a
// already-dark accent (the common case) is used as-is.
function resolveBrandColors(institution) {
  const accent = hexToRgb(institution?.receipt_banner_color) || RECEIPT_COLORS.GREEN
  const accentLuminance = (0.299*accent[0] + 0.587*accent[1] + 0.114*accent[2]) / 255
  const headerText = readableTextOn(accent)
  const isWhiteText = headerText[0] === 255
  return {
    accent,
    accentLight: lightenColor(accent, 0.9),
    accentText: accentLuminance > 0.55 ? darkenColor(accent, 0.55) : accent,
    headerText,
    // The faint "Powered by Medsa Health" sub-line needs to fade toward
    // the header's own background, not always toward white - a dark
    // header (light accent, dark text) needs a faded dark gray instead.
    headerFade: isWhiteText ? [230,240,236] : [90,90,90],
  }
}

function drawReceiptHeader(doc, { pageWidth, left, right, clinicName, institution, logo, badgeText, receiptNo, dateStr, brand }) {
  doc.setFillColor(...brand.accent)
  doc.rect(0, 0, pageWidth, 34, 'F')
  doc.setTextColor(...brand.headerText)
  let textLeft = left
  if (logo) {
    // Cap width too, not just height - a wide/horizontal logo (a
    // wordmark-style aspect ratio) sized purely by height could push
    // the clinic name text into the right-aligned receipt number/date.
    let logoH = 20, logoW = logoH * logo.aspect
    if (logoW > 34) { logoW = 34; logoH = logoW / logo.aspect }
    doc.addImage(logo.dataUrl, logo.format, left, 7, logoW, logoH)
    textLeft = left + logoW + 5
  }
  doc.setFontSize(19); doc.setFont(undefined,'bold')
  doc.text(clinicName, textLeft, 15)
  doc.setFontSize(8.5); doc.setFont(undefined,'normal')
  const subLine = institution?.receipt_clinic_name
    ? [institution.receipt_address, institution.receipt_phone].filter(Boolean).join('  ·  ') || 'Powered by Medsa Health'
    : 'Digital health platform · medsa.health'
  doc.text(subLine, textLeft, 22)
  if (institution?.receipt_clinic_name) {
    doc.setFontSize(7.5); doc.setTextColor(...brand.headerFade)
    doc.text('Powered by Medsa Health', textLeft, 28)
    doc.setTextColor(...brand.headerText)
  }
  doc.setFontSize(13); doc.setFont(undefined,'bold')
  doc.text(badgeText, right, 14, {align:'right'})
  doc.setFontSize(9); doc.setFont(undefined,'normal')
  doc.text(receiptNo, right, 21, {align:'right'})
  doc.text(dateStr, right, 27, {align:'right'})
}

function triggerPdfDownload(doc, filename) {
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Builds and downloads the consultation (visit) receipt PDF.
// `transaction` - a row from `transactions` (patient_name, created_at, payment_method,
//   staff_name, patient_pays, insurer_covers, consultation_fee, treatment_plan_id, id).
// `record` - the linked `medical_records` row, or null.
// `medications` - array of medications for that record, or [].
// `treatmentPlan` - the linked treatment_plans row (plan_name, sessions_paid, sessions_used), or null.
// `institution` - the institutions row with receipt_* branding columns, or null.
export async function downloadConsultationReceiptPdf({ transaction: t, record, medications, treatmentPlan: plan, institution }) {
  const logo = await loadLogoForPdf(institution?.receipt_logo_url)
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const left = 18, right = pageWidth - 18
  const contentWidth = right - left
  const { GRAY, GRAY_LIGHT, INK, BORDER } = RECEIPT_COLORS
  const brand = resolveBrandColors(institution)
  const GREEN = brand.accent, GREEN_LIGHT = brand.accentLight
  const receiptNo = `RCPT-${t.id ? String(t.id).slice(0,8).toUpperCase() : new Date(t.created_at).getTime().toString(36).toUpperCase()}`
  const footerY = pageHeight - 16
  const clinicName = institution?.receipt_clinic_name || 'Medsa Health'

  function drawFooter() {
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
    doc.line(left, footerY-6, right, footerY-6)
    doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(...GRAY)
    doc.text(institution?.receipt_footer_note || `${clinicName} · System-generated receipt · No signature required`, left, footerY)
    doc.text(`Printed ${new Date().toLocaleString('en-HK',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}`, right, footerY, {align:'right'})
  }
  // Keeps content off the footer band, adding a fresh page (with its
  // own footer) if what's about to be drawn wouldn't fit.
  function ensureSpace(doc_y, needed) {
    if (doc_y + needed > footerY - 10) { drawFooter(); doc.addPage(); return 24 }
    return doc_y
  }

  drawReceiptHeader(doc, {
    pageWidth, left, right, clinicName, institution, logo, brand,
    badgeText: 'OFFICIAL RECEIPT', receiptNo,
    dateStr: new Date(t.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}),
  })

  let y = 46

  // ── Patient / visit summary card (dynamic height so a long diagnosis
  // never overlaps the row above it or spills past the card border) ──
  const colGap = left + contentWidth/2
  const cardTop = y
  function fieldPair(label, value, x, fy, maxW) {
    doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(...GRAY)
    doc.text(label.toUpperCase(), x, fy)
    doc.setFontSize(10.5); doc.setFont(undefined,'bold'); doc.setTextColor(...INK)
    const lines = maxW ? doc.splitTextToSize(String(value||'—'), maxW) : [String(value||'—')]
    doc.text(lines, x, fy+5)
    return lines.length
  }
  // Card height must match the actual field positions below (row1 label
  // at cardTop+11, row2 at +24, diagnosis row at +37).
  let cardH = 39
  if (record?.diagnosis) {
    const dLines = doc.splitTextToSize(record.diagnosis, contentWidth-16)
    cardH = 41 + dLines.length*5
  }
  doc.setFillColor(...GRAY_LIGHT)
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
  doc.roundedRect(left, cardTop, contentWidth, cardH, 2, 2, 'FD')
  let cy = cardTop + 11
  fieldPair('Patient', t.patient_name, left+8, cy)
  fieldPair('Payment method', (t.payment_method||'').replace(/_/g,' '), colGap, cy)
  cy += 13
  fieldPair('Attended by', t.staff_name, left+8, cy)
  fieldPair('Doctor', record?.doctor_name || '—', colGap, cy)
  cy += 13
  if (record?.diagnosis) fieldPair('Diagnosis', record.diagnosis, left+8, cy, contentWidth-16)
  y = cardTop + cardH + 10

  // ── Treatment plan usage banner - makes it explicit on the receipt
  // itself that this visit drew down a session from a plan. Keyed off
  // treatment_plan_id being set, NOT payment_method === 'treatment_plan' -
  // a visit that also collected a shortfall gets payment_method set to
  // however that shortfall was paid (card/cash/octopus), which used to
  // make this banner (and the "Covered by treatment plan" line below)
  // silently disappear even though a plan session really was used. ──
  if (t.treatment_plan_id && plan) {
    y = ensureSpace(y, 16)
    doc.setFillColor(...GREEN_LIGHT)
    doc.setDrawColor(...brand.accentText); doc.setLineWidth(0.3)
    doc.roundedRect(left, y, contentWidth, 14, 2, 2, 'FD')
    doc.setFontSize(9.5); doc.setFont(undefined,'bold'); doc.setTextColor(...brand.accentText)
    const remaining = (plan.sessions_paid||0) - (plan.sessions_used||0)
    doc.text(`1 session used from "${plan.plan_name}" · ${remaining} of ${plan.sessions_paid} sessions remaining`, left+6, y+9)
    y += 14 + 10
  }

  // Shared table renderer for both the charges and medications tables -
  // same striped-row look. measureRow is a pure height calculation (no
  // drawing) so a row's height is known before deciding whether it needs
  // a page break; drawRow does the actual drawing, called exactly once
  // per row at its final, post-page-break position.
  function sectionTable(title, headerCols, rows, measureRow, drawRow, emptyText) {
    y = ensureSpace(y, 20)
    doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(...INK)
    doc.text(title, left, y)
    y += 7
    doc.setFillColor(...GREEN)
    doc.rect(left, y-5.5, contentWidth, 8, 'F')
    doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(...brand.headerText)
    headerCols.forEach(([label,x,align]) => doc.text(label, x, y, align?{align}:undefined))
    y += 8
    doc.setTextColor(...INK)
    if (rows.length === 0) {
      doc.setFontSize(9.5); doc.setFont(undefined,'italic'); doc.setTextColor(...GRAY)
      doc.text(emptyText, left+3, y+1)
      doc.setTextColor(...INK)
      y += 9
    } else {
      rows.forEach((row,idx) => {
        const rowH = measureRow(row)
        y = ensureSpace(y, rowH)
        if (idx%2===1) { doc.setFillColor(...GRAY_LIGHT); doc.rect(left, y-4.5, contentWidth, rowH, 'F'); doc.setTextColor(...INK) }
        drawRow(row, idx, y)
        y += rowH
      })
    }
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
    doc.line(left, y, right, y)
    y += 10
  }

  // ── Itemized charges table ──
  const qtyX = right-58, priceX = right-32, amtX = right
  const items = record?.line_items || []
  sectionTable('Itemized Charges',
    [['DESCRIPTION', left+3], ['QTY', qtyX, 'right'], ['UNIT PRICE', priceX, 'right'], ['AMOUNT', amtX, 'right']],
    items,
    (item) => Math.max(doc.splitTextToSize(item.description||'—', contentWidth-70).length,1)*5 + 4,
    (item, idx, rowY) => {
      const descLines = doc.splitTextToSize(item.description||'—', contentWidth-70)
      doc.setFontSize(9.5); doc.setFont(undefined,'normal')
      doc.text(descLines, left+3, rowY)
      doc.text(String(item.qty||1), qtyX, rowY, {align:'right'})
      doc.text(`HK$${(item.fee||0).toFixed(2)}`, priceX, rowY, {align:'right'})
      doc.setFont(undefined,'bold')
      doc.text(`HK$${((item.fee||0)*(item.qty||1)).toFixed(2)}`, amtX, rowY, {align:'right'})
    },
    'No itemized charges are on file for this visit.'
  )

  // ── Medications prescribed table ──
  const doseX = right-95, qtyMedX = right-45, durX = right
  function medRowLineCount(med) {
    const nameLines = doc.splitTextToSize(med.medication_name||'—', doseX-left-6)
    const doseText = [med.dosage, med.frequency].filter(Boolean).join(' · ')
    const doseLines = doc.splitTextToSize(doseText||'—', qtyMedX-doseX-4)
    return Math.max(nameLines.length, doseLines.length, 1)
  }
  sectionTable('Medications Prescribed',
    [['MEDICATION', left+3], ['DOSAGE & FREQUENCY', doseX], ['QTY', qtyMedX, 'right'], ['DURATION', durX, 'right']],
    medications || [],
    (med) => medRowLineCount(med)*5 + 4,
    (med, idx, rowY) => {
      const nameLines = doc.splitTextToSize(med.medication_name||'—', doseX-left-6)
      const doseText = [med.dosage, med.frequency].filter(Boolean).join(' · ')
      const doseLines = doc.splitTextToSize(doseText||'—', qtyMedX-doseX-4)
      doc.setFontSize(9.5); doc.setFont(undefined,'normal')
      doc.text(nameLines, left+3, rowY)
      doc.text(doseLines, doseX, rowY)
      doc.text(String(med.quantity ?? '—'), qtyMedX, rowY, {align:'right'})
      doc.text(med.duration_days ? `${med.duration_days} days` : '—', durX, rowY, {align:'right'})
    },
    'No medications were prescribed at this visit.'
  )

  // ── Totals block ──
  const consultFee = record?.total_fee ?? t.consultation_fee ?? 0
  y = ensureSpace(y, 50)
  const totalsW = 78, totalsX = right-totalsW
  doc.setFontSize(9.5); doc.setFont(undefined,'normal'); doc.setTextColor(...GRAY)
  doc.text('Total charged', totalsX, y); doc.setTextColor(...INK); doc.text(`HK$${(consultFee||0).toFixed(2)}`, right, y, {align:'right'}); y += 6
  if (t.insurer_covers>0) {
    doc.setTextColor(...GRAY); doc.text('Covered by insurer', totalsX, y)
    doc.setTextColor(...INK); doc.text(`-HK$${(t.insurer_covers||0).toFixed(2)}`, right, y, {align:'right'}); y += 6
  }
  if (t.treatment_plan_id) {
    // The plan may not have covered the full visit (a shortfall is
    // collected separately when a visit costs more than the plan's
    // normal per-session value) - show what the plan actually covered,
    // not the whole visit cost, so this doesn't overstate the plan's
    // contribution when a shortfall was also collected.
    const coveredByPlan = Math.max(0, (consultFee||0) - (t.patient_pays||0))
    doc.setTextColor(...GRAY); doc.text('Covered by treatment plan', totalsX, y)
    doc.setTextColor(...INK); doc.text(`-HK$${coveredByPlan.toFixed(2)}`, right, y, {align:'right'}); y += 6
  }
  y += 2
  doc.setFillColor(...GREEN_LIGHT)
  doc.roundedRect(totalsX-6, y-6, totalsW+6, 14, 2, 2, 'F')
  doc.setFont(undefined,'bold'); doc.setFontSize(12); doc.setTextColor(...brand.accentText)
  doc.text('Amount Paid', totalsX, y+2)
  doc.text(`HK$${(t.patient_pays||0).toFixed(2)}`, right, y+2, {align:'right'})
  y += 20

  if (record?.notes) {
    y = ensureSpace(y, 20)
    doc.setFont(undefined,'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK)
    doc.text('Consultation notes', left, y); y += 6
    doc.setFont(undefined,'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY)
    const noteLines = doc.splitTextToSize(record.notes, contentWidth)
    y = ensureSpace(y, noteLines.length*5)
    doc.text(noteLines, left, y); y += noteLines.length*5
  }

  drawFooter()
  triggerPdfDownload(doc, `Medsa-Receipt-${(t.patient_name||'patient').replace(/[^a-z0-9]/gi,'_')}-${new Date(t.created_at).toISOString().slice(0,10)}.pdf`)
}

// Builds and downloads the treatment plan PURCHASE receipt PDF - a
// separate document from any individual visit's consultation receipt.
// `plan` - a `treatment_plans` row (optionally joined with patients(full_name)).
// `transaction` - the transaction row that recorded the plan purchase, or null.
// `institution` - the institutions row with receipt_* branding columns, or null.
export async function downloadTreatmentPlanReceiptPdf({ plan, transaction: txn, institution }) {
  const logo = await loadLogoForPdf(institution?.receipt_logo_url)
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const left = 18, right = pageWidth - 18
  const contentWidth = right - left
  const { GRAY, GRAY_LIGHT, INK, BORDER } = RECEIPT_COLORS
  const brand = resolveBrandColors(institution)
  const GREEN = brand.accent, GREEN_LIGHT = brand.accentLight
  const receiptNo = `PLAN-${plan.id ? String(plan.id).slice(0,8).toUpperCase() : new Date(plan.created_at).getTime().toString(36).toUpperCase()}`
  const footerY = pageHeight - 16
  const clinicName = institution?.receipt_clinic_name || 'Medsa Health'

  function drawFooter() {
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
    doc.line(left, footerY-6, right, footerY-6)
    doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(...GRAY)
    doc.text(institution?.receipt_footer_note || `${clinicName} · System-generated receipt · No signature required`, left, footerY)
    doc.text(`Printed ${new Date().toLocaleString('en-HK',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}`, right, footerY, {align:'right'})
  }

  drawReceiptHeader(doc, {
    pageWidth, left, right, clinicName, institution, logo, brand,
    badgeText: 'TREATMENT PLAN RECEIPT', receiptNo,
    dateStr: new Date(plan.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}),
  })

  let y = 46
  const colGap = left + contentWidth/2
  const cardTop = y
  const cardH = 46
  function fieldPair(label, value, x, fy) {
    doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(...GRAY)
    doc.text(label.toUpperCase(), x, fy)
    doc.setFontSize(10.5); doc.setFont(undefined,'bold'); doc.setTextColor(...INK)
    doc.text(String(value||'—'), x, fy+5)
  }
  doc.setFillColor(...GRAY_LIGHT)
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
  doc.roundedRect(left, cardTop, contentWidth, cardH, 2, 2, 'FD')
  let cy = cardTop + 11
  fieldPair('Patient', plan.patients?.full_name, left+8, cy)
  fieldPair('Treatment plan', plan.plan_name, colGap, cy)
  cy += 13
  fieldPair('Purchased by', txn?.staff_name, left+8, cy)
  fieldPair('Payment method', (txn?.payment_method||'').replace(/_/g,' '), colGap, cy)
  cy += 13
  fieldPair('Sessions included', `${plan.sessions_paid} sessions`, left+8, cy)
  fieldPair('Valid until', plan.expiry_date ? new Date(plan.expiry_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}) : 'No expiry', colGap, cy)
  y = cardTop + cardH + 12

  // ── Pricing breakdown ──
  doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(...INK)
  doc.text('Pricing', left, y)
  y += 9
  const hasSessionValue = plan.session_value != null
  const normalTotal = hasSessionValue ? plan.session_value * plan.sessions_paid : null
  doc.setFontSize(9.5)
  if (hasSessionValue) {
    doc.setFont(undefined,'normal'); doc.setTextColor(...GRAY)
    doc.text(`Normal price (${plan.sessions_paid} sessions × HK$${plan.session_value.toFixed(2)})`, left, y)
    doc.setTextColor(...INK); doc.text(`HK$${normalTotal.toFixed(2)}`, right, y, {align:'right'}); y += 6.5
    const discount = Math.max(0, normalTotal - (plan.price_total||0))
    if (discount > 0) {
      doc.setTextColor(...GRAY); doc.text('Package discount', left, y)
      doc.setTextColor(...brand.accentText); doc.text(`-HK$${discount.toFixed(2)}`, right, y, {align:'right'}); y += 6.5
    }
  } else {
    doc.setFont(undefined,'normal'); doc.setTextColor(...GRAY)
    doc.text('Package price', left, y)
    doc.setTextColor(...INK); doc.text(`HK$${(plan.price_total||0).toFixed(2)}`, right, y, {align:'right'}); y += 6.5
  }
  y += 3
  doc.setFillColor(...GREEN_LIGHT)
  doc.roundedRect(left, y-6, contentWidth, 14, 2, 2, 'F')
  doc.setFont(undefined,'bold'); doc.setFontSize(12); doc.setTextColor(...brand.accentText)
  doc.text('Amount Paid', left+6, y+2)
  doc.text(`HK$${(plan.price_total||0).toFixed(2)}`, right-6, y+2, {align:'right'})
  y += 20
  if (hasSessionValue && plan.sessions_paid) {
    doc.setFont(undefined,'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY)
    doc.text(`Works out to HK$${(plan.price_total/plan.sessions_paid).toFixed(2)} per session, vs. the normal HK$${plan.session_value.toFixed(2)} per session.`, left, y)
    y += 10
  }

  // ── How this plan works ──
  y += 4
  doc.setFillColor(...GRAY_LIGHT)
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
  const noteLines = doc.splitTextToSize('Each visit that uses a session from this plan will show on that visit\'s own consultation receipt, noting the session used and how many remain. This receipt only covers the purchase of the plan itself.', contentWidth-16)
  const noteBoxH = noteLines.length*5 + 10
  doc.roundedRect(left, y, contentWidth, noteBoxH, 2, 2, 'FD')
  doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(...GRAY)
  doc.text(noteLines, left+8, y+7)
  y += noteBoxH

  drawFooter()
  triggerPdfDownload(doc, `Medsa-TreatmentPlan-${(plan.patients?.full_name||'patient').replace(/[^a-z0-9]/gi,'_')}-${new Date(plan.created_at).toISOString().slice(0,10)}.pdf`)
}

const RECEIPT_BRANDING_COLUMNS = 'receipt_logo_url, receipt_clinic_name, receipt_address, receipt_phone, receipt_footer_note, receipt_banner_color'

// Convenience wrapper: given a supabase client and a transaction row,
// fetches everything downloadConsultationReceiptPdf needs (the linked
// medical record, its medications, the linked treatment plan, and the
// institution's receipt branding) and downloads it. Both apps call this
// rather than duplicating the fetch logic.
export async function fetchAndDownloadConsultationReceipt(supabase, transaction) {
  const [{ data: record }, { data: institution }, { data: plan }] = await Promise.all([
    transaction.medical_record_id
      ? supabase.from('medical_records').select('*').eq('id', transaction.medical_record_id).maybeSingle()
      : Promise.resolve({ data: null }),
    transaction.institution_id
      ? supabase.from('institutions').select(RECEIPT_BRANDING_COLUMNS).eq('id', transaction.institution_id).maybeSingle()
      : Promise.resolve({ data: null }),
    transaction.treatment_plan_id
      ? supabase.from('treatment_plans').select('plan_name, sessions_paid, sessions_used').eq('id', transaction.treatment_plan_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const { data: medications } = record
    ? await supabase.from('medications').select('medication_name, dosage, frequency, quantity, duration_days').eq('medical_record_id', record.id)
    : { data: [] }
  return downloadConsultationReceiptPdf({ transaction, record, medications, treatmentPlan: plan, institution })
}

// Convenience wrapper: given a supabase client and a treatment_plans id,
// fetches the plan (with patient name), its original purchase
// transaction, and the institution's receipt branding, then downloads
// the plan receipt. Re-fetches fresh rather than trusting whatever's
// already in caller state, so it works the same right after creating a
// plan or later from an ongoing-plans list, on either app.
export async function fetchAndDownloadTreatmentPlanReceipt(supabase, planId) {
  const { data: plan } = await supabase.from('treatment_plans').select('*, patients(full_name)').eq('id', planId).maybeSingle()
  if (!plan) return
  const [{ data: institution }, { data: txn }] = await Promise.all([
    plan.institution_id
      ? supabase.from('institutions').select(RECEIPT_BRANDING_COLUMNS).eq('id', plan.institution_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('transactions').select('*').eq('treatment_plan_id', planId).order('created_at', {ascending:true}).limit(1).maybeSingle(),
  ])
  return downloadTreatmentPlanReceiptPdf({ plan, transaction: txn, institution })
}
