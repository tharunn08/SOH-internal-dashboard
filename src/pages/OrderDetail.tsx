}

function buildInvoiceMessage(order: Order) {
  const lines = order.order_items?.map(
    (i) => `${i.product?.name} x${i.quantity} — ${formatCurrency(i.total_price)}`
  ) ?? []
  return [
    `Sake of Health — Invoice ${order.order_code}`,
    formatDateTime(order.order_date),
    '',
    ...lines,
    '',
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Discount: -${formatCurrency(order.discount)}`,
    `Total: ${formatCurrency(order.total_amount)}`,
    `Payment: ${order.payment_method} (${order.payment_status})`,
    '',
    'Thank you for shopping with Sake of Health!',
  ].join('\n')
}


function downloadInvoicePdf(order: Order) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 16
  const green: [number, number, number] = [89, 133, 55]
  const orange: [number, number, number] = [191, 77, 34]

  doc.setFillColor(248, 250, 246)
  doc.rect(0, 0, pageWidth, 47, 'F')
  doc.addImage(logoDataUrl, 'PNG', margin, 9, 28, 28)
  doc.setTextColor(...green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.text('Sake of Health', margin + 34, 19)
  doc.setTextColor(92, 101, 92)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Ixitek Healthcare and Wellness Pvt. Ltd.', margin + 34, 26)
  doc.setTextColor(...orange)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('SALES INVOICE', margin + 34, 34)

  doc.setTextColor(40, 46, 42)
  doc.setFontSize(10)
  doc.text(`Invoice: ${order.order_code}`, pageWidth - margin, 18, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(formatDateTime(order.order_date), pageWidth - margin, 25, { align: 'right' })
  doc.setTextColor(order.payment_status === 'paid' ? 45 : 160, order.payment_status === 'paid' ? 112 : 95, 58)
  doc.setFont('helvetica', 'bold')
  doc.text(`PAYMENT: ${order.payment_status.toUpperCase()}`, pageWidth - margin, 33, { align: 'right' })

  let y = 58
  doc.setTextColor(92, 101, 92)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('CUSTOMER', margin, y)
  doc.text('SALE CHANNEL / EVENT', pageWidth / 2 + 4, y)
  doc.setTextColor(40, 46, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(String(order.customer?.name || '—'), margin, y + 6)
  doc.text(String(order.customer?.phone || '—'), margin, y + 12)
  doc.text(String(order.event?.name ?? '— Direct sale —'), pageWidth / 2 + 4, y + 6)

  autoTable(doc, {
    startY: y + 21,
    margin: { left: margin, right: margin },
    head: [['Product', 'Qty', 'Unit Price', 'Total']],
    body: (order.order_items || []).map(item => [
      String(item.product?.name || 'Product'),
      String(item.quantity),
      formatCurrency(item.unit_price),
      formatCurrency(item.total_price),
    ]),
    theme: 'striped',
    headStyles: { fillColor: green, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 245] },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3.5, textColor: [40, 46, 42] },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'center', cellWidth: 18 }, 2: { halign: 'right', cellWidth: 33 }, 3: { halign: 'right', cellWidth: 33 } },
  })

  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110
  let totalY = tableEnd + 12
  if (totalY > 245) { doc.addPage(); totalY = 24 }
  const right = pageWidth - margin
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(92, 101, 92)
  doc.text('Subtotal', right - 55, totalY)
  doc.text(formatCurrency(order.subtotal), right, totalY, { align: 'right' })
  doc.text('Discount', right - 55, totalY + 7)
  doc.text(`-${formatCurrency(order.discount)}`, right, totalY + 7, { align: 'right' })
  doc.setDrawColor(218, 226, 214)
  doc.line(right - 58, totalY + 11, right, totalY + 11)
  doc.setTextColor(...green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Total', right - 55, totalY + 20)
  doc.text(formatCurrency(order.total_amount), right, totalY + 20, { align: 'right' })
  doc.setTextColor(92, 101, 92)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Payment: ${order.payment_method} (${order.payment_status})`, margin, totalY + 20)
  if (order.notes) {
    doc.setFontSize(8.5)
    const noteLines = doc.splitTextToSize(`Notes: ${order.notes}`, pageWidth - margin * 2)
    doc.text(noteLines, margin, totalY + 31)
  }
  const footerY = Math.min(doc.internal.pageSize.getHeight() - 15, totalY + 43)
  doc.setDrawColor(218, 226, 214)
  doc.line(margin, footerY - 7, pageWidth - margin, footerY - 7)
  doc.setTextColor(...green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Thank you for shopping with Sake of Health!', pageWidth / 2, footerY, { align: 'center' })
  doc.save(`Sake-of-Health-Invoice-${order.order_code}.pdf`)
}
