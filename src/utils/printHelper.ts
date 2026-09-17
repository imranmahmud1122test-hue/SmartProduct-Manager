import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Business, InventoryMovement, Order, Product, Sale } from '../types';
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
 * Executes a clean, isolated print job.
 * This completely isolates the print document from the host web app,
 * preventing modal dark backdrops, background page bleed, or cut-offs.
 * It directly triggers the browser's native print preview dialog (Save as PDF / Printer).
 */
export function printDocument(htmlContent: string, title: string = 'Document'): void {
  let mount = document.getElementById('spm-print-mount');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'spm-print-mount';
    document.body.appendChild(mount);
  }
  mount.innerHTML = htmlContent;

  document.body.classList.add('is-printing-isolated');
  const prevTitle = document.title;
  document.title = title;

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.classList.remove('is-printing-isolated');
    document.title = prevTitle;
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  // Directly trigger native window.print()
  setTimeout(() => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn('Native window.print() exception:', e);
    }
    // Fallback cleanup timer in case afterprint does not fire
    setTimeout(cleanup, 3000);
  }, 100);
}

/**
 * Generates an official Steadfast / Courier Delivery Consignment Manifest
 * for bulk dispatching and rider handover.
 */
export function printCourierManifest(
  orders: Order[],
  business: Business | null = null,
  statusFilterLabel: string = 'All Consignments'
): void {
  const currency = business?.currencySymbol || '৳';
  const storeName = business?.name || 'Smart Product Store';
  const storePhone = business?.phone || '';
  const storeAddress = business?.address || '';

  const totalCodValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalDeliveryCharges = orders.reduce((sum, o) => sum + (o.deliveryCharge || 0), 0);

  const orderRows = orders
    .map((order, idx) => {
      let barcodeUrl = '';
      try {
        const canvas = document.createElement('canvas');
        renderBarcodeToCanvas(canvas, order.orderId, 'CODE128');
        barcodeUrl = canvas.toDataURL('image/png');
      } catch (e) {
        console.warn('Barcode gen error:', e);
      }

      const itemsSummary = order.items.map((it) => `${it.quantity}× ${it.productNameSnapshot}`).join(', ');

      return `
        <div style="border-bottom: 1.5px solid #e2e8f0; padding: 14px 10px; page-break-inside: avoid; display: grid; grid-template-columns: 35px 170px 1fr 130px 100px; gap: 12px; align-items: center; font-size: 11px;">
          <!-- Serial # -->
          <div style="font-weight: 800; color: #64748b; text-align: center; font-size: 12px;">
            ${idx + 1}
          </div>

          <!-- Consignment Number / Order ID & Date -->
          <div>
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Date:</div>
            <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 3px;">
              ${formatDate(order.createdAt)}
            </div>
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">
              CN# <span style="font-family: monospace; font-size: 12px; font-weight: 900; color: #0f172a;">${order.orderId}</span>
            </div>
            ${
              barcodeUrl
                ? `<div style="margin-top: 4px;"><img src="${barcodeUrl}" alt="${order.orderId}" style="height: 28px; max-width: 140px;" /></div>`
                : ''
            }
          </div>

          <!-- Recipient Details & Items -->
          <div>
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Recipient:</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
              ${order.customerName}
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #047857; margin-top: 1px;">
              📞 ${order.customerPhone}
            </div>
            <div style="font-size: 11px; color: #334155; margin-top: 2px; line-height: 1.3;">
              📍 ${order.deliveryAddress}
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 4px; background: #f8fafc; padding: 3px 6px; border-radius: 4px; display: inline-block;">
              <strong>Items:</strong> ${itemsSummary}
            </div>
          </div>

          <!-- COD & Delivery Charge -->
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">COD Collection:</div>
            <div style="font-size: 14px; font-weight: 900; color: #047857;">
              ${formatCurrency(order.totalAmount, currency)}
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
              Charge: <strong>${formatCurrency(order.deliveryCharge || 0, currency)}</strong>
            </div>
            <div style="font-size: 9px; color: #64748b; text-transform: uppercase;">
              ${order.paymentMethod.replace(/_/g, ' ')}
            </div>
          </div>

          <!-- Status & Verification -->
          <div style="text-align: center;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; ${
              order.orderStatus === 'Confirmed'
                ? 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;'
                : order.orderStatus === 'Pending'
                ? 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a;'
                : 'background: #fee2e2; color: #991b1b; border: 1px solid #fecaca;'
            }">
              ${order.orderStatus}
            </span>
            <div style="margin-top: 6px; width: 18px; height: 18px; border: 1.5px solid #94a3b8; border-radius: 4px; margin-left: auto; margin-right: auto;" title="Dispatch Check"></div>
          </div>
        </div>
      `;
    })
    .join('');

  const manifestHtml = `
    <div style="max-width: 900px; margin: 0 auto; background: #ffffff; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.4;">
      
      <!-- Top Store & Manifest Header -->
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; color: #0f172a;">${storeName}</h1>
          ${storeAddress ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${storeAddress}</div>` : ''}
          ${storePhone ? `<div style="font-size: 11px; color: #475569;">Tel: ${storePhone}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 14px; background: #0f172a; color: #ffffff; font-size: 11px; font-weight: 800; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
            COURIER CONSIGNMENT MANIFEST
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
            Generated on: <strong>${formatDate(new Date().toISOString())}</strong>
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #047857; margin-top: 1px;">
            Filter: ${statusFilterLabel}
          </div>
        </div>
      </div>

      <!-- Financial & Dispatch Summary KPIs -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Consignments</div>
          <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 2px;">${orders.length}</div>
        </div>
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 10px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #047857; text-transform: uppercase;">Total COD To Collect</div>
          <div style="font-size: 20px; font-weight: 900; color: #047857; margin-top: 2px;">${formatCurrency(totalCodValue, currency)}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Delivery Charges</div>
          <div style="font-size: 20px; font-weight: 900; color: #334155; margin-top: 2px;">${formatCurrency(totalDeliveryCharges, currency)}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Courier Partner</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 4px;">Steadfast / Pathao</div>
        </div>
      </div>

      <!-- Consignment Table Header -->
      <div style="background: #0f172a; color: #ffffff; border-radius: 8px 8px 0 0; padding: 8px 10px; display: grid; grid-template-columns: 35px 170px 1fr 130px 100px; gap: 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
        <div style="text-align: center;">#</div>
        <div>Date & Consignment #</div>
        <div>Recipient & Delivery Address</div>
        <div style="text-align: right;">COD & Delivery Fee</div>
        <div style="text-align: center;">Status / Check</div>
      </div>

      <!-- Consignment Rows -->
      <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; margin-bottom: 24px;">
        ${orders.length > 0 ? orderRows : `<div style="padding: 24px; text-align: center; color: #64748b;">No consignments matching criteria.</div>`}
      </div>

      <!-- Dispatch Signatures -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; padding-top: 14px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #475569; text-align: center;">
        <div>
          <div style="height: 40px; border-bottom: 1.5px solid #94a3b8; margin-bottom: 6px;"></div>
          <strong>Merchant Dispatcher Signature</strong>
        </div>
        <div>
          <div style="height: 40px; border-bottom: 1.5px solid #94a3b8; margin-bottom: 6px;"></div>
          <strong>Courier Rider Handover Signature</strong>
        </div>
        <div>
          <div style="height: 40px; border-bottom: 1.5px solid #94a3b8; margin-bottom: 6px;"></div>
          <strong>Hub Incharge / Verification</strong>
        </div>
      </div>

    </div>
  `;

  printDocument(manifestHtml, `CourierManifest_${new Date().toISOString().split('T')[0]}`);
}

/**
 * Generates an elegant, single-page official customer receipt & invoice for orders.
 * Completely isolates print layout to prevent background app bleed.
 */
export function printOrderReceipt(order: Order, business: Business | null = null): void {
  const currency = business?.currencySymbol || '৳';
  const storeName = order.storeNameSnapshot || business?.name || 'Smart Product Store';
  const storeAddress = business?.address || '';
  const storePhone = business?.phone || '';
  const storeEmail = business?.email || '';

  // Barcode generation
  let barcodeDataUrl = '';
  try {
    const canvas = document.createElement('canvas');
    renderBarcodeToCanvas(canvas, order.orderId, 'CODE128');
    barcodeDataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Barcode generation error:', e);
  }

  const itemsHtml = order.items
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <td style="padding: 8px 6px; text-align: center; color: #64748b; width: 30px;">${idx + 1}</td>
        <td style="padding: 8px 6px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${item.productNameSnapshot}</div>
        </td>
        <td style="padding: 8px 6px; text-align: center; font-weight: 700; color: #0f172a; width: 60px;">${item.quantity}</td>
        <td style="padding: 8px 6px; text-align: right; width: 100px; color: #475569;">${formatCurrency(item.unitPriceSnapshot, currency)}</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: 800; color: #0f172a; width: 110px;">${formatCurrency(item.subtotal, currency)}</td>
      </tr>
    `
    )
    .join('');

  const receiptHtml = `
    <div style="max-width: 680px; margin: 0 auto; background: #ffffff; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.4;">
      
      <!-- Store Brand Header -->
      <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase; color: #0f172a;">${storeName}</h1>
        ${storeAddress ? `<div style="font-size: 11px; color: #475569; margin-top: 3px;">${storeAddress}</div>` : ''}
        ${storePhone || storeEmail ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${[storePhone && `Tel: ${storePhone}`, storeEmail && `Email: ${storeEmail}`].filter(Boolean).join(' | ')}</div>` : ''}
        
        <div style="display: inline-block; margin-top: 10px; padding: 4px 16px; background: #0f172a; color: #ffffff; font-size: 11px; font-weight: 700; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.8px;">
          CUSTOMER ORDER RECEIPT & INVOICE
        </div>
      </div>

      <!-- Order ID & Key Details Bar -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Order ID</div>
          <div style="font-size: 15px; font-weight: 800; font-family: monospace; color: #0f172a;">${order.orderId}</div>
        </div>
        <div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</div>
          <div style="font-size: 12px; font-weight: 600; color: #0f172a;">${formatDate(order.createdAt)}</div>
        </div>
        <div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Order Status</div>
          <div style="font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase;">${order.orderStatus}</div>
        </div>
        <div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Payment Method</div>
          <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase;">${order.paymentMethod.replace(/_/g, ' ')}</div>
        </div>
      </div>

      <!-- Customer & Delivery Information -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px;">
          Delivery & Customer Information
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
          <div>
            <span style="color: #64748b;">Customer Name:</span> <strong>${order.customerName}</strong>
          </div>
          <div>
            <span style="color: #64748b;">Contact Phone:</span> <strong>${order.customerPhone}</strong>
          </div>
          <div style="grid-column: span 2;">
            <span style="color: #64748b;">Delivery Address:</span> <strong>${order.deliveryAddress}</strong>
          </div>
          ${order.customerNote ? `<div style="grid-column: span 2; font-style: italic; color: #475569; background: #f8fafc; padding: 4px 8px; border-radius: 6px;"><span style="color: #64748b; font-style: normal; font-weight: 600;">Customer Note:</span> ${order.customerNote}</div>` : ''}
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569;">
            <th style="padding: 8px 6px; text-align: center; width: 35px;">#</th>
            <th style="padding: 8px 6px; text-align: left;">Product Item</th>
            <th style="padding: 8px 6px; text-align: center; width: 60px;">Qty</th>
            <th style="padding: 8px 6px; text-align: right; width: 100px;">Price</th>
            <th style="padding: 8px 6px; text-align: right; width: 110px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Financial Calculation Summary -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
        <div style="width: 280px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #475569;">
            <span>Items Subtotal:</span>
            <span style="font-weight: 600; color: #0f172a;">${formatCurrency(order.subtotal, currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #475569;">
            <span>Delivery Fee:</span>
            <span style="font-weight: 600; color: #0f172a;">${formatCurrency(order.deliveryCharge, currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; margin-top: 4px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-size: 15px; font-weight: 800; color: #0f172a;">
            <span>Total Amount Due:</span>
            <span style="color: #047857;">${formatCurrency(order.totalAmount, currency)}</span>
          </div>
        </div>
      </div>

      <!-- Barcode & Tracking Instructions -->
      <div style="border-top: 1px dashed #cbd5e1; padding-top: 14px; text-align: center;">
        ${barcodeDataUrl ? `<div style="margin-bottom: 8px;"><img src="${barcodeDataUrl}" alt="Barcode" style="height: 44px; max-width: 220px;" /></div>` : ''}
        <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Thank you for your order!</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
          You can track this order online anytime using your Order ID: <strong>${order.orderId}</strong> and Phone: <strong>${order.customerPhone}</strong>
        </div>
      </div>

    </div>
  `;

  printDocument(receiptHtml, `Receipt_${order.orderId}`);
}

/**
 * Generates an official merchant Packing & Dispatch Slip for store order fulfillment.
 */
export function printOrderSlip(order: Order, business: Business | null = null): void {
  const currency = business?.currencySymbol || '৳';
  const storeName = order.storeNameSnapshot || business?.name || 'Smart Product Store';
  const storeAddress = business?.address || '';
  const storePhone = business?.phone || '';

  // Barcode generation
  let barcodeDataUrl = '';
  try {
    const canvas = document.createElement('canvas');
    renderBarcodeToCanvas(canvas, order.orderId, 'CODE128');
    barcodeDataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Barcode generation warning:', e);
  }

  const itemsHtml = order.items
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <td style="padding: 8px 6px; text-align: center; width: 30px;">
          <div style="width: 14px; height: 14px; border: 1.5px solid #64748b; border-radius: 2px; margin: 0 auto;"></div>
        </td>
        <td style="padding: 8px 6px; text-align: center; color: #64748b; width: 30px;">${idx + 1}</td>
        <td style="padding: 8px 6px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${item.productNameSnapshot}</div>
        </td>
        <td style="padding: 8px 6px; text-align: center; font-weight: 800; font-size: 13px; width: 60px;">${item.quantity}</td>
        <td style="padding: 8px 6px; text-align: right; width: 90px; color: #475569;">${formatCurrency(item.unitPriceSnapshot, currency)}</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: 700; color: #0f172a; width: 100px;">${formatCurrency(item.subtotal, currency)}</td>
      </tr>
    `
    )
    .join('');

  const slipHtml = `
    <div style="max-width: 680px; margin: 0 auto; background: #ffffff; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.4;">
      
      <!-- Store Header & Manifest Title -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase;">${storeName}</h1>
          ${storeAddress ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${storeAddress}</div>` : ''}
          ${storePhone ? `<div style="font-size: 11px; color: #475569;">Tel: ${storePhone}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 12px; background: #047857; color: #ffffff; font-size: 11px; font-weight: 700; border-radius: 4px; text-transform: uppercase;">
            PACKING & DISPATCH SLIP
          </div>
          <div style="font-size: 13px; font-weight: 800; font-family: monospace; margin-top: 4px;">${order.orderId}</div>
          <div style="font-size: 10px; color: #64748b;">${formatDate(order.createdAt)}</div>
        </div>
      </div>

      <!-- Shipping & Customer Box -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; font-size: 11px;">
          <div style="font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">SHIP TO / CUSTOMER</div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${order.customerName}</div>
          <div style="font-size: 12px; font-weight: 700; color: #047857; margin-top: 2px;">📞 ${order.customerPhone}</div>
          <div style="font-size: 11px; color: #334155; margin-top: 4px; line-height: 1.3;">📍 ${order.deliveryAddress}</div>
          ${order.customerNote ? `<div style="margin-top: 6px; padding: 4px 8px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 10px;"><strong>Note:</strong> ${order.customerNote}</div>` : ''}
        </div>

        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; font-size: 11px;">
          <div style="font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">ORDER & PAYMENT INFO</div>
          <div>Status: <strong style="color: #047857; text-transform: uppercase;">${order.orderStatus}</strong></div>
          <div style="margin-top: 2px;">Payment: <strong style="text-transform: uppercase;">${order.paymentMethod.replace(/_/g, ' ')}</strong></div>
          <div style="margin-top: 2px;">Delivery Fee: <strong>${formatCurrency(order.deliveryCharge, currency)}</strong></div>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 13px; font-weight: 800; color: #0f172a;">
            Collection Due: <span style="color: #047857;">${formatCurrency(order.totalAmount, currency)}</span>
          </div>
        </div>
      </div>

      <!-- Packing Checklist Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569;">
            <th style="padding: 8px 6px; text-align: center; width: 30px;">Check</th>
            <th style="padding: 8px 6px; text-align: center; width: 30px;">#</th>
            <th style="padding: 8px 6px; text-align: left;">Item Description</th>
            <th style="padding: 8px 6px; text-align: center; width: 60px;">Packed Qty</th>
            <th style="padding: 8px 6px; text-align: right; width: 90px;">Price</th>
            <th style="padding: 8px 6px; text-align: right; width: 100px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Dispatch Signatures -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #64748b; text-align: center;">
        <div>
          <div style="height: 35px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px;"></div>
          <span>Packed By</span>
        </div>
        <div>
          <div style="height: 35px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px;"></div>
          <span>Checked & Verified</span>
        </div>
        <div>
          <div style="height: 35px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px;"></div>
          <span>Courier / Delivery Agent</span>
        </div>
      </div>

      ${barcodeDataUrl ? `
        <div style="text-align: center; margin-top: 16px;">
          <img src="${barcodeDataUrl}" alt="Barcode" style="height: 40px; max-width: 220px;" />
          <div style="font-size: 10px; font-family: monospace; color: #64748b; margin-top: 2px;">${order.orderId}</div>
        </div>
      ` : ''}

    </div>
  `;

  printDocument(slipHtml, `PackingSlip_${order.orderId}`);
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
