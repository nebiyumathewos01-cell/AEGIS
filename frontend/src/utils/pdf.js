import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function generatePDF(reportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const { alert, parsed_data: pd, risk_factors, analysis, notes, report_generated_at } = reportData

  const pageW   = doc.internal.pageSize.getWidth()
  const margin  = 15
  const contentW = pageW - margin * 2

  // ── Helpers ────────────────────────────────────────────────────────────────
  let y = margin

  function checkPage(needed = 20) {
    if (y + needed > 275) { doc.addPage(); y = margin }
  }

  function heading1(text) {
    checkPage(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(30, 30, 30)
    doc.text(text, margin, y)
    y += 7
  }

  function heading2(text) {
    checkPage(12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(60, 60, 60)
    doc.text(text, margin, y)
    y += 5
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageW - margin, y)
    y += 4
  }

  function body(text, indent = 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    const lines = doc.splitTextToSize(text, contentW - indent)
    lines.forEach(line => {
      checkPage(5)
      doc.text(line, margin + indent, y)
      y += 4.5
    })
  }

  function kv(label, value) {
    if (!value && value !== 0) return
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(`${label}:`, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    doc.text(String(value), margin + 45, y)
    y += 5
  }

  function spacer(n = 4) { y += n }

  // ── Cover header ──────────────────────────────────────────────────────────
  doc.setFillColor(13, 17, 23)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(88, 166, 255)
  doc.text('AEGIS', margin, 12)
  doc.setFontSize(10)
  doc.setTextColor(139, 148, 158)
  doc.setFont('helvetica', 'normal')
  doc.text('Alert Evaluation & Guided Investigation System', margin, 19)
  doc.text(`Generated: ${new Date(report_generated_at).toLocaleString()}`, pageW - margin, 19, { align: 'right' })

  y = 36

  // ── Alert information ─────────────────────────────────────────────────────
  heading2('Alert Information')
  kv('Alert ID',       `#${alert.id}`)
  kv('Alert Type',     alert.alert_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
  kv('Source',         alert.source?.toUpperCase())
  kv('Source IP',      alert.source_ip)
  kv('Destination IP', alert.destination_ip)
  kv('Protocol',       alert.protocol)
  kv('Dest Port',      alert.destination_port)
  kv('Username',       alert.username)
  kv('Attempt Count',  alert.attempt_count)
  kv('Timestamp',      alert.timestamp ? new Date(alert.timestamp).toLocaleString() : null)
  kv('Status',         alert.status)
  spacer()

  // ── Risk score ────────────────────────────────────────────────────────────
  heading2('Risk Assessment')
  kv('Risk Score', `${Math.round(alert.risk_score)} / 100`)
  kv('Risk Level', alert.risk_level)
  spacer(2)

  if (risk_factors?.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Factor', 'Score']],
      body: risk_factors.map(f => [f.description, `+${f.score_delta}`]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 27, 34], textColor: [139, 148, 158], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', cellWidth: 18 } },
      margin: { left: margin, right: margin },
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // ── AI Analysis ───────────────────────────────────────────────────────────
  if (analysis) {
    checkPage(20)
    heading2('Incident Summary')
    body(analysis.summary)
    spacer()

    heading2('Threat Interpretation')
    body(analysis.threat_interpretation)
    spacer()

    heading2('Confirmed Evidence')
    body(analysis.evidence)
    spacer()

    heading2('Risk Explanation')
    body(analysis.risk_explanation)
    spacer()

    if (analysis.recommendations?.length > 0) {
      heading2('Recommended Investigation Steps')
      analysis.recommendations.forEach((r, i) => {
        body(`${i + 1}. ${r}`, 4)
      })
      spacer()
    }
  }

  // ── Analyst notes ─────────────────────────────────────────────────────────
  if (notes?.length > 0) {
    checkPage(20)
    heading2('Analyst Notes')
    notes.forEach(n => {
      body(`• [${new Date(n.created_at).toLocaleString()}] ${n.analyst}: ${n.note}`, 4)
    })
    spacer()
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(139, 148, 158)
    doc.text(
      `AEGIS · Alert #${alert.id} · Page ${i} of ${pageCount}`,
      pageW / 2, 290, { align: 'center' }
    )
  }

  doc.save(`aegis-report-${alert.id}.pdf`)
}
