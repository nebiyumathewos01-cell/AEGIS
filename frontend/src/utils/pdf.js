import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  bg:       [13,  17,  23],
  surface:  [22,  27,  34],
  border:   [48,  54,  61],
  text:     [230, 237, 243],
  muted:    [139, 148, 158],
  accent:   [88,  166, 255],
  low:      [63,  185, 80],
  medium:   [210, 153, 34],
  high:     [248, 81,  73],
  critical: [255, 0,   0],
  white:    [255, 255, 255],
}

function riskRGB(level) {
  const map = { LOW: C.low, MEDIUM: C.medium, HIGH: C.high, CRITICAL: C.critical }
  return map[level?.toUpperCase()] ?? C.low
}

function riskLabel(level) {
  return (level ?? 'UNKNOWN').toUpperCase()
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hex(rgb) {
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')
}

export function generatePDF(reportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const { alert, parsed_data: pd, risk_factors, analysis, notes, report_generated_at } = reportData

  const pageW  = doc.internal.pageSize.getWidth()   // 210
  const pageH  = doc.internal.pageSize.getHeight()  // 297
  const margin = 14
  const cw     = pageW - margin * 2                 // content width

  let y = 0

  // ── Utilities ────────────────────────────────────────────────────────────
  function newPage() {
    doc.addPage()
    y = margin + 6
    _drawPageFooter()
  }

  function checkY(needed = 18) {
    if (y + needed > pageH - 18) newPage()
  }

  function setFont(style = 'normal', size = 9, color = C.text) {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }

  function text(str, x, ty, opts = {}) {
    doc.text(str, x, ty, opts)
  }

  function body(str, indent = 0, color = C.text) {
    setFont('normal', 9, color)
    const lines = doc.splitTextToSize(str, cw - indent)
    lines.forEach(line => {
      checkY(5)
      text(line, margin + indent, y)
      y += 5
    })
  }

  function sectionTitle(title) {
    checkY(14)
    y += 3
    // Accent line
    doc.setFillColor(...C.accent)
    doc.rect(margin, y, 3, 6, 'F')
    setFont('bold', 11, C.text)
    text(title, margin + 6, y + 4.5)
    y += 10
    doc.setDrawColor(...C.border)
    doc.line(margin, y, pageW - margin, y)
    y += 4
  }

  function kv(label, value, labelW = 50) {
    if (value === null || value === undefined || value === '') return
    checkY(6)
    setFont('bold', 8.5, C.muted)
    text(String(label), margin, y)
    setFont('normal', 8.5, C.text)
    const lines = doc.splitTextToSize(String(value), cw - labelW)
    lines.forEach((line, i) => {
      if (i > 0) { checkY(5); y += 0 }
      text(line, margin + labelW, y)
      y += 5
    })
  }

  function spacer(n = 4) { y += n }

  function pill(label, rgb, tx, ty, w = 28) {
    doc.setFillColor(...rgb)
    doc.roundedRect(tx, ty - 4, w, 6, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...C.bg)
    doc.text(label, tx + w / 2, ty - 0.5, { align: 'center' })
  }

  // ── Page footer (drawn on every page after creation) ─────────────────────
  function _drawPageFooter() {
    const pg = doc.internal.getNumberOfPages()
    doc.setPage(pg)
    doc.setDrawColor(...C.border)
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12)
    setFont('normal', 7, C.muted)
    text(`AEGIS · Alert Evaluation & Guided Investigation System`, margin, pageH - 7)
    text(`Alert #${alert.id} · Confidential`, pageW / 2, pageH - 7, { align: 'center' })
    text(`Page ${pg}`, pageW - margin, pageH - 7, { align: 'right' })
  }

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════

  // Full-page dark background
  doc.setFillColor(...C.bg)
  doc.rect(0, 0, pageW, pageH, 'F')

  // Top accent bar
  doc.setFillColor(...C.accent)
  doc.rect(0, 0, pageW, 2, 'F')

  // Left accent stripe
  doc.setFillColor(...C.surface)
  doc.rect(0, 0, 8, pageH, 'F')
  doc.setFillColor(...C.accent)
  doc.rect(0, 0, 3, pageH, 'F')

  // AEGIS wordmark
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(42)
  doc.setTextColor(...C.accent)
  text('AEGIS', 28, 52)

  // Subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...C.muted)
  text('Alert Evaluation & Guided Investigation System', 28, 63)

  // Divider
  doc.setDrawColor(...C.border)
  doc.line(28, 70, pageW - 14, 70)

  // Report title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...C.text)
  text('INVESTIGATION REPORT', 28, 88)

  // Alert type
  const alertLabel = (alert.alert_type ?? 'Security Event')
    .replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(...C.muted)
  text(alertLabel, 28, 99)

  // Risk pill on cover
  const rRGB = riskRGB(alert.risk_level)
  pill(riskLabel(alert.risk_level), rRGB, 28, 115, 36)

  // Risk score visual
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(48)
  doc.setTextColor(...rRGB)
  text(String(Math.round(alert.risk_score)), pageW - 50, 118, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...C.muted)
  text('RISK SCORE / 100', pageW - 50, 126, { align: 'right' })

  // Risk bar
  const barX = 28, barY = 125, barW = 100, barH = 4
  doc.setFillColor(...C.surface)
  doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F')
  doc.setFillColor(...rRGB)
  doc.roundedRect(barX, barY, barW * (alert.risk_score / 100), barH, 1, 1, 'F')

  // Case metadata box
  const boxY = 148
  doc.setFillColor(...C.surface)
  doc.roundedRect(28, boxY, cw - 14, 64, 3, 3, 'F')
  doc.setDrawColor(...C.border)
  doc.roundedRect(28, boxY, cw - 14, 64, 3, 3, 'S')

  const metaItems = [
    ['Case ID',        `AEGIS-${String(alert.id).padStart(5, '0')}`],
    ['Alert Type',     alertLabel],
    ['Source',         (alert.source ?? '').toUpperCase()],
    ['Source IP',      alert.source_ip ?? 'N/A'],
    ['Risk Level',     riskLabel(alert.risk_level)],
    ['Status',         (alert.status ?? 'new').toUpperCase()],
    ['Timestamp',      alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'N/A'],
    ['Generated',      new Date(report_generated_at).toLocaleString()],
  ]

  const col1 = metaItems.slice(0, 4)
  const col2 = metaItems.slice(4)
  const colW = (cw - 14) / 2

  col1.forEach(([label, val], i) => {
    const ty = boxY + 10 + i * 13
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.muted)
    text(label.toUpperCase(), 36, ty)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.text)
    text(String(val), 36, ty + 5)
  })

  col2.forEach(([label, val], i) => {
    const tx = 28 + colW + 8
    const ty = boxY + 10 + i * 13
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.muted)
    text(label.toUpperCase(), tx, ty)
    const color = label === 'Risk Level' ? rRGB : C.text
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...color)
    text(String(val), tx, ty + 5)
  })

  // Cover footer
  doc.setDrawColor(...C.border)
  doc.line(28, pageH - 20, pageW - 14, pageH - 20)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.muted)
  text('AEGIS · Defensive Security Tool · For Authorized Use Only', 28, pageH - 13)
  text('CONFIDENTIAL', pageW - 14, pageH - 13, { align: 'right' })

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2 — ALERT DETAILS + RISK ASSESSMENT
  // ═══════════════════════════════════════════════════════════════
  doc.addPage()
  doc.setFillColor(255, 255, 255)  // white background for readability
  y = margin + 4
  _drawPageFooter()

  // ── Executive Summary box ──
  doc.setFillColor(240, 248, 255)
  doc.roundedRect(margin, y, cw, 22, 2, 2, 'F')
  doc.setDrawColor(...C.accent)
  doc.roundedRect(margin, y, cw, 22, 2, 2, 'S')
  doc.setFillColor(...C.accent)
  doc.rect(margin, y, 3, 22, 'F')

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.accent)
  text('EXECUTIVE SUMMARY', margin + 7, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(30, 30, 50)
  const summary = analysis?.summary ?? `${alertLabel} detected from ${alert.source_ip ?? 'unknown source'}. Risk level: ${riskLabel(alert.risk_level)} (${Math.round(alert.risk_score)}/100).`
  const sumLines = doc.splitTextToSize(summary, cw - 12)
  sumLines.slice(0, 2).forEach((l, i) => text(l, margin + 7, y + 13 + i * 5))
  y += 28

  // ── Alert Information ──
  sectionTitle('Alert Information')
  doc.setTextColor(30, 30, 30)

  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ['Case ID',       `AEGIS-${String(alert.id).padStart(5, '0')}`, 'Alert Type', alertLabel],
      ['Source',        (alert.source ?? '').toUpperCase(),            'Risk Level', riskLabel(alert.risk_level)],
      ['Source IP',     alert.source_ip ?? 'N/A',                     'Dest IP',    alert.destination_ip ?? 'N/A'],
      ['Protocol',      alert.protocol ?? 'N/A',                      'Dest Port',  String(alert.destination_port ?? 'N/A')],
      ['Username',      alert.username ?? 'N/A',                      'Attempts',   String(alert.attempt_count ?? 'N/A')],
      ['Status',        (alert.status ?? '').toUpperCase(),           'Timestamp',  alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'N/A'],
    ],
    styles: { fontSize: 8.5, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [80, 80, 100], cellWidth: 30 },
      1: { textColor: [20, 20, 20] },
      2: { fontStyle: 'bold', textColor: [80, 80, 100], cellWidth: 30 },
      3: { textColor: [20, 20, 20] },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
  })
  y = doc.lastAutoTable.finalY + 8

  // ── Risk Assessment ──
  sectionTitle('Risk Assessment')

  // Risk score visual
  checkY(20)
  doc.setFillColor(...rRGB)
  doc.roundedRect(margin, y, cw * (alert.risk_score / 100), 8, 2, 2, 'F')
  doc.setFillColor(220, 220, 220)
  doc.roundedRect(margin + cw * (alert.risk_score / 100), y,
    cw * (1 - alert.risk_score / 100), 8, 2, 2, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...rRGB)
  text(`${Math.round(alert.risk_score)}/100 — ${riskLabel(alert.risk_level)}`, margin, y - 2)
  y += 14

  // Risk factors table
  if (risk_factors?.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Rule', 'Factor Description', 'Score']],
      body: risk_factors.map(f => [
        f.rule?.replace(/_/g, ' ') ?? '',
        f.description,
        `+${f.score_delta}`
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: C.surface, textColor: C.muted, fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: 'bold', textColor: [60, 60, 80] },
        1: { textColor: [20, 20, 20] },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 16, textColor: rRGB },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ═══════════════════════════════════════════════════════════════
  // PAGE 3 — AI ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  if (analysis) {
    newPage()
    sectionTitle('AI Analysis')

    // Model badge
    doc.setFillColor(230, 245, 255)
    doc.roundedRect(margin, y, cw, 10, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...C.accent)
    const modelText = analysis.is_ai_generated
      ? `AI-Generated Analysis · Model: ${analysis.ai_model}`
      : `Rule-Based Analysis · No external AI required`
    text(modelText, margin + 4, y + 6.5)
    y += 15

    // Threat Interpretation
    checkY(12)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 60)
    text('Threat Interpretation', margin, y); y += 5
    body(analysis.threat_interpretation, 0, [30, 30, 50])
    spacer(4)

    // Evidence
    checkY(12)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 60)
    text('Confirmed Evidence', margin, y); y += 5
    doc.setFillColor(245, 248, 255)
    const evidenceLines = (analysis.evidence || '').split('\n').filter(l => l.trim())
    const evidenceH = evidenceLines.length * 5 + 8
    checkY(evidenceH)
    doc.roundedRect(margin, y, cw, evidenceH, 2, 2, 'F')
    doc.setDrawColor(200, 215, 240)
    doc.roundedRect(margin, y, cw, evidenceH, 2, 2, 'S')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 50)
    evidenceLines.forEach((line, i) => {
      text(line, margin + 5, y + 6 + i * 5)
    })
    y += evidenceH + 6

    // Risk explanation
    checkY(12)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 60)
    text('Risk Explanation', margin, y); y += 5
    body(analysis.risk_explanation, 0, [30, 30, 50])
    spacer(4)

    // Recommendations
    if (analysis.recommendations?.length > 0) {
      checkY(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 60)
      text('Recommended Investigation Steps', margin, y); y += 6

      analysis.recommendations.forEach((rec, i) => {
        checkY(14)
        // Step number circle
        doc.setFillColor(...C.accent)
        doc.circle(margin + 4, y + 1, 3.5, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.white)
        text(String(i + 1), margin + 4, y + 2.5, { align: 'center' })

        // Step text
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 50)
        const recLines = doc.splitTextToSize(rec, cw - 14)
        recLines.forEach((line, li) => {
          if (li > 0) { checkY(5) }
          text(line, margin + 12, y + (li === 0 ? 2 : li * 5 + 2))
        })
        y += Math.max(8, recLines.length * 5 + 2)
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PAGE 4 — NOTES + TIMELINE
  // ═══════════════════════════════════════════════════════════════
  const hasNotes = notes?.length > 0
  const hasTimeline = (reportData.alert?.raw_alert || '').split('\n').filter(l => l.trim()).length > 1

  if (hasNotes || hasTimeline) {
    newPage()

    if (hasNotes) {
      sectionTitle('Analyst Notes')
      notes.forEach(n => {
        checkY(18)
        doc.setFillColor(255, 252, 235)
        const noteLines = doc.splitTextToSize(n.note, cw - 10)
        const noteH = noteLines.length * 5 + 14
        doc.roundedRect(margin, y, cw, noteH, 2, 2, 'F')
        doc.setDrawColor(210, 180, 80)
        doc.roundedRect(margin, y, cw, noteH, 2, 2, 'S')
        doc.setFillColor(210, 180, 80)
        doc.rect(margin, y, 3, noteH, 'F')

        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(100, 80, 20)
        text(`${n.analyst} · ${new Date(n.created_at).toLocaleString()}`, margin + 6, y + 6)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(50, 40, 10)
        noteLines.forEach((line, i) => text(line, margin + 6, y + 12 + i * 5))
        y += noteH + 5
      })
      spacer(4)
    }

    if (hasTimeline) {
      sectionTitle('Event Timeline')
      const rawLines = (reportData.alert?.raw_alert || '')
        .split('\n').filter(l => l.trim()).slice(0, 20)

      rawLines.forEach((line, i) => {
        checkY(7)
        const timeMatch = line.match(/\d{2}:\d{2}:\d{2}/)
        const timeStr = timeMatch ? timeMatch[0] : `#${i + 1}`

        // Timeline dot and line
        doc.setFillColor(...C.accent)
        doc.circle(margin + 5, y + 1.5, 2, 'F')
        if (i < rawLines.length - 1) {
          doc.setDrawColor(...C.border)
          doc.line(margin + 5, y + 3.5, margin + 5, y + 7)
        }

        // Time
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.accent)
        text(timeStr, margin + 10, y + 3)

        // Line content
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(40, 40, 60)
        const stripped = line.replace(/\d{2}:\d{2}:\d{2}/, '').trim()
        const tLines = doc.splitTextToSize(stripped, cw - 32)
        tLines.forEach((tl, ti) => text(tl, margin + 32, y + 3 + ti * 4.5))
        y += Math.max(7, tLines.length * 4.5 + 3)
      })

      if (rawLines.length === 20) {
        checkY(6)
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...C.muted)
        text('... additional events truncated. See full raw log in the AEGIS platform.', margin + 10, y)
        y += 6
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Final footer on all pages
  // ═══════════════════════════════════════════════════════════════
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i)
    _drawPageFooter()
    // Re-stamp page number
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.muted)
    text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 7, { align: 'right' })
  }

  doc.save(`AEGIS-Report-${String(alert.id).padStart(5, '0')}.pdf`)
}
