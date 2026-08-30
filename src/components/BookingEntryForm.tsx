import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Search,
  UserCheck,
  Upload,
  Zap,
  Eye,
  X,
  FileCheck,
  Scale,
  MapPin,
  Building2,
  ListPlus,
  AlertTriangle,
  Printer,
} from 'lucide-react';
import { Carton, Warehouse, User, Language, Customer, LedgerEntry } from '../types';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction, publishSystemNotification } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { BookedCartonsHub } from './BookedCartonsHub';
import { CartonInvoicesModal } from './CartonInvoicesModal';

interface BookingEntryFormProps {
  warehouses: Warehouse[];
  currentUser: User;
  onSaveCartons: (newCartons: Carton[]) => void;
  language: Language;
}

interface BatchCartonRow {
  id: string;
  entry_date: string;
  ctn_no: string;
  packaging_number: string;
  shipping_mark: string;
  product_name_en: string;
  product_name_cn: string;
  quantity: number;
  net_weight: number;
  gross_weight: number;
  cbm: number;
  photo_url?: string;
}

export const BookingEntryForm: React.FC<BookingEntryFormProps> = ({
  warehouses,
  currentUser,
  onSaveCartons,
  language,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isBn = language === 'bn';
  const myWhId = currentUser.warehouse_id || 'wh-china';
  const myWh = warehouses.find((w) => w.id === myWhId);

  const todayStr = new Date().toISOString().split('T')[0];

  // Customer List Database State
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);

  // -------------------------------------------------------------
  // REAL PRODUCTION FORM STATES (ZERO DUMMY DATA INJECTED)
  // -------------------------------------------------------------
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Custom Shipping Mark Prefix & Code Inputs (e.g. SM-DHAKA-88)
  const [markPrefix, setMarkPrefix] = useState('');
  const [markCode, setMarkCode] = useState('');
  const [shippingMark, setShippingMark] = useState('');

  // CUSTOMIZABLE CARTON PREFIX & START NUMBER
  const [cartonPrefix, setCartonPrefix] = useState('CTN-');
  const [cartonStartNum, setCartonStartNum] = useState<number | ''>(1);

  // Master Tracking Number (Blank by default in production)
  const [masterTrackingNumber, setMasterTrackingNumber] = useState('');
  
  // Destination Warehouse Selector State
  const [destWhId, setDestWhId] = useState('wh-bd');

  // Product & Spec Details for the Batch (BLANK BY DEFAULT IN PRODUCTION)
  const [batchProdNameEn, setBatchProdNameEn] = useState('');
  const [batchProdNameCn, setBatchProdNameCn] = useState('');
  const [batchCartonCount, setBatchCartonCount] = useState<number | ''>('');
  const [boxPrefix, setBoxPrefix] = useState('BOX-A');
  const [batchQtyPerCarton, setBatchQtyPerCarton] = useState<number | ''>('');
  const [batchNetWeight, setBatchNetWeight] = useState<number | ''>('');
  const [batchGrossWeight, setBatchGrossWeight] = useState<number | ''>('');
  const [batchCbm, setBatchCbm] = useState<number | ''>('');

  // METHOD 1 WEIGHT AUTOMATION STATES (N.Weight & G.Weight)
  const [netWeightsListInput, setNetWeightsListInput] = useState('');
  const [grossWeightsListInput, setGrossWeightsListInput] = useState('');

  // Shared Batch Proof Photo Attachment
  const [batchPhotoUrl, setBatchPhotoUrl] = useState<string>('');
  const [previewPhotoModalUrl, setPreviewPhotoModalUrl] = useState<string | null>(null);
  const [printedInvoicesCartons, setPrintedInvoicesCartons] = useState<Carton[] | null>(null);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // LIVE BOOKING PREVIEW ROWS STATE (STARTS EMPTY IN PRODUCTION)
  const [previewRows, setPreviewRows] = useState<BatchCartonRow[]>([]);

  // Ref & Auto-scroll for Error Banner
  const errorBannerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorMsg) {
      setTimeout(() => {
        errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [errorMsg]);

  // All Saved Cartons State for Live Central Hub View
  const [allSavedCartons, setAllSavedCartons] = useState<Carton[]>([]);

  // Load Customers & Saved Cartons on Mount
  useEffect(() => {
    const data = getHostingerDbData();
    setExistingCustomers(data.customers || []);
    setAllSavedCartons(data.cartons || []);
  }, []);

  // Sync Shipping Mark whenever prefix or code changes
  useEffect(() => {
    if (markPrefix || markCode) {
      setShippingMark(`${markPrefix.trim()}${markCode.trim()}`);
    } else if (!selectedCustomer) {
      setShippingMark('');
    }
  }, [markPrefix, markCode]);

  // Filter Matching Customers for Typeahead Suggestion
  const matchingCustomers = customerSearchInput.trim()
    ? existingCustomers.filter((c) => {
        const q = customerSearchInput.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.shipping_mark || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          (c.customer_code || '').toLowerCase().includes(q)
        );
      })
    : [];

  // Core Helper: Generate Live Preview Rows from Real Form Values
  const generatePreviewFromHeader = (
    countNum: number,
    markStr: string,
    prodEn: string,
    prodCn: string,
    qtyVal: number,
    netWtVal: number,
    grossWtVal: number,
    cbmVal: number,
    prefixStr: string,
    ctnPreStr: string,
    startNoVal: number
  ) => {
    const count = Math.max(1, Math.min(200, countNum));
    const activeMark = markStr.trim();
    const boxCode = prefixStr.trim() || 'BOX-A';
    const ctnPre = ctnPreStr.trim() || 'CTN-';
    const startNo = Math.max(1, startNoVal || 1);

    const newRows: BatchCartonRow[] = [];
    const baseCodeNum = parseInt(markCode.trim());
    const preStr = markPrefix.trim();

    for (let i = 0; i < count; i++) {
      const currentNum = startNo + i;
      const padNum = currentNum < 10 ? `0${currentNum}` : `${currentNum}`;

      // Calculate auto-incrementing Shipping Mark (e.g. AL-DHAKA-88, AL-DHAKA-89, AL-DHAKA-90...)
      let rowShippingMark = activeMark;
      if (!isNaN(baseCodeNum)) {
        rowShippingMark = `${preStr}${baseCodeNum + i}`;
      } else if (activeMark) {
        rowShippingMark = i === 0 ? activeMark : `${activeMark}-${i + 1}`;
      }

      newRows.push({
        id: `prev-row-${Date.now()}-${i}`,
        entry_date: todayStr,
        ctn_no: `${ctnPre}${padNum}`,
        packaging_number: `${boxCode}${100 + currentNum}`,
        shipping_mark: rowShippingMark,
        product_name_en: prodEn,
        product_name_cn: prodCn.trim() || prodEn.trim(),
        quantity: qtyVal,
        net_weight: netWtVal,
        gross_weight: grossWtVal,
        cbm: cbmVal,
        photo_url: batchPhotoUrl || undefined,
      });
    }

    setPreviewRows(newRows);
    return newRows;
  };

  // STRICT PRODUCTION VALIDATION ON GENERATE PREVIEW BUTTON
  const handleUpdatePreviewButton = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!customerSearchInput.trim() && !selectedCustomer) {
      setErrorMsg(isBn ? 'অনুগ্রহ করে কাস্টমার নাম বা শিপিং মার্ক প্রদান করুন!' : 'Please select/enter Customer Name or Shipping Mark!');
      return;
    }

    // Smart Auto-Defaults for smooth instant booking without frustrating validation stops
    const finalTrackingNo = masterTrackingNumber.trim() || `EXP-${Math.floor(Math.random() * 899999 + 100000)}`;
    if (!masterTrackingNumber.trim()) setMasterTrackingNumber(finalTrackingNo);

    const finalProdEn = batchProdNameEn.trim() || 'General Cargo / তৈরি পোশাক';
    if (!batchProdNameEn.trim()) setBatchProdNameEn(finalProdEn);

    const finalMarkCode = markCode.trim() || '01';
    if (!markCode.trim()) setMarkCode(finalMarkCode);

    const finalMarkPrefix = markPrefix.trim() || 'SM-DHAKA-';
    if (!markPrefix.trim()) setMarkPrefix(finalMarkPrefix);

    const ctnCount = Number(batchCartonCount) > 0 ? Number(batchCartonCount) : 1;
    const qtyVal = Number(batchQtyPerCarton) > 0 ? Number(batchQtyPerCarton) : 50;
    const grossWt = Number(batchGrossWeight) > 0 ? Number(batchGrossWeight) : 12.5;
    const netWt = Number(batchNetWeight) > 0 ? Number(batchNetWeight) : 11.2;
    const cbmVal = Number(batchCbm) > 0 ? Number(batchCbm) : 0.15;

    const markToUse = `${finalMarkPrefix}${finalMarkCode}`;
    generatePreviewFromHeader(
      ctnCount,
      markToUse,
      finalProdEn,
      batchProdNameCn,
      qtyVal,
      netWt,
      grossWt,
      cbmVal,
      boxPrefix,
      cartonPrefix,
      Number(cartonStartNum) || 1
    );

    setSuccessMsg(
      isBn
        ? `প্রিভিউ তালিকা জেনারেট সম্পন্ন! মোট ${ctnCount}টি কার্টুন রো আপডেট করা হয়েছে। টেবিলে চেক করে "বুকিং ডাইরেক্ট সেভ করুন" বাটনে ক্লিক করুন।`
        : `Preview generated with ${ctnCount} cartons! Review the table below and click "Save Booking Direct".`
    );
  };

  // METHOD 1 ONLY: FAST WEIGHT SEQUENCE PASTING FOR N.WT & G.WT
  const handleApplyNetWeightsList = () => {
    if (!netWeightsListInput.trim()) return;

    const parsed = netWeightsListInput
      .split(/[\s,;\n]+/)
      .map((v) => parseFloat(v))
      .filter((n) => !isNaN(n) && n > 0);

    if (parsed.length === 0) return;

    setPreviewRows((prev) =>
      prev.map((r, idx) => ({
        ...r,
        net_weight: parsed[idx] !== undefined ? parsed[idx] : r.net_weight,
      }))
    );
  };

  const handleApplyGrossWeightsList = () => {
    if (!grossWeightsListInput.trim()) return;

    const parsed = grossWeightsListInput
      .split(/[\s,;\n]+/)
      .map((v) => parseFloat(v))
      .filter((n) => !isNaN(n) && n > 0);

    if (parsed.length === 0) return;

    setPreviewRows((prev) =>
      prev.map((r, idx) => ({
        ...r,
        gross_weight: parsed[idx] !== undefined ? parsed[idx] : r.gross_weight,
      }))
    );
  };

  // Process Customer Identification & Ledger Auto-Billing
  const processCustomerBooking = (
    selectedCust: Customer | null,
    rawNameOrMarkInput: string,
    totalBatchWeight: number
  ) => {
    const data = getHostingerDbData();
    const currentCusts: Customer[] = data.customers || [];
    const currentLedger: LedgerEntry[] = data.ledgerEntries || [];

    let targetCustomer: Customer;
    let isNew = false;

    if (selectedCust) {
      targetCustomer = selectedCust;
    } else {
      const match = currentCusts.find(
        (c) =>
          c.name.toLowerCase() === rawNameOrMarkInput.trim().toLowerCase() ||
          (c.shipping_mark && c.shipping_mark.toLowerCase() === rawNameOrMarkInput.trim().toLowerCase())
      );

      if (match) {
        targetCustomer = match;
      } else {
        isNew = true;
        const cleanMark =
          `${markPrefix.trim()}${markCode.trim()}` || rawNameOrMarkInput.toUpperCase().replace(/\s+/g, '-').slice(0, 15);
        const newCustId = `cust-${Date.now()}`;
        const newCustCode = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;

        targetCustomer = {
          id: newCustId,
          customer_code: newCustCode,
          shipping_mark: cleanMark,
          name: rawNameOrMarkInput.trim() || `কাস্টমার ${cleanMark}`,
          phone: '+880 1700-000000',
          address: 'Dhaka, Bangladesh',
          total_billed: 0,
          total_paid: 0,
          total_due: 0,
          status: 'active',
          created_at: new Date().toISOString(),
        };
      }
    }

    const freightCharge = Math.round(totalBatchWeight * 1200);
    const newBilled = (targetCustomer.total_billed || 0) + freightCharge;
    const newDue = (targetCustomer.total_due || 0) + freightCharge;

    const updatedTarget: Customer = {
      ...targetCustomer,
      total_billed: newBilled,
      total_due: newDue,
    };

    let newCustomersList: Customer[];
    if (isNew) {
      newCustomersList = [updatedTarget, ...currentCusts];
    } else {
      newCustomersList = currentCusts.map((c) => (c.id === updatedTarget.id ? updatedTarget : c));
    }
    saveHostingerDbData('fsc_vps_customers', newCustomersList);
    setExistingCustomers(newCustomersList);

    const newLedgerCharge: LedgerEntry = {
      id: `ledg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customer_id: updatedTarget.id,
      customer_code: updatedTarget.customer_code,
      shipping_mark: updatedTarget.shipping_mark,
      customer_name: updatedTarget.name,
      type: 'charge',
      amount: freightCharge,
      note: `ওয়্যারহাউজ ট্র্যাকিং ${masterTrackingNumber} বুকিং ফিলিং (${totalBatchWeight} kg @ ৳1200/kg)`,
      source: 'manual',
      entered_by: currentUser.id,
      entered_by_name: `${currentUser.name} (${currentUser.role})`,
      warehouse_id: currentUser.warehouse_id || 'wh-china',
      created_at: new Date().toISOString(),
    };

    saveHostingerDbData('fsc_vps_ledger', [newLedgerCharge, ...currentLedger]);

    return updatedTarget;
  };

  // Image Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, rowId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(isBn ? 'ছবি সর্বোচ্চ 5MB হতে পারবে!' : 'File size should not exceed 5MB!');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (rowId) {
        setPreviewRows((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, photo_url: base64String } : r))
        );
      } else {
        setBatchPhotoUrl(base64String);
        setPreviewRows((prev) => prev.map((r) => ({ ...r, photo_url: base64String })));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddPreviewRow = () => {
    const nextIdx = previewRows.length + 1;
    const template = previewRows[previewRows.length - 1] || {
      product_name_en: batchProdNameEn,
      product_name_cn: batchProdNameCn,
      quantity: Number(batchQtyPerCarton) || 1,
      net_weight: Number(batchNetWeight) || 1,
      gross_weight: Number(batchGrossWeight) || 1,
      cbm: Number(batchCbm) || 0.05,
    };

    const ctnPre = cartonPrefix.trim() || 'CTN-';
    const startNo = Math.max(1, Number(cartonStartNum) || 1);
    const currentNum = startNo + previewRows.length;
    const padNum = currentNum < 10 ? `0${currentNum}` : `${currentNum}`;

    const baseCodeNum = parseInt(markCode.trim());
    let nextMark = shippingMark.trim();
    if (!isNaN(baseCodeNum)) {
      nextMark = `${markPrefix.trim()}${baseCodeNum + previewRows.length}`;
    } else if (nextMark) {
      nextMark = `${nextMark}-${previewRows.length + 1}`;
    }

    setPreviewRows([
      ...previewRows,
      {
        id: `row-${Date.now()}`,
        entry_date: todayStr,
        ctn_no: `${ctnPre}${padNum}`,
        packaging_number: `${boxPrefix}${100 + currentNum}`,
        shipping_mark: nextMark,
        product_name_en: template.product_name_en,
        product_name_cn: template.product_name_cn,
        quantity: template.quantity,
        net_weight: template.net_weight,
        gross_weight: template.gross_weight,
        cbm: template.cbm,
        photo_url: batchPhotoUrl || undefined,
      },
    ]);
  };

  const handleRemovePreviewRow = (rowId: string) => {
    if (previewRows.length <= 1) return;
    setPreviewRows(previewRows.filter((r) => r.id !== rowId));
  };

  const handleRowUpdate = (rowId: string, field: keyof BatchCartonRow, val: any) => {
    setPreviewRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: val } : r)));
  };

  // SUBMIT ALL CARTONS BOOKING TO SYSTEM DATABASE
  const handleSubmitFinalBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (previewRows.length === 0) {
      setErrorMsg(isBn ? 'প্রিভিউ টেবিলে কোনো কার্টুন পাওয়া যায়নি! প্রথমে ফর্ম পূরণ করে জেনারেট করুন।' : 'No cartons in preview table! Please fill form and click generate preview.');
      return;
    }

    const invalidRow = previewRows.find(
      (r) =>
        !r.product_name_en.trim() ||
        !r.shipping_mark.trim() ||
        !r.quantity || r.quantity <= 0 ||
        !r.gross_weight || r.gross_weight <= 0
    );

    if (invalidRow) {
      setErrorMsg(isBn ? 'টেবিলের সকল কার্টুনে সঠিক পণ্যের নাম, পিস ও গ্রস ওজন প্রদান করা বাধ্যতামূলক!' : 'All carton rows must have valid product names, Qty, and Gross Weight!');
      return;
    }

    const totalBatchWeight = previewRows.reduce((acc, curr) => acc + (curr.gross_weight || 0), 0);
    const customer = processCustomerBooking(selectedCustomer, customerSearchInput, totalBatchWeight);
    const finalMark = shippingMark.trim() || customer.shipping_mark || `${markPrefix.trim()}${markCode.trim()}`;

    const newCartonObjects: Carton[] = previewRows.map((r, idx) => ({
      id: `fsc-carton-${Date.now()}-${idx + 1}`,
      ctn_no: r.ctn_no.trim() || `CTN-${idx + 1}`,
      packaging_number: r.packaging_number.trim() || `BOX-${101 + idx}`,
      shipping_mark: r.shipping_mark || finalMark,
      tracking_number: masterTrackingNumber.trim(),
      master_tracking_number: masterTrackingNumber.trim(),
      product_name_en: r.product_name_en,
      product_name_cn: r.product_name_cn.trim() || r.product_name_en.trim(),
      quantity: r.quantity || 1,
      net_weight: r.net_weight || Math.round((r.gross_weight * 0.9) * 10) / 10,
      gross_weight: r.gross_weight || 1,
      cbm: r.cbm || 0.05,
      photo_url: r.photo_url || batchPhotoUrl || undefined,
      current_warehouse_id: myWhId,
      destination_warehouse_id: destWhId,
      status: 'booked',
      booked_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      current_warehouse_name: myWh?.name,
      destination_warehouse_name: warehouses.find((w) => w.id === destWhId)?.name,
    }));

    // Save cartons to central database & propagate state (Filter out previous cartons with same tracking number)
    const finalTrackingNo = masterTrackingNumber.trim() || `EXP-${Math.floor(Math.random() * 899999 + 100000)}`;
    const currentDbCartons = getHostingerDbData().cartons;
    const filteredExisting = currentDbCartons.filter(
      (c) => c.tracking_number !== finalTrackingNo && c.master_tracking_number !== finalTrackingNo
    );
    const fullUpdatedCartons = [...newCartonObjects, ...filteredExisting];
    saveHostingerDbData('fsc_vps_cartons', fullUpdatedCartons);

    onSaveCartons(newCartonObjects);
    setAllSavedCartons(fullUpdatedCartons);

    // Open Carton Invoices & Print Modal automatically for all booked cartons
    setPrintedInvoicesCartons(newCartonObjects);

    logSystemAuditAction(
      currentUser,
      'BOOK_CARTON_BATCH',
      'carton',
      masterTrackingNumber,
      `একই ট্র্যাকিং ${masterTrackingNumber} এর অধীনে ${previewRows.length}টি কার্টুন বুকিং সম্পন্ন (কাস্টমার: ${customer.name}, মার্ক: ${finalMark}, মোট ওজন: ${totalBatchWeight}kg)`
    );

    // RESET FORM TO CLEAN BLANK STATE FOR NEXT PRODUCTION BOOKING
    setMasterTrackingNumber('');
    setCustomerSearchInput('');
    setSelectedCustomer(null);
    setMarkPrefix('');
    setMarkCode('');
    setShippingMark('');
    setBatchProdNameEn('');
    setBatchProdNameCn('');
    setBatchCartonCount('');
    setBatchQtyPerCarton('');
    setBatchNetWeight('');
    setBatchGrossWeight('');
    setBatchCbm('');
    setBatchPhotoUrl('');
    setNetWeightsListInput('');
    setGrossWeightsListInput('');
    setPreviewRows([]); // Clear preview rows after successful booking save

    setSuccessMsg(isBn ? `🎉 সফলভাবে ${newCartonObjects.length}টি কার্টুন এবং ৳${Math.round(totalBatchWeight * 1200)} লেজার এন্ট্রি সিস্টেমে যুক্ত হয়েছে!` : `Successfully saved ${newCartonObjects.length} cartons and updated ledger!`);
  };

  const totalGrossWeightCalc = previewRows.reduce((acc, r) => acc + (Number(r.gross_weight) || 0), 0);
  const totalCbmCalc = previewRows.reduce((acc, r) => acc + (Number(r.cbm) || 0), 0);

  return (
    <form onSubmit={handleSubmitFinalBooking} className="space-y-6">
      {/* CSS to remove webkit number input spinners & enforce clean table boundaries */}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* ------------------------------------------------------------- */}
      {/* 1. TOP SMART BATCH INPUT FORM */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`p-6 rounded-xl border transition-all shadow-2xs space-y-6 ${
          isDark
            ? 'bg-[#1E293B] border-slate-800 text-white'
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800 gap-4">
          <div>
            <h2 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isBn ? 'কাস্টমার বুকিং এন্ট্রি পোর্টাল' : 'Cargo Booking Entry Portal'}
            </h2>
            <p className={`text-xs mt-0.5 font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isBn
                ? 'কাস্টমার, শিপিং মার্ক ও প্রোডাক্টের সঠিক ডাটা পূরণ করে প্রিভিউ জেনারেট করুন এবং বুকিং সেভ করুন'
                : 'Input actual customer & shipment details to generate cartons, preview live below, and confirm booking'}
            </p>
          </div>

          {/* WAREHOUSE SELECTORS IN HEADER (ORIGIN & DESTINATION DROPDOWNS) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-300'
                : 'bg-blue-50/80 border-blue-200 text-slate-800'
            }`}>
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>অরিজিন:</span>
              <strong className={isDark ? 'text-white font-medium' : 'text-blue-900 font-semibold'}>{myWh?.name || 'Guangzhou Hub (China)'}</strong>
            </div>

            <div className="flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              <span className={`text-xs font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'গন্তব্য ওয়্যারহাউজ:' : 'Destination:'}
              </span>
              <select
                value={destWhId}
                onChange={(e) => setDestWhId(e.target.value)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-medium focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                  isDark
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div
            ref={errorBannerRef}
            className={`p-4 rounded-xl text-xs font-semibold border flex items-center space-x-2.5 shadow-sm transition-all ${
              isDark
                ? 'bg-red-950/80 text-red-200 border-red-800'
                : 'bg-red-100 text-red-950 border-red-300'
            }`}
          >
            <AlertTriangle className="w-4.5 h-4.5 text-red-600 dark:text-red-400 shrink-0" />
            <span className="leading-normal">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Section A: Customer & Shipping Mark Config */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Customer Selection Typeahead */}
          <div className="relative">
            <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {isBn ? 'কাস্টমার নাম নির্বাচন / টাইপ করুন *' : 'Customer Name Select / Type *'}
            </label>

            {selectedCustomer ? (
              <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                isDark ? 'bg-blue-950/40 border-blue-800' : 'bg-blue-50/80 border-blue-200'
              }`}>
                <div>
                  <div className={`text-xs font-medium flex items-center space-x-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{selectedCustomer.name}</span>
                  </div>
                  <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                    Mark: {selectedCustomer.shipping_mark || 'N/A'} • Code: {selectedCustomer.customer_code}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerSearchInput('');
                  }}
                  className="p-1 text-slate-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearchInput}
                    onChange={(e) => {
                      setCustomerSearchInput(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={isBn ? 'কাস্টমার নাম বা ফোন নাম্বার টাইপ করুন...' : 'Type Name or Phone...'}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-normal focus:ring-2 focus:ring-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>

                {showSuggestions && matchingCustomers.length > 0 && (
                  <div className={`absolute z-30 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto border rounded-xl shadow-xl divide-y ${
                    isDark ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-200 divide-slate-100'
                  }`}>
                    {matchingCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerSearchInput(c.name);
                          if (c.shipping_mark) {
                            setShippingMark(c.shipping_mark);
                            const parts = c.shipping_mark.split('-');
                            if (parts.length >= 2) {
                              setMarkPrefix(parts.slice(0, -1).join('-') + '-');
                              setMarkCode(parts[parts.length - 1]);
                            }
                          }
                          setShowSuggestions(false);
                        }}
                        className={`p-2.5 cursor-pointer transition-colors ${
                          isDark ? 'hover:bg-slate-800' : 'hover:bg-blue-50'
                        }`}
                      >
                        <div className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.name}</div>
                        <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 flex justify-between mt-0.5">
                          <span>Mark: {c.shipping_mark || 'N/A'}</span>
                          <span>Phone: {c.phone}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CUSTOMIZABLE SHIPPING MARK PREFIX & CODE */}
          <div>
            <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {isBn ? 'শিপিং মার্ক কাস্টমাইজেশন (প্রিফিক্স + কোড) *' : 'Custom Shipping Mark (Prefix + Code) *'}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={markPrefix}
                onChange={(e) => setMarkPrefix(e.target.value)}
                placeholder="e.g. SM-DHAKA-"
                title={isBn ? 'নাম্বারের আগের লেখাটুকু (Prefix string)' : 'Prefix before number'}
                className={`w-2/3 px-3 py-2.5 rounded-xl border text-xs font-mono font-medium text-blue-600 dark:text-blue-400 ${
                  isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'
                }`}
              />
              <input
                type="text"
                value={markCode}
                onChange={(e) => setMarkCode(e.target.value)}
                placeholder="e.g. 88"
                title={isBn ? 'কোড নম্বর (Code number)' : 'Code number'}
                className={`w-1/3 px-3 py-2.5 rounded-xl border text-xs font-mono font-medium text-center text-blue-600 dark:text-blue-400 ${
                  isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-1">
              শিপিং মার্ক: <strong className="text-blue-600 dark:text-blue-400">{shippingMark || (markPrefix || markCode ? `${markPrefix}${markCode}` : 'N/A')}</strong>
            </div>
          </div>

          {/* Master Tracking Number */}
          <div>
            <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {isBn ? 'মাস্টার ট্র্যাকিং নম্বর (একই ট্র্যাকিং আইডি) *' : 'Master Tracking Number (Shared ID) *'}
            </label>
            <input
              type="text"
              value={masterTrackingNumber}
              onChange={(e) => setMasterTrackingNumber(e.target.value)}
              placeholder="e.g. EXP-994801"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-medium text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 ${
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>
        </div>

        {/* Section B: Product & Batch Specification Form */}
        <div className="border-t pt-5 border-slate-200 dark:border-slate-800 space-y-4">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            {isBn ? '📦 কার্টুন ও পণ্যের বিবরণ (Batch Specification Form)' : 'Batch Product & Carton Specification Form'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Product Name EN */}
            <div>
              <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'ইংরেজি পণ্য নাম *' : 'Product English Name *'}
              </label>
              <input
                type="text"
                value={batchProdNameEn}
                onChange={(e) => setBatchProdNameEn(e.target.value)}
                placeholder="e.g. Men's Cotton T-Shirts"
                className={`w-full px-3.5 py-2 rounded-xl border text-xs font-normal ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* Product Name CN */}
            <div>
              <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'চাইনিজ পণ্য নাম (中文品名) *' : 'Chinese Product Name *'}
              </label>
              <input
                type="text"
                value={batchProdNameCn}
                onChange={(e) => setBatchProdNameCn(e.target.value)}
                placeholder="e.g. 男士棉质T恤"
                className={`w-full px-3.5 py-2 rounded-xl border text-xs font-normal ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* Total Cartons Count */}
            <div>
              <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'মোট কার্টুন সংখ্যা (1 - 100+) *' : 'Total Cartons Count *'}
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={batchCartonCount}
                onChange={(e) => setBatchCartonCount(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                placeholder="e.g. 10"
                className={`w-full px-3.5 py-2 rounded-xl border text-xs font-mono font-medium text-center ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* CUSTOMIZABLE CARTON PREFIX & START NUMBER */}
            <div>
              <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'কার্টুন কোড কাস্টমাইজেশন (প্রিফিক্স + শুরু নম্বর)' : 'Custom Carton Code (Prefix + Start No)'}
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={cartonPrefix}
                  onChange={(e) => setCartonPrefix(e.target.value)}
                  placeholder="CTN-"
                  title={isBn ? 'কার্টুন নামের আগের প্রেফিক্স' : 'Carton prefix before number'}
                  className={`w-2/3 px-3 py-2 rounded-xl border text-xs font-mono font-medium ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <input
                  type="number"
                  min={1}
                  value={cartonStartNum}
                  onChange={(e) => setCartonStartNum(e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                  placeholder="1"
                  title={isBn ? 'কার্টুন শুরু নম্বর' : 'Start number'}
                  className={`w-1/3 px-2 py-2 rounded-xl border text-xs font-mono font-medium text-center ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Qty per Carton */}
            <div>
              <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'পরিমাণ/CTN (PCS) *' : 'Qty per Carton (PCS) *'}
              </label>
              <input
                type="number"
                min={1}
                value={batchQtyPerCarton}
                onChange={(e) => setBatchQtyPerCarton(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                placeholder="e.g. 50"
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono text-center ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* Net Weight */}
            <div>
              <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'গড় নিট ওজন/CTN (KG) *' : 'Avg Net Weight (KG) *'}
              </label>
              <input
                type="number"
                step="0.1"
                min={0.1}
                value={batchNetWeight}
                onChange={(e) => setBatchNetWeight(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                placeholder="e.g. 11.2"
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono text-center ${
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-700'
                }`}
              />
            </div>

            {/* Gross Weight */}
            <div>
              <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'গড় গ্রস ওজন/CTN (KG) *' : 'Avg Gross Weight (KG) *'}
              </label>
              <input
                type="number"
                step="0.1"
                min={0.1}
                value={batchGrossWeight}
                onChange={(e) => setBatchGrossWeight(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                placeholder="e.g. 12.5"
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono text-center font-medium ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* CBM */}
            <div>
              <label className={`block text-xs mb-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'ভলিউম CBM/CTN *' : 'CBM per Carton *'}
              </label>
              <input
                type="number"
                step="0.01"
                min={0.01}
                value={batchCbm}
                onChange={(e) => setBatchCbm(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                placeholder="e.g. 0.15"
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono text-center text-purple-600 dark:text-purple-400 ${
                  isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Section C: METHOD 1 ONLY: FAST WEIGHT SEQUENCE PASTING FOR N.WT & G.WT */}
        {/* ------------------------------------------------------------- */}
        <div
          className={`p-4 rounded-xl border space-y-3 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-blue-50/50 border-blue-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isBn ? '⚖️ কার্টুনের ইনডিভিজুয়াল ওজন দ্রুত পেস্ট টুল (N. Weight & G. Weight Sequence Paste)' : 'Fast Weight Sequence Paste Tool (N. Weight & G. Weight)'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {isBn ? 'কমা বা স্পেস দিয়ে ওজন পেস্ট করুন' : 'Comma or space separated'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Net Weight Sequence Paste */}
            <div className={`p-3 rounded-lg border space-y-2 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {isBn ? '১. নিট ওজন (N. Weight) তালিকা পেস্ট করুন:' : '1. Paste Net Weights (N. Weight) List:'}
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {isBn ? 'যেমন: 11.2, 11.5, 10.8, 11.4' : 'e.g. 11.2, 11.5, 10.8, 11.4'}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={netWeightsListInput}
                  onChange={(e) => setNetWeightsListInput(e.target.value)}
                  placeholder="11.2, 11.5, 10.8..."
                  className={`w-full px-2.5 py-1.5 rounded border text-xs font-mono ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleApplyNetWeightsList}
                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap cursor-pointer flex items-center space-x-1"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'এপ্লাই N.WT' : 'Apply N.WT'}</span>
                </button>
              </div>
            </div>

            {/* Gross Weight Sequence Paste */}
            <div className={`p-3 rounded-lg border space-y-2 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {isBn ? '২. গ্রস ওজন (G. Weight) তালিকা পেস্ট করুন:' : '2. Paste Gross Weights (G. Weight) List:'}
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {isBn ? 'যেমন: 12.5, 12.8, 11.9, 12.6' : 'e.g. 12.5, 12.8, 11.9, 12.6'}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={grossWeightsListInput}
                  onChange={(e) => setGrossWeightsListInput(e.target.value)}
                  placeholder="12.5, 12.8, 11.9..."
                  className={`w-full px-2.5 py-1.5 rounded border text-xs font-mono ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleApplyGrossWeightsList}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium whitespace-nowrap cursor-pointer flex items-center space-x-1"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'এপ্লাই G.WT' : 'Apply G.WT'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section D: Shared Photo Attachment & Generate Preview Button */}
        <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isDark
            ? 'bg-slate-900/60 border-slate-800 text-white'
            : 'bg-slate-50 border-slate-200 text-slate-900'
        }`}>
          <div>
            <div className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isBn ? 'প্যাকেজিং স্লিপ বা প্রোডাক্টের ছবি সংযুক্তি' : 'Packaging Slip / Proof Photo Attachment'}
            </div>
            <p className={`text-[11px] font-normal mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isBn ? 'সকল কার্টুনের সাথে ছবি স্বয়ংক্রিয়ভাবে যুক্ত হবে' : 'Attached proof will apply to generated cartons'}
            </p>
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto">
            {batchPhotoUrl ? (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPreviewPhotoModalUrl(batchPhotoUrl)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-normal flex items-center space-x-1 border ${
                    isDark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ছবি দেখুন' : 'View Proof'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchPhotoUrl('')}
                  className="p-1.5 text-slate-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer flex items-center space-x-1.5 transition-colors border ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
              }`}>
                <Upload className="w-4 h-4 text-slate-500" />
                <span>{isBn ? 'ছবি ফাইল আপলোড করুন' : 'Upload Proof Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e)}
                  className="hidden"
                />
              </label>
            )}

            {/* GENERATE LIVE PREVIEW BUTTON */}
            <button
              type="button"
              onClick={handleUpdatePreviewButton}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-all shadow-md flex items-center space-x-1.5 cursor-pointer select-none border-0 outline-none"
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span className="bg-transparent text-white font-medium">{isBn ? '⚡ প্রিভিউ জেনারেট ও আপডেট করুন' : '⚡ Generate & Update Preview'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. LIVE BOOKING PREVIEW TABLE */}
      {/* ------------------------------------------------------------- */}
      {previewRows.length > 0 ? (
        <div
          className={`rounded-xl border transition-all shadow-2xs overflow-hidden ${
            isDark
              ? 'bg-[#1E293B] border-slate-800 text-white'
              : 'bg-white border-slate-200/90 text-slate-900'
          }`}
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isBn ? 'কাস্টমার বুকিং প্রিভিউ টেবিল (Live Booking Preview)' : 'Live Customer Booking Preview'}
              </h3>
            </div>

            <div className="flex items-center space-x-4 text-xs font-mono text-slate-500">
              <span>মোট কার্টুন: <strong className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{previewRows.length}টি</strong></span>
              <span>মোট ওজন: <strong className="text-emerald-600 dark:text-emerald-400 font-medium">{totalGrossWeightCalc.toFixed(1)} kg</strong></span>
              <span>মোট সিবিএম: <strong className="text-purple-600 dark:text-purple-400 font-medium">{totalCbmCalc.toFixed(2)} CBM</strong></span>
            </div>
          </div>

          {/* Clean Fixed Width Grid Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse border border-slate-200 dark:border-slate-800 table-fixed min-w-[1200px]">
              <colgroup>
                <col style={{ width: '45px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '280px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '85px' }} />
                <col style={{ width: '125px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '55px' }} />
              </colgroup>
              <thead className={`uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-medium ${
                isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-700'
              }`}>
                <tr>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 text-center font-medium">SL</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-medium">ENTRY DATE</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-medium">CTN NO.</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-medium">SHIPPING MARK</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-medium">PRODUCT NAME (EN & CN)</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 text-center font-medium">QTY (PCS)</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 text-center font-medium">N.WEIGHT</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 text-center font-medium">G.WEIGHT</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 text-center font-medium">CBM</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 font-medium">TRACKING NUM</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 text-center font-medium">PROOF</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-800 text-center font-medium">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {previewRows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="p-2 text-center font-mono text-slate-400 border border-slate-200 dark:border-slate-800">
                      {idx + 1}
                    </td>

                    {/* Entry Date */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <input
                        type="date"
                        value={r.entry_date}
                        onChange={(e) => handleRowUpdate(r.id, 'entry_date', e.target.value)}
                        className={`w-full bg-transparent border-0 outline-none text-xs font-mono px-1 py-1 rounded focus:bg-blue-500/10 ${
                          isDark ? 'text-slate-200' : 'text-slate-800'
                        }`}
                      />
                    </td>

                    {/* Carton No */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <input
                        type="text"
                        value={r.ctn_no}
                        onChange={(e) => handleRowUpdate(r.id, 'ctn_no', e.target.value)}
                        className={`w-full bg-transparent border-0 outline-none text-xs font-mono font-medium px-1 py-1 rounded focus:bg-blue-500/10 ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      />
                    </td>

                    {/* Customer Shipping Mark */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <input
                        type="text"
                        value={r.shipping_mark}
                        onChange={(e) => handleRowUpdate(r.id, 'shipping_mark', e.target.value)}
                        placeholder="SM-DHAKA-88"
                        className="w-full bg-transparent border-0 outline-none text-xs font-mono text-blue-600 dark:text-blue-400 font-medium px-1 py-1 rounded focus:bg-blue-500/10 truncate"
                      />
                    </td>

                    {/* Product Name (EN & CN) */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={r.product_name_en}
                          onChange={(e) => handleRowUpdate(r.id, 'product_name_en', e.target.value)}
                          placeholder="Product English Name"
                          className={`w-full bg-transparent border-0 border-b border-slate-200/60 dark:border-slate-800 outline-none text-xs font-normal px-1 py-0.5 focus:bg-blue-500/10 truncate ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        />
                        <input
                          type="text"
                          value={r.product_name_cn}
                          onChange={(e) => handleRowUpdate(r.id, 'product_name_cn', e.target.value)}
                          placeholder="中文品名"
                          className={`w-full bg-transparent border-0 outline-none text-xs font-normal px-1 py-0.5 focus:bg-blue-500/10 truncate ${
                            isDark ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        />
                      </div>
                    </td>

                    {/* Quantity/CTN */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 text-center overflow-hidden">
                      <input
                        type="number"
                        min={1}
                        value={r.quantity}
                        onChange={(e) => handleRowUpdate(r.id, 'quantity', parseInt(e.target.value) || 1)}
                        className={`w-full bg-transparent border-0 outline-none text-xs font-mono text-center px-1 py-1 rounded focus:bg-blue-500/10 ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      />
                    </td>

                    {/* N. Weight (KG) */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 text-center overflow-hidden">
                      <input
                        type="number"
                        step="0.1"
                        min={0.1}
                        value={r.net_weight}
                        onChange={(e) => handleRowUpdate(r.id, 'net_weight', parseFloat(e.target.value) || 0)}
                        className={`w-full bg-transparent border-0 outline-none text-xs font-mono text-center px-1 py-1 rounded focus:bg-blue-500/10 ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      />
                    </td>

                    {/* G. Weight (KG) */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 text-center overflow-hidden">
                      <input
                        type="number"
                        step="0.1"
                        min={0.1}
                        value={r.gross_weight}
                        onChange={(e) => {
                          const newGross = parseFloat(e.target.value) || 0;
                          handleRowUpdate(r.id, 'gross_weight', newGross);
                        }}
                        className={`w-full bg-transparent border-0 outline-none text-xs font-mono text-center font-medium px-1 py-1 rounded focus:bg-blue-500/10 ${
                          isDark ? 'text-white font-bold' : 'text-slate-900 font-bold'
                        }`}
                      />
                    </td>

                    {/* CBM/CTN */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 text-center overflow-hidden">
                      <input
                        type="number"
                        step="0.01"
                        min={0.01}
                        value={r.cbm}
                        onChange={(e) => handleRowUpdate(r.id, 'cbm', parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent border-0 outline-none text-xs font-mono text-center text-purple-600 dark:text-purple-400 px-1 py-1 rounded focus:bg-blue-500/10"
                      />
                    </td>

                    {/* TRACKING NUM */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <input
                        type="text"
                        value={masterTrackingNumber}
                        onChange={(e) => setMasterTrackingNumber(e.target.value)}
                        className={`w-full bg-transparent border-0 outline-none text-xs font-mono px-1 py-1 rounded focus:bg-blue-500/10 truncate ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      />
                    </td>

                    {/* Photo Proof Column */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 text-center overflow-hidden">
                      {r.photo_url ? (
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoModalUrl(r.photo_url!)}
                            className={`px-2 py-1 rounded text-[10px] font-mono border ${
                              isDark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            <span>View</span>
                          </button>
                        </div>
                      ) : (
                        <label className="text-[10px] text-slate-400 hover:text-blue-500 cursor-pointer flex items-center justify-center space-x-1 font-normal">
                          <Upload className="w-3 h-3" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, r.id)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </td>

                    {/* Action Remove */}
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 text-center overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleRemovePreviewRow(r.id)}
                        disabled={previewRows.length <= 1}
                        className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Actions */}
          <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/90 border-slate-200/90'
          }`}>
            <button
              type="button"
              onClick={handleAddPreviewRow}
              className={`px-3.5 py-2 rounded-xl text-xs font-normal transition-colors flex items-center space-x-1.5 cursor-pointer border ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-2xs'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{isBn ? '+ ১টি কার্টুন যোগ করুন' : '+ Add Carton Row'}</span>
            </button>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isBn
                    ? `সকল (${previewRows.length}) টি কার্টুন বুকিং সিস্টেমে সেভ করুন`
                    : `Submit All (${previewRows.length}) Cartons Booking`}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`p-8 rounded-xl border text-center space-y-3 ${
          isDark ? 'bg-[#1E293B] border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
        }`}>
          <FileCheck className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
          <div className="text-xs font-medium">
            {isBn ? 'এখনো কোনো কার্টুন প্রিভিউ জেনারেট হয়নি' : 'No Carton Preview Generated Yet'}
          </div>
          <p className="text-[11px] text-slate-400 max-w-md mx-auto">
            {isBn
              ? 'উপরের ফর্মে কাস্টমার নাম, শিপিং মার্ক, ট্র্যাকিং নম্বর, প্রোডাক্টের সঠিক তথ্য ও কার্টুন সংখ্যা টাইপ করে "⚡ প্রিভিউ জেনারেট ও আপডেট করুন" চাপুন।'
              : 'Please enter actual Customer Name, Shipping Mark, Tracking Number, Product Details, and Carton Count in top form, then click "Generate & Update Preview".'}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. CENTRAL BOOKED CARTONS INVENTORY HUB (LIST & CUSTOMER CARDS) */}
      {/* ------------------------------------------------------------- */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
        <BookedCartonsHub
          cartons={allSavedCartons}
          warehouses={warehouses}
          currentUser={currentUser}
          language={language}
          onUpdateCarton={(updatedCarton) => {
            const data = getHostingerDbData();
            const newCartons = (data.cartons || []).map((c) => (c.id === updatedCarton.id ? updatedCarton : c));
            saveHostingerDbData('fsc_vps_cartons', newCartons);
            setAllSavedCartons(newCartons);
          }}
          onDeleteCarton={(cartonId) => {
            const data = getHostingerDbData();
            const newCartons = (data.cartons || []).filter((c) => c.id !== cartonId);
            saveHostingerDbData('fsc_vps_cartons', newCartons);
            setAllSavedCartons(newCartons);
          }}
        />
      </div>

      {/* Proof Photo Modal Viewer */}
      {previewPhotoModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-2xl max-w-2xl w-full p-6 space-y-4 border shadow-2xl ${
            isDark ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <span>{isBn ? 'প্যাকেজিং স্লিপ ও প্রোডাক্ট প্রমাণ ছবি' : 'Packaging Proof Image Preview'}</span>
              </h3>
              <button
                onClick={() => setPreviewPhotoModalUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto flex items-center justify-center bg-slate-950 rounded-xl p-2">
              <img
                src={previewPhotoModalUrl}
                alt="Proof Slip"
                className="max-h-[55vh] object-contain rounded-lg"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewPhotoModalUrl(null)}
                className={`px-4 py-2 rounded-xl text-xs font-normal ${
                  isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATIC / MANUAL CARTON INVOICES PRINT MODAL */}
      {printedInvoicesCartons && (
        <CartonInvoicesModal
          cartons={printedInvoicesCartons}
          onClose={() => setPrintedInvoicesCartons(null)}
          language={language}
          currentUser={currentUser}
        />
      )}
    </form>
  );
};
