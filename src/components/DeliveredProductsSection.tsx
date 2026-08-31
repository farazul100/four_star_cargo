import React, { useState } from 'react';
import {
  PackageCheck,
  Search,
  Filter,
  CheckCircle2,
  Scale,
  Calendar,
  Building2,
  Printer,
  ArrowRight,
  User as UserIcon,
  Tag,
  DollarSign,
  Truck,
  Bike,
  Send,
  X,
  ExternalLink,
  Check,
  Globe,
} from 'lucide-react';
import { Carton, FlyingProposal, User, Language, LedgerEntry } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction } from '../lib/db';
import { getPathaoApiSettings, createPathaoParcel } from '../lib/pathaoApi';

interface DeliveredProductsSectionProps {
  cartons?: Carton[];
  proposals?: FlyingProposal[];
  currentUser: User;
  language: Language;
  onNavigateToDeliveryCash?: () => void;
}

export const DeliveredProductsSection: React.FC<DeliveredProductsSectionProps> = ({
  cartons: initialCartons,
  proposals: initialProposals,
  currentUser,
  language,
  onNavigateToDeliveryCash,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  const dbData = getHostingerDbData();
  const [cartonsState, setCartonsState] = useState<Carton[]>(() => initialCartons && initialCartons.length > 0 ? initialCartons : dbData.cartons || []);
  const allCartons: Carton[] = cartonsState.length > 0 ? cartonsState : dbData.cartons || [];

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('all');

  // Pathao Modal State
  const [selectedPathaoCarton, setSelectedPathaoCarton] = useState<Carton | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('Dhaka, Bangladesh');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [codAmount, setCodAmount] = useState<number>(0);
  const [isSubmittingPathao, setIsSubmittingPathao] = useState(false);

  // Manual Delivery Modal State
  const [selectedManualCarton, setSelectedManualCarton] = useState<Carton | null>(null);
  const [deliveryRider, setDeliveryRider] = useState('');
  const [manualPaymentStatus, setManualPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [manualCashAmount, setManualCashAmount] = useState<number>(0);

  // Open Pathao Modal (Strictly verifies Pathao is Connected)
  const handleOpenPathaoModal = (carton: Carton) => {
    const pathaoSettings = getPathaoApiSettings();
    if (!pathaoSettings.isConnected || !pathaoSettings.clientId || !pathaoSettings.clientSecret) {
      addToast(
        isBn
          ? '❌ পাঠাও কুরিয়ার কানেক্টেড নেই! সুপার এডমিন সেটিংস (API সেটিংস) থেকে পাঠাও মার্চেন্ট অ্যাকাউন্ট কানেক্ট করুন।'
          : '❌ Pathao Courier is not connected! Please connect Pathao Merchant credentials in Super Admin Settings.',
        'error'
      );
      return;
    }

    setSelectedPathaoCarton(carton);
    setRecipientName(carton.recipient_name || carton.shipping_mark || 'Customer');
    setRecipientPhone(carton.recipient_phone || '01700000000');
    setRecipientAddress(carton.recipient_address || 'Dhaka, Bangladesh');
    setPaymentStatus(carton.payment_status || 'unpaid');
    const defaultCod = Math.round((carton.gross_weight || 1) * 650);
    setCodAmount(carton.cod_amount !== undefined ? carton.cod_amount : defaultCod);
  };

  // Confirm Pathao Booking (Calls Pathao Official Merchant API)
  const handleConfirmPathaoBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPathaoCarton) return;

    const pathaoSettings = getPathaoApiSettings();

    // STRICT CONNECTION CHECK: Block dummy dispatching when disconnected
    if (!pathaoSettings.isConnected || !pathaoSettings.clientId || !pathaoSettings.clientSecret) {
      addToast(
        isBn
          ? '❌ পাঠাও কুরিয়ার কানেক্টেড নেই! সুপার এডমিন সেটিংস থেকে মার্চেন্ট অ্যাকাউন্ট ভেরিফাই করুন।'
          : '❌ Pathao Courier is not connected! Connect Merchant credentials first.',
        'error'
      );
      return;
    }

    setIsSubmittingPathao(true);

    // Call Real Pathao API Endpoint
    const apiRes = await createPathaoParcel(pathaoSettings, {
      merchant_order_id: selectedPathaoCarton.ctn_no,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_address: recipientAddress,
      item_quantity: selectedPathaoCarton.quantity || 1,
      item_weight: selectedPathaoCarton.gross_weight || 0.5,
      amount_to_collect: paymentStatus === 'unpaid' ? codAmount : 0,
    });

    if (!apiRes.success || !apiRes.consignmentId) {
      setIsSubmittingPathao(false);
      addToast(
        isBn
          ? `❌ পাঠাও বুকিং ব্যর্থ: ${apiRes.message}`
          : `❌ Pathao booking failed: ${apiRes.message}`,
        'error'
      );
      return;
    }

    const consignmentId = apiRes.consignmentId;
    const trackingCode = apiRes.trackingCode || consignmentId;

    const updatedCartons = allCartons.map((c) => {
      if (c.id === selectedPathaoCarton.id || c.ctn_no === selectedPathaoCarton.ctn_no) {
        return {
          ...c,
          delivery_method: 'pathao' as const,
          delivery_status: 'sent_to_pathao' as const,
          pathao_consignment_id: consignmentId,
          pathao_tracking_code: trackingCode,
          payment_status: paymentStatus,
          cod_amount: paymentStatus === 'unpaid' ? codAmount : 0,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          recipient_address: recipientAddress,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    setCartonsState(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    logSystemAuditAction(
      currentUser,
      'PATHAO_COURIER_BOOKING',
      'carton',
      selectedPathaoCarton.id,
      `Pathao Courier booking submitted for Carton ${selectedPathaoCarton.ctn_no}. Consignment: ${consignmentId}, COD: ৳${paymentStatus === 'unpaid' ? codAmount : 0}`
    );

    setIsSubmittingPathao(false);
    setSelectedPathaoCarton(null);

    addToast(
      isBn
        ? `✅ পাঠাও কুরিয়ারে বুকিং সফল! আসল ট্র্যাকিং আইডি: ${consignmentId}`
        : `✅ Pathao Courier booking confirmed! Consignment ID: ${consignmentId}`,
      'success'
    );
  };

  // Open Manual Delivery Modal
  const handleOpenManualModal = (carton: Carton) => {
    setSelectedManualCarton(carton);
    setDeliveryRider(carton.recipient_name || '');
    setManualPaymentStatus(carton.payment_status || 'unpaid');
    const defaultCash = Math.round((carton.gross_weight || 1) * 650);
    setManualCashAmount(carton.cod_amount !== undefined ? carton.cod_amount : defaultCash);
  };

  // Confirm Manual Delivery
  const handleConfirmManualDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManualCarton) return;

    const updatedCartons = allCartons.map((c) => {
      if (c.id === selectedManualCarton.id || c.ctn_no === selectedManualCarton.ctn_no) {
        return {
          ...c,
          status: 'delivered' as const,
          delivery_method: 'manual' as const,
          delivery_status: 'delivered_manual' as const,
          payment_status: manualPaymentStatus,
          cod_amount: manualPaymentStatus === 'unpaid' ? manualCashAmount : 0,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    setCartonsState(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    // If cash collected, add entry into ledger
    if (manualPaymentStatus === 'unpaid' && manualCashAmount > 0) {
      const db = getHostingerDbData();
      const currentLedger: LedgerEntry[] = db.ledgerEntries || [];
      const newLedgerEntry: LedgerEntry = {
        id: `ledg-${Date.now()}`,
        customer_id: `cust-${selectedManualCarton.shipping_mark}`,
        customer_code: selectedManualCarton.shipping_mark,
        customer_name: recipientName || selectedManualCarton.shipping_mark,
        type: 'payment',
        amount: manualCashAmount,
        note: `Manual Customer Delivery Cash Collection (CTN: ${selectedManualCarton.ctn_no})`,
        source: 'auto_cash_collection',
        entered_by: currentUser.id,
        entered_by_name: currentUser.name,
        warehouse_id: currentUser.warehouse_id || 'wh-bd',
        created_at: new Date().toISOString(),
      };

      const updatedLedger = [newLedgerEntry, ...currentLedger];
      saveHostingerDbData('fsc_vps_ledger', updatedLedger);
    }

    logSystemAuditAction(
      currentUser,
      'MANUAL_CARTON_DELIVERY',
      'carton',
      selectedManualCarton.id,
      `Manual delivery completed for Carton ${selectedManualCarton.ctn_no}. Status: ${manualPaymentStatus}, Cash: ৳${manualCashAmount}`
    );

    setSelectedManualCarton(null);

    addToast(
      isBn
        ? `✅ কার্টুন #${selectedManualCarton.ctn_no} ম্যানুয়ালি ডেলিভারি সফল হয়েছে!`
        : `✅ Carton #${selectedManualCarton.ctn_no} marked as manually delivered!`,
      'success'
    );
  };

  const addToast = (title: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // User Warehouse Context Resolution
  const userWhId = currentUser?.warehouse_id || 'wh-china';
  const dbWarehouses = dbData.warehouses || [];
  const userWh = dbWarehouses.find((w: any) => w.id === userWhId);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isBdHub = userWhId === 'wh-bd' || userWh?.is_final_destination;

  // Filter cartons strictly by assigned warehouse (Symmetrical Destination & Physical Warehouse Rule)
  const deliveredCartons = allCartons.filter((c) => {
    if (isSuperAdmin) {
      // Super Admin sees all received/delivered cartons globally
      return c.status === 'received' || c.status === 'delivered';
    }

    // STRICT DESTINATION & PHYSICAL LOCATION MATCH:
    // A carton ONLY belongs to a warehouse's Delivered Products page if:
    // 1) THIS warehouse is the DESTINATION hub of the carton (e.g. c.destination_warehouse_id === userWhId)
    // 2) OR the carton is physically currently located at this warehouse (c.current_warehouse_id === userWhId)
    // AND its status is 'received' or 'delivered'!
    const isDestinationOrLocalWh =
      c.destination_warehouse_id === userWhId ||
      c.current_warehouse_id === userWhId ||
      (userWh && c.destination_warehouse_name === userWh.name);

    const isDeliveredOrReceivedStatus = c.status === 'received' || c.status === 'delivered';

    return isDestinationOrLocalWh && isDeliveredOrReceivedStatus;
  });

  // Apply search & origin filter
  const filteredCartons = deliveredCartons.filter((c) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (c.ctn_no || '').toLowerCase().includes(q) ||
      (c.tracking_number || '').toLowerCase().includes(q) ||
      (c.shipping_mark || '').toLowerCase().includes(q) ||
      (c.product_name_en || '').toLowerCase().includes(q) ||
      (c.flight_number || '').toLowerCase().includes(q);

    const originId = (c as any).origin_warehouse_id || c.current_warehouse_id || 'wh-china';
    const matchesOrigin =
      originFilter === 'all'
        ? true
        : originFilter === 'wh-china'
        ? originId === 'wh-china' || originId === 'wh-guangzhou'
        : originId === originFilter;

    return matchesSearch && matchesOrigin;
  });

  // Calculate totals
  const totalCartonsCount = filteredCartons.length;
  const totalFinalWeight = filteredCartons.reduce((acc, c) => acc + (c.gross_weight || 0), 0);
  const totalVolumeCbm = filteredCartons.reduce((acc, c) => acc + (c.cbm || 0), 0);

  // Helper print sticker
  const handlePrintSticker = (carton: Carton) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Carton Receipt Sticker - ${carton.ctn_no}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; line-height: 1.5; color: #111; }
            .badge { border: 2px solid #000; padding: 15px; max-width: 400px; }
            .header { font-size: 18px; font-weight: bold; text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
            .bold { font-weight: bold; }
            .weight-box { font-size: 22px; font-weight: bold; text-align: center; border: 2px dashed #000; padding: 8px; margin-top: 10px; background: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="badge">
            <div class="header">M/S FOUR STAR CARGO BD</div>
            <div class="row"><span class="bold">Carton No:</span> <span>${carton.ctn_no}</span></div>
            <div class="row"><span class="bold">Shipping Mark:</span> <span>${carton.shipping_mark}</span></div>
            <div class="row"><span class="bold">Tracking No:</span> <span>${carton.tracking_number}</span></div>
            <div class="row"><span class="bold">Flight No:</span> <span>${carton.flight_number || 'N/A'}</span></div>
            <div class="row"><span class="bold">Product:</span> <span>${carton.product_name_en}</span></div>
            <div class="weight-box">
              FINAL BILLABLE WEIGHT: ${carton.gross_weight} KG
            </div>
            <div style="font-size: 10px; text-align: center; margin-top: 10px; color: #666;">
              Calibrated & Received at Dhaka Central Freight Hub
            </div>
          </div>
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 font-sans">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-700">
        <div>
          <h2 className={`text-xl font-extrabold flex items-center space-x-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30">
              <PackageCheck className="w-5 h-5" />
            </div>
            <span>
              {isBn
                ? isBdHub
                  ? 'বিলিকৃত প্রোডাক্ট (BD Received & Calibrated Stock)'
                  : `${userWh?.name || 'অরিজিন ওয়্যারহাউজ'} - কার্টুন রিসিভড ও বিলিকৃত স্থিতি`
                : isBdHub
                ? 'Delivered Products Stock (BD Hub)'
                : `${userWh?.name || 'Origin Hub'} - Delivered & Received Stock Status`}
            </span>
          </h2>
          <p className={`text-xs mt-1 font-semibold ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
            {isBn
              ? isBdHub
                ? 'অপারেশনস এয়ারপোর্টে রিসিভ করার পর বাংলাদেশ ওয়্যারহাউজ ইনচার্জ কর্তৃক মেপে পাওয়া চূড়ান্ত ওজনে রিসিভকৃত বিলিকৃত প্রোডাক্টের তালিকা।'
                : `আপনার ওয়্যারহাউজ (${userWh?.name || 'অরিজিন হাব'}) থেকে বুকিংকৃত পণ্যসমূহ গন্তব্য হাবে পৌছে রিসিভড/বিলিকৃত হওয়ার লাইভ তথ্য।`
              : isBdHub
              ? 'Official billable inventory received & calibrated by BD Warehouse Incharge after airport arrival.'
              : `Live delivery & receiving status of cartons originating from your hub (${userWh?.name || 'Origin Hub'}).`}
          </p>
        </div>

        {onNavigateToDeliveryCash && (
          <button
            type="button"
            onClick={onNavigateToDeliveryCash}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all shadow-md flex items-center space-x-2 cursor-pointer border border-emerald-500 select-none"
          >
            <DollarSign className="w-4 h-4" />
            <span>{isBn ? 'ডেলিভারি ও ক্যাশ আদায়ে যান ➔' : 'Proceed to Delivery & Cash ➔'}</span>
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-extrabold uppercase ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{isBn ? 'মোট বিলিকৃত কার্টুন' : 'Total Delivered Cartons'}</span>
            <PackageCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono mt-2 text-emerald-400">{totalCartonsCount} {isBn ? 'টি' : 'Pcs'}</p>
          <p className={`text-[11px] mt-0.5 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{isBn ? 'ওয়্যারহাউজে স্টক রিসিভড' : 'Received into BD Warehouse'}</p>
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-extrabold uppercase ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{isBn ? 'মোট চূড়ান্ত মেপে পাওয়া ওজন' : 'Total Calibrated Gross Weight'}</span>
            <Scale className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono mt-2 text-sky-400">{totalFinalWeight.toFixed(1)} kg</p>
          <p className={`text-[11px] mt-0.5 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{isBn ? 'চূড়ান্ত সত্য বিলিং ওজন' : 'Final official billable weight'}</p>
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-extrabold uppercase ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{isBn ? 'মোট আয়তন (Volume)' : 'Total Volume (CBM)'}</span>
            <Building2 className="w-4 h-4 text-fuchsia-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono mt-2 text-fuchsia-400">{totalVolumeCbm.toFixed(2)} CBM</p>
          <p className={`text-[11px] mt-0.5 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{isBn ? 'ওয়্যারহাউজ স্পেস ব্যবহৃত' : 'Warehouse space occupied'}</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-white border-slate-200/90 shadow-2xs'
      }`}>
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBn ? 'কার্টুন নং, ট্র্যাকিং নং, শিপিং মার্ক বা কাস্টমার দিয়ে খুঁজুন...' : 'Search by Carton No, Tracking No, Shipping Mark...'}
            className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
              isDark ? 'bg-[#0F172A] border-slate-600 text-white placeholder-slate-300' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'
            }`}
          />
        </div>

        {/* Origin Filter Dropdown */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold border focus:outline-none cursor-pointer ${
              isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            <option value="all">{isBn ? 'সকল উৎস হাব (All Origins)' : 'All Origins'}</option>
            <option value="wh-china">চীন (গুয়াংজু হাব) CN</option>
            <option value="wh-hk">হংকং হাব HK</option>
            <option value="wh-dubai">দুবাই হাব DXB</option>
          </select>
        </div>
      </div>

      {/* Main Delivered Cartons Table */}
      <div
        className={`border rounded-2xl overflow-hidden shadow-xl ${
          isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className={`text-sm font-extrabold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <PackageCheck className="w-4 h-4 text-emerald-400" />
            <span>{isBn ? 'বিলিকৃত প্রোডাক্ট তালিকা (Delivered & Calibrated Stock)' : 'Delivered Products List'}</span>
          </h3>
          <span className={`text-xs font-mono font-extrabold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>
            {filteredCartons.length} {isBn ? 'টি রিসিভকৃত কার্টুন' : 'Cartons Total'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-normal border-collapse">
            <thead
              className={`uppercase text-[10px] tracking-wider border-b font-extrabold ${
                isDark ? 'bg-[#1E293B] text-white border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-200'
              }`}
            >
              <tr>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>কার্টুন নম্বর (CTN NO)</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>শিপিং মার্ক / ট্র্যাকিং নং</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>প্রোডাক্ট নাম & পিস</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>উৎস ➔ গন্তব্য হাব</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>ফ্লাইট নং</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${
                  isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-800'
                }`}>
                  ⚖️ মেপে পাওয়া চূড়ান্ত ওজন
                </th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>সিবিএম (CBM)</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>অবস্থা (STATUS)</th>
                <th className={`p-3.5 text-right font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>মেমো & অ্যাকশন</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                isDark ? 'divide-slate-800 text-white' : 'divide-slate-200 text-slate-800'
              }`}
            >
              {filteredCartons.length === 0 ? (
                <tr>
                  <td colSpan={9} className={`p-8 text-center text-xs font-extrabold border-b border-slate-200 dark:border-slate-700 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {isBn ? 'কোনো বিলিকৃত প্রোডাক্টের ডাটা পাওয়া যায়নি' : 'No delivered products found in stock'}
                  </td>
                </tr>
              ) : (
                filteredCartons.map((c) => {
                  const itemOrigin = (c as any).origin_warehouse_id || c.current_warehouse_id;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono text-emerald-400 font-extrabold border-r border-b border-slate-200 dark:border-slate-700">
                        {c.ctn_no}
                      </td>
                      <td className="p-3.5 font-normal border-r border-b border-slate-200 dark:border-slate-700">
                        <div className={`font-extrabold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.shipping_mark}</div>
                        <div className={`text-[10px] font-mono mt-0.5 font-semibold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>{c.tracking_number}</div>
                      </td>
                      <td className="p-3.5 font-normal border-r border-b border-slate-200 dark:border-slate-700">
                        <div className={`font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.product_name_en}</div>
                        <div className={`text-[10px] font-mono font-semibold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>{c.quantity || 1} Pcs</div>
                      </td>
                      <td className="p-3.5 font-normal border-r border-b border-slate-200 dark:border-slate-700">
                        <span className="inline-flex items-center space-x-1.5 text-xs">
                          <span className={`font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{itemOrigin === 'wh-china' ? 'চীন গুয়াংজু' : 'অরিজিন হাব'}</span>
                          <span className={`font-extrabold ${isDark ? 'text-slate-300' : 'text-slate-400'}`}>➔</span>
                          <span className="font-extrabold text-emerald-400">🇧🇩 DAC</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-sky-300 font-extrabold border-r border-b border-slate-200 dark:border-slate-700">
                        {c.flight_number || 'US-03'}
                      </td>
                      <td className="p-3.5 font-mono font-extrabold text-sm bg-emerald-500/10 text-emerald-300 border-r border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center space-x-1 justify-center">
                          <Scale className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{c.gross_weight} kg</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-mono font-extrabold text-white border-r border-b border-slate-200 dark:border-slate-700">
                        {c.cbm || 0.15}
                      </td>
                      <td className="p-3.5 border-r border-b border-slate-200 dark:border-slate-700">
                        {c.delivery_status === 'sent_to_pathao' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/30">
                              <Bike className="w-3.5 h-3.5 text-emerald-400" />
                              <span>পাঠাও কুরিয়ারে বুকড</span>
                            </span>
                            <div className="text-[10px] font-mono text-emerald-300 font-extrabold">
                              ID: {c.pathao_consignment_id}
                            </div>
                            <div className={`text-[9px] font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>
                              {c.payment_status === 'unpaid' ? `COD: ৳${c.cod_amount || 0}` : 'পরিশোধিত (Paid)'}
                            </div>
                          </div>
                        ) : c.status === 'delivered' || c.delivery_status === 'delivered_manual' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-500/20 text-sky-300 text-[10px] font-extrabold border border-blue-500/30">
                              <Truck className="w-3.5 h-3.5 text-sky-400" />
                              <span>ম্যানুয়ালি বিলিকৃত (Delivered)</span>
                            </span>
                            <div className={`text-[9px] font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>
                              {c.payment_status === 'unpaid' ? `আদায়কৃত: ৳${c.cod_amount || 0}` : 'পরিশোধিত (Paid)'}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-extrabold border border-amber-500/30">
                            <CheckCircle2 className="w-3 h-3 text-amber-400" />
                            <span>{isBn ? 'ওয়্যারহাউজে স্টক প্রস্তুত' : 'Ready in Warehouse'}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-end space-x-1.5 whitespace-nowrap">
                          {c.delivery_status !== 'sent_to_pathao' && c.status !== 'delivered' && (
                            <>
                              {/* 1-Click Pathao Courier Booking Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenPathaoModal(c)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold transition-all border border-emerald-500 cursor-pointer flex items-center space-x-1 shadow-md"
                                title={isBn ? 'পাঠাও কুরিয়ারে ১-ক্লিক বুকিং' : 'Book with Pathao Courier'}
                              >
                                <Bike className="w-3.5 h-3.5 text-white" />
                                <span className="tracking-tight">{isBn ? 'পাঠাও কুরিয়ার' : 'Pathao'}</span>
                              </button>

                              {/* Manual Delivery Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenManualModal(c)}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-extrabold transition-all border border-blue-500 cursor-pointer flex items-center space-x-1 shadow-md"
                                title={isBn ? 'ম্যানুয়াল কাস্টমার ডেলিভারি' : 'Manual Customer Delivery'}
                              >
                                <Truck className="w-3.5 h-3.5 text-white" />
                                <span className="tracking-tight">{isBn ? 'ম্যানুয়াল ডেলিভারি' : 'Manual'}</span>
                              </button>
                            </>
                          )}

                          {/* Print Memo Button */}
                          <button
                            type="button"
                            onClick={() => handlePrintSticker(c)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all border cursor-pointer flex items-center space-x-1 ${
                              isDark ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                            title={isBn ? 'মেমো / স্টিকার প্রিন্ট' : 'Print Receipt Memo'}
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-300" />
                            <span className="tracking-tight">{isBn ? 'মেমো' : 'Memo'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PATHAO 1-CLICK BOOKING MODAL */}
      {selectedPathaoCarton && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E293B]/80 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 border border-emerald-500/30">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'পাঠাও কুরিয়ারে ১-ক্লিক বুকিং এন্ট্রি' : 'Pathao Courier 1-Click Dispatch'}
                  </h3>
                  <p className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>CTN: {selectedPathaoCarton.ctn_no} | Weight: {selectedPathaoCarton.gross_weight} KG</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPathaoCarton(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPathaoBooking} className="space-y-4 text-xs">
              {/* Recipient Name */}
              <div className="space-y-1">
                <label className={`font-extrabold block ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {isBn ? 'প্রাপকের নাম (Customer Name)' : 'Recipient Name'}
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-xs outline-none font-semibold ${
                    isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Recipient Phone & Address */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`font-extrabold block ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {isBn ? 'ফোন নম্বর' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs outline-none font-mono font-extrabold ${
                      isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`font-extrabold block ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {isBn ? 'ডেলিভারি ঠিকানা' : 'Address'}
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs outline-none font-semibold ${
                      isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Payment Status (Paid / Unpaid) */}
              <div className={`space-y-1.5 p-3 rounded-xl border ${
                isDark ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
              }`}>
                <label className={`font-extrabold block ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {isBn ? 'পেমেন্ট স্ট্যাটাস (Payment Status)' : 'Payment Status'}
                </label>
                <div className="flex items-center space-x-6 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer font-extrabold">
                    <input
                      type="radio"
                      name="paymentStatus"
                      checked={paymentStatus === 'unpaid'}
                      onChange={() => setPaymentStatus('unpaid')}
                      className="w-4 h-4 accent-amber-500 cursor-pointer"
                    />
                    <span className="text-amber-400">🔴 বাকি / ক্যাশ অন ডেলিভারি (COD Unpaid)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer font-extrabold">
                    <input
                      type="radio"
                      name="paymentStatus"
                      checked={paymentStatus === 'paid'}
                      onChange={() => setPaymentStatus('paid')}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-emerald-400">🟢 পরিশোধিত (Paid)</span>
                  </label>
                </div>

                {/* COD Amount Input (If Unpaid) */}
                {paymentStatus === 'unpaid' && (
                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className={`font-extrabold block ${isDark ? 'text-white' : 'text-slate-800'}`}>{isBn ? 'আদায়যোগ্য টাকার অংক (COD BDT)' : 'COD Amount (BDT)'}</span>
                      <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{isBn ? 'পাঠাও রাইডার কাস্টমারের থেকে সংগ্রহ করবে' : 'To be collected by Pathao Rider'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="font-extrabold text-amber-400">৳</span>
                      <input
                        type="number"
                        min="0"
                        value={codAmount}
                        onChange={(e) => setCodAmount(parseFloat(e.target.value) || 0)}
                        className={`w-28 px-3 py-1.5 border rounded-xl font-extrabold font-mono text-center text-sm outline-none ${
                          isDark ? 'bg-[#1E293B] border-amber-500 text-white' : 'bg-white border-amber-400 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedPathaoCarton(null)}
                  className={`px-4 py-2 font-extrabold rounded-xl text-xs cursor-pointer border ${
                    isDark ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPathao}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-md border border-emerald-500"
                >
                  <Bike className="w-4 h-4" />
                  <span>{isBn ? '🚀 পাঠাও কুরিয়ারে বুকিং কনফার্ম' : 'Confirm Pathao Booking'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL DELIVERY MODAL */}
      {selectedManualCarton && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E293B]/80 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-sky-300 border border-blue-500/30">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'ম্যানুয়াল ডেলিভারি এন্ট্রি' : 'Manual Customer Delivery'}
                  </h3>
                  <p className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>CTN: {selectedManualCarton.ctn_no} | Weight: {selectedManualCarton.gross_weight} KG</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedManualCarton(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmManualDelivery} className="space-y-4 text-xs">
              {/* Payment Status (Paid / Unpaid) */}
              <div className={`space-y-1.5 p-3 rounded-xl border ${
                isDark ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
              }`}>
                <label className={`font-extrabold block ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {isBn ? 'পেমент স্ট্যাটাস (Payment Status)' : 'Payment Status'}
                </label>
                <div className="flex items-center space-x-6 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer font-extrabold">
                    <input
                      type="radio"
                      name="manualPaymentStatus"
                      checked={manualPaymentStatus === 'unpaid'}
                      onChange={() => setManualPaymentStatus('unpaid')}
                      className="w-4 h-4 accent-amber-500 cursor-pointer"
                    />
                    <span className="text-amber-400">🔴 বাকি (নগদ আদায়যোগ্য Cash Collection)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer font-extrabold">
                    <input
                      type="radio"
                      name="manualPaymentStatus"
                      checked={manualPaymentStatus === 'paid'}
                      onChange={() => setManualPaymentStatus('paid')}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-emerald-400">🟢 পরিশোধিত (Paid)</span>
                  </label>
                </div>

                {/* Cash Collection Amount */}
                {manualPaymentStatus === 'unpaid' && (
                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className={`font-extrabold block ${isDark ? 'text-white' : 'text-slate-800'}`}>{isBn ? 'নগদ আদায়কৃত টাকার অংক' : 'Collected Cash Amount'}</span>
                      <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{isBn ? 'সরাসরি লেজারে জমা করা হবে' : 'Synced directly to cash ledger'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="font-extrabold text-sky-400">৳</span>
                      <input
                        type="number"
                        min="0"
                        value={manualCashAmount}
                        onChange={(e) => setManualCashAmount(parseFloat(e.target.value) || 0)}
                        className={`w-28 px-3 py-1.5 border rounded-xl font-extrabold font-mono text-center text-sm outline-none ${
                          isDark ? 'bg-[#1E293B] border-blue-500 text-white' : 'bg-white border-blue-400 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedManualCarton(null)}
                  className={`px-4 py-2 font-extrabold rounded-xl text-xs cursor-pointer border ${
                    isDark ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-md border border-blue-500"
                >
                  <Truck className="w-4 h-4" />
                  <span>{isBn ? '✔ ম্যানুয়াল ডেলিভারি সম্পন্ন করুন' : 'Confirm Manual Delivery'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
