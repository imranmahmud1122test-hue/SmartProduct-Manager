import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Business, InventoryMovement, Product, Sale } from '../types';
import { formatCurrency, formatDate, formatShortDate, renderBarcodeToCanvas, generateQRCodeDataUrl } from './codeGenerators';

/**
 * Downloads a DOM element directly as a high-resolution PDF file.
 * Handles Tailwind CSS v4 oklch() color functions gracefully via onclone sanitization.
 */
export async function exportElementAsPDF(
  elementOrId: HTMLElement | string,
  filename: string = 'document.pdf'
): Promise<void> {
  try {
    let element: HTMLElement | null = null;
    if (typeof elementOrId === 'string') {
      element = document.getElementById(elementOrId);
    } else {
      element = elementOrId;
    }

    if (!element) {
      console.warn('PDF export element not found, falling back to window.print()');
      window.print();
      return;
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc) => {
        // 1. Sanitize all <style> tags in cloned document to remove oklch/oklab color functions
        const styleTags = clonedDoc.querySelectorAll('style');
        styleTags.forEach((styleTag) => {
          if (styleTag.textContent) {
            styleTag.textContent = styleTag.textContent
              .replace(/oklch\([^)]+\)/gi, '#0f172a')
              .replace(/oklab\([^)]+\)/gi, '#0f172a');
          }
        });

        // 2. Sanitize all inline styles on elements in cloned document
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((node) => {
          const htmlEl = node as HTMLElement;
          const styleAttr = htmlEl.getAttribute('style');
          if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('oklab'))) {
            htmlEl.setAttribute(
              'style',
              styleAttr
                .replace(/oklch\([^)]+\)/gi, 'inherit')
                .replace(/oklab\([^)]+\)/gi, 'inherit')
            );
          }
        });
      },
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    const pdfName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(pdfName);
  } catch (err) {
    console.error('Error rendering PDF with html2canvas:', err);
    window.print();
  }
}

/**
 * Generates a clean 80mm vector thermal receipt directly in jsPDF (no canvas required).
 */
export function generateSaleReceiptPDF(
  sale: Sale,
  business: Business | null,
  filename?: string
): void {
  try {
    const currency = business?.currencySymbol || '৳';
    const bName = business?.name || 'Smart Product Manager';
    const bAddress = business?.address || 'Supermarket Address';
    const bPhone = business?.phone ? `Tel: ${business.phone}` : '';

    const baseHeight = 130 + sale.items.length * 12;
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, Math.max(150, baseHeight)],
    });

    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.text(bName.toUpperCase(), 40, 10, { align: 'center' });

    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    let y = 15;

    if (bAddress) {
      doc.text(bAddress, 40, y, { align: 'center' });
      y += 4.5;
    }
    if (bPhone) {
      doc.text(bPhone, 40, y, { align: 'center' });
      y += 4.5;
    }

    y += 1;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(5, y, 75, y);
    y += 5;

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.text(`INVOICE #${sale.invoiceNumber}`, 40, y, { align: 'center' });
    y += 4.5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(`Date: ${formatDate(sale.createdAt)}`, 40, y, { align: 'center' });
    y += 4;
    doc.text(`Cashier: ${sale.cashierName}`, 40, y, { align: 'center' });
    y += 5;

    doc.line(5, y, 75, y);
    y += 5;

    // Table Header
    doc.setFont('courier', 'bold');
    doc.text('ITEM / QTY', 5, y);
    doc.text('AMOUNT', 75, y, { align: 'right' });
    y += 4;
    doc.line(5, y, 75, y);
    y += 5;

    // Items
    doc.setFont('courier', 'normal');
    sale.items.forEach((item) => {
      const name = item.productName.length > 22 ? item.productName.substring(0, 20) + '..' : item.productName;
      doc.text(name, 5, y);
      doc.text(formatCurrency(item.subtotal, currency), 75, y, { align: 'right' });
      y += 4;
      doc.setFontSize(7.5);
      doc.text(`${item.quantity} x ${formatCurrency(item.unitPrice, currency)}`, 7, y);
      doc.setFontSize(8);
      y += 5;
    });

    doc.line(5, y, 75, y);
    y += 5;

    // Summary Totals
    doc.text('Subtotal:', 5, y);
    doc.text(formatCurrency(sale.subtotal, currency), 75, y, { align: 'right' });
    y += 4.5;

    if (sale.discount > 0) {
      doc.text('Discount:', 5, y);
      doc.text(`-${formatCurrency(sale.discount, currency)}`, 75, y, { align: 'right' });
      y += 4.5;
    }

    doc.text(`Tax (${business?.taxRate || 0}%):`, 5, y);
    doc.text(formatCurrency(sale.tax, currency), 75, y, { align: 'right' });
    y += 5;

    doc.line(5, y, 75, y);
    y += 5;

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.text('TOTAL PAID:', 5, y);
    doc.text(formatCurrency(sale.totalAmount, currency), 75, y, { align: 'right' });
    y += 5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(`Payment: ${sale.paymentMethod.toUpperCase()}`, 5, y);
    y += 4;

    if (sale.changeAmount > 0) {
      doc.text(`Change: ${formatCurrency(sale.changeAmount, currency)}`, 5, y);
      y += 4;
    }

    y += 2;
    doc.line(5, y, 75, y);
    y += 5;

    doc.setFontSize(8);
    doc.text('Thank you for shopping with us!', 40, y, { align: 'center' });

    const pdfName = filename || `Receipt_${sale.invoiceNumber}.pdf`;
    doc.save(pdfName);
  } catch (err) {
    console.error('Error generating native sale receipt PDF:', err);
    window.print();
  }
}

/**
 * Renders HTML string to a PDF and downloads it.
 */
export async function downloadHtmlAsPDF(htmlContent: string, filename: string = 'document.pdf'): Promise<void> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // ~A4 width at 96dpi
  container.style.background = '#ffffff';
  container.style.color = '#000000';
  container.style.padding = '24px';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    await exportElementAsPDF(container, filename);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Executes a clean, isolated print job using a dedicated hidden iframe.
 * This completely isolates the print document from the host web app,
 * preventing modal dark backdrops, background page bleed, or cut-offs.
 */
export function printDocument(htmlContent: string, title: string = 'Print Document'): void {
  const printableHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      margin: 8mm;
      size: auto;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    @media print {
      body {
        padding: 0;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  ${htmlContent}
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;

  // Try opening a pop-up window first (triggers Chrome's native system print preview dialog reliably)
  let printWin: Window | null = null;
  try {
    printWin = window.open('', '_blank', 'width=900,height=750,top=80,left=120');
  } catch (err) {
    console.warn('Could not open print window directly:', err);
  }

  if (printWin) {
    try {
      printWin.document.open();
      printWin.document.write(printableHtml);
      printWin.document.close();
      printWin.focus();

      // Additional fallback print trigger
      setTimeout(() => {
        try {
          if (printWin && !printWin.closed) {
            printWin.focus();
            printWin.print();
          }
        } catch (e) {
          console.warn('Direct print window trigger:', e);
        }
      }, 350);
      return;
    } catch (e) {
      console.warn('Failed writing to print window, falling back to overlay container:', e);
    }
  }

  // Fallback: If popups are blocked by browser iframe policies, inject printable overlay container
  try {
    const existing = document.getElementById('spm-print-container');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const container = document.createElement('div');
    container.id = 'spm-print-container';
    container.className = 'spm-print-only-container';
    container.innerHTML = `
      <style>
        @media screen {
          .spm-print-only-container {
            position: fixed;
            inset: 0;
            z-index: 999999;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            overflow: auto;
          }
          .spm-print-paper {
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            max-width: 850px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 24px;
            position: relative;
          }
          .spm-print-header-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e2e8f0;
          }
          .spm-print-btn-main {
            background: #047857;
            color: #ffffff;
            font-weight: 700;
            font-size: 13px;
            padding: 8px 18px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .spm-print-btn-close {
            background: #cbd5e1;
            color: #0f172a;
            font-weight: 600;
            font-size: 13px;
            padding: 8px 14px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
          }
        }
        @media print {
          body > *:not(.spm-print-only-container) {
            display: none !important;
          }
          .spm-print-only-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .spm-print-header-bar {
            display: none !important;
          }
          .spm-print-paper {
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
          }
        }
      </style>
      <div class="spm-print-paper">
        <div class="spm-print-header-bar">
          <div style="font-weight: 700; font-size: 14px; color: #0f172a;">${title}</div>
          <div style="display: flex; gap: 8px;">
            <button class="spm-print-btn-main" onclick="window.print()">
              🖨️ Open Native Print Dialog / Save PDF
            </button>
            <button class="spm-print-btn-close" onclick="document.getElementById('spm-print-container').remove()">
              Close
            </button>
          </div>
        </div>
        <div class="spm-print-body-content">
          ${htmlContent}
        </div>
      </div>
    `;

    document.body.appendChild(container);

    setTimeout(() => {
      window.print();
    }, 200);
  } catch (err) {
    console.error('Print container fallback failed:', err);
    window.print();
  }
}

/**
 * Generates an authentic, crisp 80mm / thermal paper formatted POS receipt
 */
export function printThermalReceipt(
  sale: Sale,
  business: Business | null,
  cashierName?: string
): void {
  const currency = business?.currencySymbol || '৳';
  const bName = business?.name || 'Smart Product Manager';
  const bAddress = business?.address || 'Retail Store Address';
  const bPhone = business?.phone || '';

  // Generate invoice barcode as a data URL on a hidden canvas
  let barcodeDataUrl = '';
  try {
    const canvas = document.createElement('canvas');
    renderBarcodeToCanvas(canvas, sale.invoiceNumber, 'CODE128');
    barcodeDataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Could not generate receipt barcode:', e);
  }

  const itemsRows = sale.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px dashed #cbd5e1;">
        <td style="padding: 6px 0; vertical-align: top;">
          <div style="font-weight: 700; font-size: 13px;">${item.productName}</div>
          <div style="font-size: 11px; color: #475569;">${item.quantity} × ${formatCurrency(item.unitPrice, currency)}</div>
        </td>
        <td style="padding: 6px 0; text-align: right; vertical-align: top; font-weight: 700; font-size: 13px;">
          ${formatCurrency(item.subtotal, currency)}
        </td>
      </tr>
    `
    )
    .join('');

  const receiptHtml = `
    <div style="width: 320px; max-width: 100%; margin: 0 auto; font-family: 'Courier New', Courier, monospace; color: #000; line-height: 1.35; padding: 12px; background: #fff;">
      <!-- Store Header -->
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">${bName}</h2>
        <div style="font-size: 11px; color: #333; margin-top: 3px;">${bAddress}</div>
        ${bPhone ? `<div style="font-size: 11px; color: #333;">Tel: ${bPhone}</div>` : ''}
        <div style="margin-top: 8px; font-size: 11px; font-weight: 700; border-top: 1px dashed #666; padding-top: 6px;">
          <div>INVOICE #${sale.invoiceNumber}</div>
          <div style="font-weight: normal; font-size: 10px; color: #444;">${formatDate(sale.createdAt)}</div>
        </div>
      </div>

      <!-- Line Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
        <thead>
          <tr style="border-bottom: 1px solid #000; text-align: left; font-size: 11px;">
            <th style="padding-bottom: 4px;">ITEM / QTY</th>
            <th style="padding-bottom: 4px; text-align: right;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <!-- Financial Calculation Summary -->
      <div style="border-top: 1px dashed #000; padding-top: 8px; margin-bottom: 12px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Subtotal:</span>
          <span>${formatCurrency(sale.subtotal, currency)}</span>
        </div>
        ${
          sale.discount > 0
            ? `<div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span>Discount:</span>
                <span>-${formatCurrency(sale.discount, currency)}</span>
              </div>`
            : ''
        }
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>Tax (${business?.taxRate || 0}%):</span>
          <span>${formatCurrency(sale.tax, currency)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; margin: 6px 0;">
          <span>TOTAL PAID:</span>
          <span>${formatCurrency(sale.totalAmount, currency)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px;">
          <span>Payment Method:</span>
          <span style="font-weight: 700; text-transform: uppercase;">${sale.paymentMethod.replace('_', ' ')}</span>
        </div>
        ${
          sale.paymentMethod === 'cash' && sale.receivedAmount
            ? `<div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span>Cash Tendered:</span>
                <span>${formatCurrency(sale.receivedAmount, currency)}</span>
              </div>`
            : ''
        }
        ${
          sale.changeAmount && sale.changeAmount > 0
            ? `<div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700;">
                <span>Change Returned:</span>
                <span>${formatCurrency(sale.changeAmount, currency)}</span>
              </div>`
            : ''
        }
      </div>

      <!-- Customer Details if attached -->
      ${
        sale.customerName
          ? `<div style="font-size: 10px; border-top: 1px dashed #999; padding-top: 6px; margin-bottom: 8px;">
              <div>Customer: <strong>${sale.customerName}</strong></div>
              ${sale.customerPhone ? `<div>Phone: ${sale.customerPhone}</div>` : ''}
            </div>`
          : ''
      }

      <!-- Barcode Representation for return / verification -->
      ${
        barcodeDataUrl
          ? `<div style="text-align: center; margin: 12px 0 6px 0;">
              <img src="${barcodeDataUrl}" alt="${sale.invoiceNumber}" style="max-width: 90%; height: auto;" />
            </div>`
          : ''
      }

      <!-- Footer Messages -->
      <div style="text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 8px; font-size: 11px;">
        <div style="font-weight: 700;">Thank you for your purchase!</div>
        <div style="font-size: 10px; color: #555; margin-top: 3px;">Please retain this receipt for warranty or exchange.</div>
        <div style="font-size: 10px; color: #777; margin-top: 4px;">Cashier: ${cashierName || sale.cashierName || 'Staff'}</div>
      </div>

      <div style="height: 24px;"></div>
    </div>
  `;

  printDocument(receiptHtml, `Receipt_${sale.invoiceNumber}`);
}

/**
 * Generates and prints a clean retail shelf price tag with Barcode and QR code
 */
export async function printShelfLabel(
  product: Product,
  business: Business | null,
  existingQrUrl?: string
): Promise<void> {
  const currency = business?.currencySymbol || '৳';
  const bName = business?.name || 'Smart Product Manager';

  // Generate QR code if not provided
  let qrUrl = existingQrUrl || '';
  if (!qrUrl) {
    const qrData = JSON.stringify({
      store: bName,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      price: product.sellingPrice,
      unit: product.unit,
    });
    qrUrl = await generateQRCodeDataUrl(qrData, { width: 180, margin: 1 });
  }

  // Generate barcode image
  let barcodeDataUrl = '';
  try {
    const canvas = document.createElement('canvas');
    renderBarcodeToCanvas(canvas, product.barcode, 'CODE128');
    barcodeDataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Barcode generation failed:', e);
  }

  const labelHtml = `
    <div style="display: flex; justify-content: center; padding: 20px;">
      <div style="width: 360px; border: 2px dashed #0f172a; border-radius: 12px; padding: 14px; background: #ffffff; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.1); position: relative;">
        <!-- Tag Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px;">
          <span style="font-size: 11px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #059669;">
            ${bName}
          </span>
          <span style="font-size: 10px; font-weight: 700; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">
            ${product.category}
          </span>
        </div>

        <!-- Product Name -->
        <div style="font-size: 16px; font-weight: 800; line-height: 1.25; margin-bottom: 8px; color: #0f172a;">
          ${product.name}
        </div>

        <!-- Price Callout -->
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
          <div>
            <span style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; display: block;">Retail Price</span>
            <span style="font-size: 26px; font-weight: 900; color: #047857; letter-spacing: -0.5px;">
              ${formatCurrency(product.sellingPrice, currency)}
            </span>
          </div>
          <span style="font-size: 12px; font-weight: 700; color: #475569;">
            / ${product.unit}
          </span>
        </div>

        <!-- Barcode & QR Code Section -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          <!-- Barcode on the left -->
          <div style="flex: 1; text-align: center;">
            ${
              barcodeDataUrl
                ? `<img src="${barcodeDataUrl}" alt="${product.barcode}" style="max-width: 100%; height: 48px; object-fit: contain;" />`
                : `<div style="font-family: monospace; font-size: 12px;">${product.barcode}</div>`
            }
            <div style="font-size: 9px; font-family: monospace; color: #64748b; margin-top: 2px;">
              SKU: ${product.sku}
            </div>
          </div>

          <!-- QR Code on the right -->
          ${
            qrUrl
              ? `<div style="text-align: center;">
                  <img src="${qrUrl}" alt="QR" style="width: 56px; height: 56px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 2px;" />
                  <div style="font-size: 8px; color: #94a3b8; margin-top: 2px;">Scan Stock</div>
                </div>`
              : ''
          }
        </div>

        <!-- Shelf Tag Footer Note -->
        <div style="margin-top: 10px; padding-top: 6px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 9px; color: #64748b;">
          <span>Batch: ${product.batchNumber || 'N/A'}</span>
          <span>Supplier: ${product.supplier || 'Direct'}</span>
        </div>
      </div>
    </div>
  `;

  printDocument(labelHtml, `ShelfLabel_${product.sku}`);
}

/**
 * Generates and prints a stock movement audit trail ledger for a specific product
 */
export function printStockAuditLog(
  product: Product,
  movements: InventoryMovement[],
  business: Business | null
): void {
  const currency = business?.currencySymbol || '৳';
  const bName = business?.name || 'Smart Product Manager';

  const movementRows = movements
    .map(
      (m, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 11px;">
        <td style="padding: 8px 10px; font-family: monospace;">${formatDate(m.createdAt)}</td>
        <td style="padding: 8px 10px;">
          <span style="font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 10px; background: ${
            m.type === 'SALE' ? '#fee2e2; color: #991b1b' : m.type === 'RECEIVING' ? '#dcfce7; color: #166534' : '#fef3c7; color: #92400e'
          };">
            ${m.type}
          </span>
        </td>
        <td style="padding: 8px 10px; font-family: monospace;">${m.referenceId || 'N/A'}</td>
        <td style="padding: 8px 10px; font-weight: 700; text-align: right; color: ${
          m.quantity > 0 && m.type !== 'SALE' && m.type !== 'ADJUSTMENT_SUB' ? '#166534' : '#991b1b'
        };">
          ${m.type === 'SALE' || m.type === 'ADJUSTMENT_SUB' ? `-${m.quantity}` : `+${m.quantity}`} ${product.unit}
        </td>
        <td style="padding: 8px 10px; font-weight: 800; text-align: right;">
          ${m.newStock} ${product.unit}
        </td>
        <td style="padding: 8px 10px; color: #64748b;">${m.performedBy || 'System'}</td>
        <td style="padding: 8px 10px; color: #64748b; max-width: 180px;">${m.notes || '-'}</td>
      </tr>
    `
    )
    .join('');

  const auditHtml = `
    <div style="max-width: 850px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <!-- Header -->
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${bName}</h1>
          <div style="font-size: 13px; font-weight: 700; color: #047857; margin-top: 4px;">INVENTORY MOVEMENT AUDIT REPORT</div>
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
          <div>Generated on: <strong>${formatDate(new Date().toISOString())}</strong></div>
          <div>Report Type: Stock Ledger Audit</div>
        </div>
      </div>

      <!-- Product Master Overview Card -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; font-size: 12px;">
        <div>
          <span style="color: #64748b; display: block; font-size: 10px; text-transform: uppercase;">Product Name</span>
          <strong style="font-size: 13px;">${product.name}</strong>
        </div>
        <div>
          <span style="color: #64748b; display: block; font-size: 10px; text-transform: uppercase;">SKU / Barcode</span>
          <span style="font-family: monospace; font-weight: 700;">${product.sku} | ${product.barcode}</span>
        </div>
        <div>
          <span style="color: #64748b; display: block; font-size: 10px; text-transform: uppercase;">Category / Unit</span>
          <strong>${product.category} (${product.unit})</strong>
        </div>
        <div>
          <span style="color: #64748b; display: block; font-size: 10px; text-transform: uppercase;">Current Live Balance</span>
          <strong style="font-size: 15px; color: #047857;">${product.currentStock} ${product.unit}</strong>
        </div>
      </div>

      <!-- Balance Equation Formula Verification -->
      <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #ffffff; display: flex; justify-content: space-around; text-align: center; font-size: 11px;">
        <div>
          <span style="color: #64748b; display: block;">Opening Stock</span>
          <strong style="font-size: 13px;">${product.openingStock}</strong>
        </div>
        <div style="align-self: center; font-weight: 900; color: #94a3b8;">+</div>
        <div>
          <span style="color: #166534; display: block;">Total Inward Received</span>
          <strong style="font-size: 13px; color: #166534;">+${product.totalReceived}</strong>
        </div>
        <div style="align-self: center; font-weight: 900; color: #94a3b8;">±</div>
        <div>
          <span style="color: #b45309; display: block;">Adjustments</span>
          <strong style="font-size: 13px; color: #b45309;">${product.stockAdjustments > 0 ? `+${product.stockAdjustments}` : product.stockAdjustments}</strong>
        </div>
        <div style="align-self: center; font-weight: 900; color: #94a3b8;">-</div>
        <div>
          <span style="color: #991b1b; display: block;">Total Sold (POS)</span>
          <strong style="font-size: 13px; color: #991b1b;">-${product.totalSold}</strong>
        </div>
        <div style="align-self: center; font-weight: 900; color: #047857;">=</div>
        <div style="background: #ecfdf5; padding: 4px 10px; border-radius: 6px;">
          <span style="color: #065f46; display: block; font-weight: 700;">Live Balance</span>
          <strong style="font-size: 15px; color: #047857;">${product.currentStock} ${product.unit}</strong>
        </div>
      </div>

      <!-- Movement Ledger Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 24px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px 10px; text-align: left;">Date & Time</th>
            <th style="padding: 8px 10px; text-align: left;">Type</th>
            <th style="padding: 8px 10px; text-align: left;">Reference</th>
            <th style="padding: 8px 10px; text-align: right;">Quantity</th>
            <th style="padding: 8px 10px; text-align: right;">Balance</th>
            <th style="padding: 8px 10px; text-align: left;">Auditor / User</th>
            <th style="padding: 8px 10px; text-align: left;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${movementRows.length > 0 ? movementRows : `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #94a3b8;">No movement history records found.</td></tr>`}
        </tbody>
      </table>

      <!-- Signatures Footer -->
      <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
        <div style="border-top: 1px solid #94a3b8; width: 200px; padding-top: 6px; text-align: center;">
          Inventory Manager Signature
        </div>
        <div style="border-top: 1px solid #94a3b8; width: 200px; padding-top: 6px; text-align: center;">
          Store Auditor Signature
        </div>
      </div>
    </div>
  `;

  printDocument(auditHtml, `StockAudit_${product.sku}`);
}

/**
 * Prints the complete product catalog / inventory valuation master sheet
 */
export function printProductCatalog(
  products: Product[],
  business: Business | null
): void {
  const currency = business?.currencySymbol || '৳';
  const bName = business?.name || 'Smart Product Manager';

  const totalStockUnits = products.reduce((acc, p) => acc + p.currentStock, 0);
  const totalCostValuation = products.reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0);
  const totalRetailValuation = products.reduce((acc, p) => acc + p.currentStock * p.sellingPrice, 0);

  const productRows = products
    .map(
      (p, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 11px;">
        <td style="padding: 7px 8px; font-family: monospace; font-weight: 700;">${p.sku}</td>
        <td style="padding: 7px 8px;">
          <div style="font-weight: 700; color: #0f172a;">${p.name}</div>
          <div style="font-size: 9px; font-family: monospace; color: #64748b;">${p.barcode}</div>
        </td>
        <td style="padding: 7px 8px;">${p.category}</td>
        <td style="padding: 7px 8px; text-align: right;">${formatCurrency(p.purchasePrice, currency)}</td>
        <td style="padding: 7px 8px; text-align: right; font-weight: 700;">${formatCurrency(p.sellingPrice, currency)}</td>
        <td style="padding: 7px 8px; text-align: right; font-weight: 800; color: ${
          p.currentStock <= 0 ? '#dc2626' : p.currentStock <= p.minStockLevel ? '#d97706' : '#059669'
        };">
          ${p.currentStock} ${p.unit}
        </td>
        <td style="padding: 7px 8px; text-align: right; font-family: monospace;">
          ${formatCurrency(p.currentStock * p.sellingPrice, currency)}
        </td>
        <td style="padding: 7px 8px; text-align: center;">
          <span style="padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; ${
            p.currentStock <= 0
              ? 'background: #fee2e2; color: #991b1b;'
              : p.currentStock <= p.minStockLevel
              ? 'background: #fef3c7; color: #92400e;'
              : 'background: #dcfce7; color: #166534;'
          }">
            ${p.currentStock <= 0 ? 'OUT OF STOCK' : p.currentStock <= p.minStockLevel ? 'LOW STOCK' : 'HEALTHY'}
          </span>
        </td>
      </tr>
    `
    )
    .join('');

  const catalogHtml = `
    <div style="max-width: 900px; margin: 0 auto; padding: 20px; color: #0f172a;">
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase;">${bName}</h1>
          <div style="font-size: 13px; font-weight: 700; color: #047857; margin-top: 3px;">MASTER PRODUCT INVENTORY & VALUATION REPORT</div>
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
          <div>Print Date: <strong>${formatDate(new Date().toISOString())}</strong></div>
          <div>Total Listed Products: <strong>${products.length}</strong></div>
        </div>
      </div>

      <!-- Financial Metric Cards -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px;">
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Total Inventory Volume</span>
          <span style="font-size: 18px; font-weight: 900; color: #0f172a;">${totalStockUnits} Units</span>
        </div>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px;">
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Total Cost Valuation</span>
          <span style="font-size: 18px; font-weight: 900; color: #334155;">${formatCurrency(totalCostValuation, currency)}</span>
        </div>
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 10px 14px;">
          <span style="font-size: 10px; color: #047857; text-transform: uppercase; font-weight: 700; display: block;">Total Retail Value</span>
          <span style="font-size: 18px; font-weight: 900; color: #047857;">${formatCurrency(totalRetailValuation, currency)}</span>
        </div>
      </div>

      <!-- Master Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px; text-align: left;">SKU</th>
            <th style="padding: 8px; text-align: left;">Product & Barcode</th>
            <th style="padding: 8px; text-align: left;">Category</th>
            <th style="padding: 8px; text-align: right;">Cost Price</th>
            <th style="padding: 8px; text-align: right;">Retail Price</th>
            <th style="padding: 8px; text-align: right;">Stock</th>
            <th style="padding: 8px; text-align: right;">Total Retail</th>
            <th style="padding: 8px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
        </tbody>
      </table>
    </div>
  `;

  printDocument(catalogHtml, `Inventory_Catalog_${new Date().toISOString().split('T')[0]}`);
}

/**
 * Prints an executive financial sales report
 */
export function printFinancialReport(
  business: Business | null,
  sales: Sale[],
  metrics: {
    grossSales: number;
    totalOrders: number;
    totalTax: number;
    totalDiscount: number;
    netSales: number;
    avgOrderValue: number;
  }
): void {
  const currency = business?.currencySymbol || '৳';
  const bName = business?.name || 'Smart Product Manager';

  const salesRows = sales.slice(0, 50).map((s, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 11px;">
      <td style="padding: 7px 8px; font-family: monospace; font-weight: 700;">#${s.invoiceNumber}</td>
      <td style="padding: 7px 8px; font-family: monospace;">${formatDate(s.createdAt)}</td>
      <td style="padding: 7px 8px;">${s.customerName || 'Walk-in Customer'}</td>
      <td style="padding: 7px 8px; text-align: center; text-transform: uppercase; font-weight: 600; font-size: 10px;">${s.paymentMethod}</td>
      <td style="padding: 7px 8px; text-align: right;">${s.items.length} items</td>
      <td style="padding: 7px 8px; text-align: right; font-weight: 800; color: #047857;">${formatCurrency(s.totalAmount, currency)}</td>
    </tr>
  `).join('');

  const reportHtml = `
    <div style="max-width: 850px; margin: 0 auto; padding: 20px; color: #0f172a;">
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase;">${bName}</h1>
          <div style="font-size: 13px; font-weight: 700; color: #047857; margin-top: 3px;">EXECUTIVE SALES & REVENUE REPORT</div>
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
          <div>Generated on: <strong>${formatDate(new Date().toISOString())}</strong></div>
          <div>Period: All Time (Active Database)</div>
        </div>
      </div>

      <!-- Financial KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px;">
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Gross Revenue</span>
          <span style="font-size: 17px; font-weight: 900; color: #047857;">${formatCurrency(metrics.grossSales, currency)}</span>
        </div>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px;">
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Total Transactions</span>
          <span style="font-size: 17px; font-weight: 900; color: #0f172a;">${metrics.totalOrders}</span>
        </div>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px;">
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Tax Collected</span>
          <span style="font-size: 17px; font-weight: 900; color: #334155;">${formatCurrency(metrics.totalTax, currency)}</span>
        </div>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px;">
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Average Basket Size</span>
          <span style="font-size: 17px; font-weight: 900; color: #2563eb;">${formatCurrency(metrics.avgOrderValue, currency)}</span>
        </div>
      </div>

      <!-- Recent Transactions Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px; text-align: left;">Invoice #</th>
            <th style="padding: 8px; text-align: left;">Date</th>
            <th style="padding: 8px; text-align: left;">Customer</th>
            <th style="padding: 8px; text-align: center;">Payment</th>
            <th style="padding: 8px; text-align: right;">Quantity</th>
            <th style="padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${salesRows}
        </tbody>
      </table>
    </div>
  `;

  printDocument(reportHtml, `Sales_Report_${new Date().toISOString().split('T')[0]}`);
}
