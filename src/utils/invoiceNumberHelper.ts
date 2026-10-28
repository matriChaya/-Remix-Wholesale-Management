import { OrderInvoice, SupplierLedgerEntry } from '../types';

/**
 * Automatically generates a date-based sequential invoice number:
 * Format: INV-YYYYMMDD-1, INV-YYYYMMDD-2, INV-YYYYMMDD-3...
 * 
 * Rules:
 * 1. When date is edited, the invoice number dynamically recalculates.
 * 2. If multiple invoices exist on the same date, they are sequentially numbered 1, 2, 3...
 */
export function generateDateBasedInvoiceNo(
  targetDate: string,
  currentOrderId: string | null | undefined,
  allOrders: OrderInvoice[]
): string {
  if (!targetDate) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    targetDate = `${y}-${m}-${d}`;
  }
  const cleanDate = targetDate.slice(0, 10).replace(/[^0-9]/g, '');
  const prefix = `INV-${cleanDate}-`;

  // Find other orders on this exact date (ignoring the one currently being edited)
  const otherOrdersOnDate = (allOrders || []).filter((o) => {
    if (currentOrderId && o.id === currentOrderId) return false;
    const oDate = (o.date || '').slice(0, 10).replace(/[^0-9]/g, '');
    const oInv = (o.invoiceNo || o.invoiceNumber || '').trim();
    return oDate === cleanDate || oInv.startsWith(prefix);
  });

  // Track sequence numbers used
  const usedSeqs = new Set<number>();
  otherOrdersOnDate.forEach((o) => {
    const inv = (o.invoiceNo || o.invoiceNumber || '').trim();
    if (inv.startsWith(prefix)) {
      const remainder = inv.slice(prefix.length);
      const parsed = parseInt(remainder, 10);
      if (!isNaN(parsed) && parsed > 0) {
        usedSeqs.add(parsed);
      }
    }
  });

  // Determine next sequential integer: 1, 2, 3...
  let nextSeq = 1;
  while (usedSeqs.has(nextSeq)) {
    nextSeq++;
  }

  return `INV-${cleanDate}-${nextSeq}`;
}

/**
 * Automatically generates a date-based sequential purchase challan number:
 * Format: CHAL-YYYYMMDD-1, CHAL-YYYYMMDD-2, CHAL-YYYYMMDD-3...
 */
export function generateDateBasedChallanNo(
  targetDate: string,
  currentEntryId: string | null | undefined,
  allLedgerEntries: SupplierLedgerEntry[]
): string {
  if (!targetDate) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    targetDate = `${y}-${m}-${d}`;
  }
  const cleanDate = targetDate.slice(0, 10).replace(/[^0-9]/g, '');
  const prefix = `CHAL-${cleanDate}-`;

  const otherEntries = (allLedgerEntries || []).filter((e) => {
    if (currentEntryId && e.id === currentEntryId) return false;
    const eDate = (e.date || '').slice(0, 10).replace(/[^0-9]/g, '');
    const ref = (e.referenceNo || '').trim();
    return eDate === cleanDate || ref.startsWith(prefix);
  });

  const usedSeqs = new Set<number>();
  otherEntries.forEach((e) => {
    const ref = (e.referenceNo || '').trim();
    if (ref.startsWith(prefix)) {
      const remainder = ref.slice(prefix.length);
      const parsed = parseInt(remainder, 10);
      if (!isNaN(parsed) && parsed > 0) {
        usedSeqs.add(parsed);
      }
    }
  });

  let nextSeq = 1;
  while (usedSeqs.has(nextSeq)) {
    nextSeq++;
  }

  return `CHAL-${cleanDate}-${nextSeq}`;
}
