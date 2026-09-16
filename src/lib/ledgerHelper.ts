import { getHostingerDbData, saveHostingerDbData, saveHostingerDbMultiData } from './db';
import { Customer, Carton, LedgerEntry } from '../types';

export const formatInvoiceNoteToEnglish = (note?: string): string => {
  if (!note) return '';
  return note
    .replace(/কার্গো চার্জ \(বিলিং\)/g, 'Cargo Charge (Billing)')
    .replace(/কার্গো চার্জ \(রিসিভ\)/g, 'Cargo Charge (Received)')
    .replace(/কার্গো চার্জ/g, 'Cargo Charge')
    .replace(/বাংলাদেশ ওয়্যারহাউজ শেষ কেজি/g, 'BD Warehouse Final Weight')
    .replace(/প্রাথমিক কেজি/g, 'Initial Weight')
    .replace(/প্রাথমিক ওয়েট/g, 'Initial Weight')
    .replace(/সিস্টেম বিলিং অটোরিজালভ/g, 'System Billing Auto-resolve')
    .replace(/ওয়্যারহাউজ ট্র্যাকিং/g, 'Warehouse Tracking')
    .replace(/বুকিং ফিলিং/g, 'Booking Entry')
    .replace(/পেমেন্ট জমা নেওয়া হয়েছে/g, 'Payment Received')
    .replace(/পেমেন্ট জমা/g, 'Payment Received')
    .replace(/কাস্টমার রিফান্ড এন্ট্রি/g, 'Customer Refund Entry')
    .replace(/কার্গো শিপিং ও হ্যান্ডলিং চার্জ/g, 'Cargo Shipping & Handling Charge')
    .replace(/ক্যাশ\/ব্যাংক পেমেন্ট পরিশোধ/g, 'Cash/Bank Payment Received')
    .replace(/ক্যাশ রিসিভ/g, 'Cash Received')
    .replace(/ম্যাপ করা হয়নি/g, 'Unassigned');
};

/**
 * Recalculates customer billing charges and ledger entries based on final Bangladesh Warehouse weight
 * (bd_calibrated_weight || gross_weight) and rate_per_kg set during customer mapping.
 */
export const recalculateCustomerLedgerAndBilling = (targetCustomerId?: string) => {
  const dbData = getHostingerDbData();
  const customers: Customer[] = dbData.customers || [];
  const cartons: Carton[] = dbData.cartons || [];
  let ledgerEntries: LedgerEntry[] = dbData.ledgerEntries || [];

  const targetCustomers = targetCustomerId
    ? customers.filter((c) => c.id === targetCustomerId)
    : customers;

  const updatedCartonsMap = new Map<string, Carton>();
  cartons.forEach((c) => updatedCartonsMap.set(c.id, { ...c }));

  const updatedCustomersMap = new Map<string, Customer>();
  customers.forEach((c) => updatedCustomersMap.set(c.id, { ...c }));

  const cleanMark = (str?: string) => (str || '').toLowerCase().replace(/^mark:\s*/i, '').trim();

  targetCustomers.forEach((cust) => {
    const custId = cust.id;
    const custMark = cleanMark(cust.shipping_mark);
    const custCode = (cust.customer_code || '').toLowerCase().trim();

    const custRate = cust.rate_per_kg && cust.rate_per_kg > 0 ? cust.rate_per_kg : 750;

    // Find all cartons belonging to this customer
    const custCartons = Array.from(updatedCartonsMap.values()).filter((c) => {
      if (c.customer_id && c.customer_id === custId) return true;
      const cMark = cleanMark(c.shipping_mark);
      const cCode = (c.customer_code || '').toLowerCase().trim();
      const cTrk = cleanMark(c.tracking_number);
      const cMaster = cleanMark(c.master_tracking_number);
      const cGroup = cleanMark(c.master_group_id);

      return (
        (custMark && (cMark === custMark || cMark.includes(custMark) || custMark.includes(cMark) || cTrk === custMark || cMaster === custMark || cGroup === custMark)) ||
        (custCode && cCode.includes(custCode))
      );
    });

    let customerTotalCartonCharges = 0;

    custCartons.forEach((ctn) => {
      // Final Bangladesh Warehouse Weight is the official billable weight
      const finalWeight = ctn.bd_calibrated_weight && ctn.bd_calibrated_weight > 0
        ? ctn.bd_calibrated_weight
        : ctn.gross_weight || 0;

      const ratePerKg = ctn.rate_per_kg && ctn.rate_per_kg > 0 ? ctn.rate_per_kg : custRate;
      const totalCharge = Number((finalWeight * ratePerKg).toFixed(2));

      // Update carton with customer mapping details & billing
      const updatedCartonObj: Carton = {
        ...ctn,
        customer_id: cust.id,
        customer_code: cust.customer_code,
        customer_name: cust.name,
        rate_per_kg: ratePerKg,
        billed_amount: totalCharge,
      };

      updatedCartonsMap.set(ctn.id, updatedCartonObj);

      // Only create/update ledger charge if cargo has weight > 0
      if (finalWeight > 0 && totalCharge > 0) {
        customerTotalCartonCharges += totalCharge;

        // Check if an existing ledger charge entry exists for this carton
        const ledgerRef = ctn.ctn_no || ctn.id;
        const existingEntryIdx = ledgerEntries.findIndex(
          (e) => e.customer_id === custId && e.type === 'charge' && (e.reference_no === ledgerRef || (e.note && e.note.includes(ctn.ctn_no)))
        );

        const isBdReceived = ctn.current_warehouse_id === 'wh-bd' || ctn.status === 'received' || ctn.status === 'delivered';
        const weightLabel = isBdReceived ? 'BD Warehouse Final Weight' : 'Initial Weight';

        const rawNote = `Cargo Charge (Billing): ${ctn.ctn_no} | Mark: ${ctn.shipping_mark} - ${weightLabel}: ${finalWeight} KG @ ৳${ratePerKg}/KG = ৳${totalCharge.toFixed(2)}`;
        const noteText = formatInvoiceNoteToEnglish(rawNote);

        if (existingEntryIdx >= 0) {
          ledgerEntries[existingEntryIdx] = {
            ...ledgerEntries[existingEntryIdx],
            customer_name: cust.name,
            shipping_mark: cust.shipping_mark || ctn.shipping_mark,
            amount: totalCharge,
            note: noteText,
            reference_no: ledgerRef,
          };
        } else {
          const newLedgerEntry: LedgerEntry = {
            id: `ledg-auto-${ctn.id}-${Date.now().toString().slice(-4)}`,
            customer_id: cust.id,
            customer_code: cust.customer_code,
            shipping_mark: cust.shipping_mark || ctn.shipping_mark,
            customer_name: cust.name,
            type: 'charge',
            amount: totalCharge,
            reference_no: ledgerRef,
            note: noteText,
            source: 'auto_cash_collection',
            entered_by: 'system',
            entered_by_name: 'System Billing Auto-resolve',
            created_at: ctn.created_at || new Date().toISOString(),
          };
          ledgerEntries.push(newLedgerEntry);
        }
      }
    });

    // Update Customer Profile Totals
    const custPaid = cust.total_paid || 0;
    const custLedgerChargesSum = ledgerEntries
      .filter((e) => e.customer_id === custId && e.type === 'charge')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalBilled = custLedgerChargesSum > 0 ? custLedgerChargesSum : customerTotalCartonCharges;
    const totalDue = Math.max(0, totalBilled - custPaid);

    updatedCustomersMap.set(cust.id, {
      ...cust,
      rate_per_kg: custRate,
      total_billed: Number(totalBilled.toFixed(2)),
      total_due: Number(totalDue.toFixed(2)),
    });
  });

  const finalCustomers = Array.from(updatedCustomersMap.values());
  const finalCartons = Array.from(updatedCartonsMap.values());

  saveHostingerDbMultiData({
    fsc_vps_customers: finalCustomers,
    fsc_vps_cartons: finalCartons,
    fsc_vps_ledger: ledgerEntries,
  });

  return {
    customers: finalCustomers,
    cartons: finalCartons,
    ledgerEntries,
  };
};
