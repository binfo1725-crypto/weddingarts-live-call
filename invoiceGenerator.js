// OmniSix AI - High-Resolution Digital PDF Invoice & Slip Generator
// Vector graphics rendering with PDFKit for clean print & WhatsApp delivery

const PDFDocument = require('pdfkit');

/**
 * Generate a PDF invoice buffer for an order
 * @param {Object} order - Order record
 * @param {Object} business - Business profile
 * @returns {Promise<Buffer>}
 */
function generateInvoicePdf(order, business = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Invoice #${order.id}`,
          Author: business.name || 'OmniSix AI',
          Subject: 'Order Receipt & Invoice'
        }
      });

      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const storeName = business.name || order.store || 'OmniSix AI Store';
      const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
      const orderTime = order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const orderId = String(order.id || 'ORD-001').toUpperCase();
      const status = (order.status || 'Pending').toUpperCase();

      // ─── Header Accent Bar ───────────────────────────────────────────────
      doc.rect(40, 40, 515, 6).fill('#2563EB'); // Primary Blue / Indigo accent

      // ─── Store Brand & Title ─────────────────────────────────────────────
      doc.fillColor('#0F172A').fontSize(22).font('Helvetica-Bold')
         .text(storeName, 40, 58);

      doc.fillColor('#64748B').fontSize(9).font('Helvetica')
         .text(`Automated Commerce Engine | OmniSix AI Pro`, 40, 84);

      // Invoice Title & Meta (Right Aligned)
      doc.fillColor('#0F172A').fontSize(18).font('Helvetica-Bold')
         .text('INVOICE / RECEIPT', 300, 58, { align: 'right', width: 255 });

      doc.fillColor('#64748B').fontSize(9).font('Helvetica')
         .text(`Invoice No: ${orderId}`, 300, 80, { align: 'right', width: 255 })
         .text(`Date: ${orderDate} ${orderTime}`, 300, 93, { align: 'right', width: 255 });

      // ─── Divider ────────────────────────────────────────────────────────
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, 115).lineTo(555, 115).stroke();

      // ─── Billed To & Status Badges ──────────────────────────────────────
      const billToY = 130;
      doc.fillColor('#475569').fontSize(10).font('Helvetica-Bold')
         .text('BILLED TO / CUSTOMER:', 40, billToY);

      doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold')
         .text(order.customerName || 'Valued Customer', 40, billToY + 16);

      doc.fillColor('#334155').fontSize(9).font('Helvetica')
         .text(`Phone: ${order.customerPhone || 'N/A'}`, 40, billToY + 32)
         .text(`Delivery Address: ${order.address || order.city || 'Standard Courier Delivery'}`, 40, billToY + 45);

      // Status Pill on Right
      const statusColor = (status === 'COMPLETED' || status === 'CONFIRMED' || status === 'PAID')
        ? '#10B981'
        : (status === 'SLIP RECEIVED' ? '#3B82F6' : '#F59E0B');

      doc.roundedRect(425, billToY, 130, 26, 4).fill(statusColor);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
         .text(status, 425, billToY + 7, { align: 'center', width: 130 });

      // ─── Line Items Table Header ────────────────────────────────────────
      const tableY = 210;
      doc.rect(40, tableY, 515, 24).fill('#F8FAFC');
      doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold')
         .text('ITEM DESCRIPTION', 50, tableY + 7)
         .text('QTY', 330, tableY + 7, { align: 'center', width: 40 })
         .text('UNIT PRICE', 380, tableY + 7, { align: 'right', width: 80 })
         .text('AMOUNT', 470, tableY + 7, { align: 'right', width: 75 });

      doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(40, tableY + 24).lineTo(555, tableY + 24).stroke();

      // ─── Items List ─────────────────────────────────────────────────────
      let curY = tableY + 32;
      const items = (order.items && order.items.length > 0)
        ? order.items
        : [{ name: order.product || 'Order Item', qty: order.qty || 1, price: order.price || order.total || 0 }];

      items.forEach((item, idx) => {
        const itemName = typeof item === 'string' ? item : (item.name || item.title || 'Product Item');
        const qty = item.qty || item.quantity || 1;
        const price = Number(item.price || item.unitPrice || (order.total / (qty || 1))) || 0;
        const amount = qty * price;

        doc.fillColor('#1E293B').fontSize(9).font('Helvetica')
           .text(itemName, 50, curY, { width: 270 })
           .text(String(qty), 330, curY, { align: 'center', width: 40 })
           .text(`Rs. ${price.toLocaleString()}`, 380, curY, { align: 'right', width: 80 })
           .text(`Rs. ${amount.toLocaleString()}`, 470, curY, { align: 'right', width: 75 });

        curY += 24;
        doc.strokeColor('#F1F5F9').lineWidth(0.5).moveTo(40, curY - 6).lineTo(555, curY - 6).stroke();
      });

      // ─── Summary Totals ─────────────────────────────────────────────────
      const summaryY = Math.max(curY + 15, 340);
      const deliveryFee = Number(order.deliveryFee || 0);
      const discount = Number(order.discount || 0);
      const grandTotal = Number(order.total || 0);
      const subtotal = grandTotal - deliveryFee + discount;

      const rightLabelX = 350;
      const rightValX = 460;
      const summaryWidth = 90;

      doc.fillColor('#64748B').fontSize(9).font('Helvetica')
         .text('Subtotal:', rightLabelX, summaryY)
         .text(`Rs. ${subtotal.toLocaleString()}`, rightValX, summaryY, { align: 'right', width: summaryWidth });

      if (deliveryFee > 0) {
        doc.text('Delivery Fee:', rightLabelX, summaryY + 16)
           .text(`Rs. ${deliveryFee.toLocaleString()}`, rightValX, summaryY + 16, { align: 'right', width: summaryWidth });
      }

      if (discount > 0) {
        doc.fillColor('#EF4444')
           .text('Discount:', rightLabelX, summaryY + 32)
           .text(`-Rs. ${discount.toLocaleString()}`, rightValX, summaryY + 32, { align: 'right', width: summaryWidth });
      }

      const totalBoxY = summaryY + (discount > 0 ? 52 : (deliveryFee > 0 ? 36 : 22));
      doc.rect(340, totalBoxY, 215, 30).fill('#0F172A');
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
         .text('TOTAL PAYABLE:', 350, totalBoxY + 9)
         .text(`Rs. ${grandTotal.toLocaleString()}`, 450, totalBoxY + 9, { align: 'right', width: 95 });

      // ─── Verification & Payment Info ────────────────────────────────────
      const notesY = totalBoxY + 50;
      doc.roundedRect(40, notesY, 515, 60, 4).fill('#F8FAFC');
      doc.strokeColor('#E2E8F0').lineWidth(0.5).rect(40, notesY, 515, 60).stroke();

      doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold')
         .text('Payment & Verification Instructions:', 50, notesY + 10);

      doc.fillColor('#64748B').fontSize(8.5).font('Helvetica')
         .text('• Cash on Delivery (COD) or Bank Transfer verified by OmniSix AI Assistant.', 50, notesY + 24)
         .text('• Please send bank deposit slips or payment receipts directly to this WhatsApp chat for instant order dispatch.', 50, notesY + 36);

      // ─── Footer ─────────────────────────────────────────────────────────
      doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(40, 750).lineTo(555, 750).stroke();
      doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
         .text('Thank you for your business! This is an officially generated electronic invoice by OmniSix AI.', 40, 760, { align: 'center', width: 515 })
         .text('OmniSix AI Suite • Cloud-Connected Autonomous Sales Automation Engine', 40, 772, { align: 'center', width: 515 });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateInvoicePdf };
