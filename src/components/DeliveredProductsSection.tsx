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
} from 'lucide-react';
import { Carton, FlyingProposal, User, Language } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';
import { getHostingerDbData } from '../lib/db';

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
  const allCartons: Carton[] = initialCartons && initialCartons.length > 0 ? initialCartons : dbData.cartons || [];
  const allProposals: FlyingProposal[] = initialProposals && initialProposals.length > 0 ? initialProposals : dbData.proposals || [];

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('all');

  const addToast = (title: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Filter cartons that have been received / calibrated at BD Warehouse (status === 'received' or 'delivered' or current_warehouse_id === 'wh-bd')
  const deliveredCartons = allCartons.filter((c) => {
    const isBdStock = c.current_warehouse_id === 'wh-bd' || c.status === 'received' || c.status === 'delivered';
    return isBdStock;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-medium text-slate-900 dark:text-white flex items-center space-x-2.5">
            <div className="p-2 rounded-none bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <PackageCheck className="w-5 h-5" />
            </div>
            <span>{isBn ? 'বিলিকৃত প্রোডাক্ট (BD Received & Calibrated Stock)' : 'Delivered Products Stock'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">
            {isBn
              ? 'অপারেশনস এয়ারপোর্টে রিসিভ করার পর বাংলাদেশ ওয়্যারহাউজ ইনচার্জ কর্তৃক মেপে পাওয়া চূড়ান্ত ওজনে রিসিভকৃত বিলিকৃত প্রোডাক্টের তালিকা।'
              : 'Official billable inventory received & calibrated by BD Warehouse Incharge after airport arrival.'}
          </p>
        </div>

        {onNavigateToDeliveryCash && (
          <button
            type="button"
            onClick={onNavigateToDeliveryCash}
            className="px-4 py-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-all shadow-xs flex items-center space-x-2 cursor-pointer border border-emerald-700 select-none"
          >
            <DollarSign className="w-4 h-4" />
            <span>{isBn ? 'ডেলিভারি ও ক্যাশ আদায়ে যান ➔' : 'Proceed to Delivery & Cash ➔'}</span>
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">{isBn ? 'মোট বিলিকৃত কার্টুন' : 'Total Delivered Cartons'}</span>
            <PackageCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-emerald-600 dark:text-emerald-400">{totalCartonsCount} {isBn ? 'টি' : 'Pcs'}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-normal">{isBn ? 'ওয়্যারহাউজে স্টক রিসিভড' : 'Received into BD Warehouse'}</p>
        </div>

        <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">{isBn ? 'মোট চূড়ান্ত মেপে পাওয়া ওজন' : 'Total Calibrated Gross Weight'}</span>
            <Scale className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-blue-600 dark:text-blue-400">{totalFinalWeight.toFixed(1)} kg</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-normal">{isBn ? 'চূড়ান্ত সত্য বিলিং ওজন' : 'Final official billable weight'}</p>
        </div>

        <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">{isBn ? 'মোট আয়তন (Volume)' : 'Total Volume (CBM)'}</span>
            <Building2 className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-purple-600 dark:text-purple-400">{totalVolumeCbm.toFixed(2)} CBM</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-normal">{isBn ? 'ওয়্যারহাউজ স্পেস ব্যবহৃত' : 'Warehouse space occupied'}</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className={`p-4 rounded-none border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        isDark ? 'bg-[#1C1C1E] border-slate-800' : 'bg-white border-slate-200/90 shadow-2xs'
      }`}>
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBn ? 'কার্টুন নং, ট্র্যাকিং নং, শিপিং মার্ক বা কাস্টমার দিয়ে খুঁজুন...' : 'Search by Carton No, Tracking No, Shipping Mark...'}
            className={`w-full pl-10 pr-4 py-2 rounded-none text-xs font-normal border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Origin Filter Dropdown */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className={`px-3 py-2 rounded-none text-xs font-normal border focus:outline-none cursor-pointer ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
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
        className={`border rounded-none overflow-hidden shadow-2xs ${
          isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center space-x-2">
            <PackageCheck className="w-4 h-4 text-emerald-500" />
            <span>{isBn ? 'বিলিকৃত প্রোডাক্ট তালিকা (Delivered & Calibrated Stock)' : 'Delivered Products List'}</span>
          </h3>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-normal">
            {filteredCartons.length} {isBn ? 'টি রিসিভকৃত কার্টুন' : 'Cartons Total'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-normal border-collapse">
            <thead
              className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                isDark ? 'bg-slate-900/60 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <tr>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">কার্টুন নম্বর (CTN NO)</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">শিপিং মার্ক / ট্র্যাকিং নং</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">প্রোডাক্ট নাম & পিস</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">উৎস ➔ গন্তব্য হাব</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium text-center">ফ্লাইট নং</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  ⚖️ মেপে পাওয়া চূড়ান্ত ওজন
                </th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium text-center">সিবিএম (CBM)</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">অবস্থা (STATUS)</th>
                <th className="p-3.5 text-right font-medium">মেমো & অ্যাকশন</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                isDark ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'
              }`}
            >
              {filteredCartons.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 text-xs font-normal border-b border-slate-200 dark:border-slate-800">
                    {isBn ? 'কোনো বিলিকৃত প্রোডাক্টের ডাটা পাওয়া যায়নি' : 'No delivered products found in stock'}
                  </td>
                </tr>
              ) : (
                filteredCartons.map((c) => {
                  const itemOrigin = (c as any).origin_warehouse_id || c.current_warehouse_id;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold border-r border-b border-slate-200 dark:border-slate-800">
                        {c.ctn_no}
                      </td>
                      <td className="p-3.5 font-normal border-r border-b border-slate-200 dark:border-slate-800">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs">{c.shipping_mark}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.tracking_number}</div>
                      </td>
                      <td className="p-3.5 font-normal border-r border-b border-slate-200 dark:border-slate-800">
                        <div className="font-medium text-slate-900 dark:text-white">{c.product_name_en}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.quantity || 1} Pcs</div>
                      </td>
                      <td className="p-3.5 font-normal border-r border-b border-slate-200 dark:border-slate-800">
                        <span className="inline-flex items-center space-x-1.5 text-xs">
                          <span>{itemOrigin === 'wh-china' ? 'চীন গুয়াংজু' : 'অরিজিন হাব'}</span>
                          <span className="text-slate-400">➔</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">🇧🇩 DAC</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-blue-600 dark:text-blue-400 font-medium border-r border-b border-slate-200 dark:border-slate-800">
                        {c.flight_number || 'US-03'}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-sm bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-r border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center space-x-1 justify-center">
                          <Scale className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{c.gross_weight} kg</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-600 dark:text-slate-400 border-r border-b border-slate-200 dark:border-slate-800">
                        {c.cbm || 0.15}
                      </td>
                      <td className="p-3.5 border-r border-b border-slate-200 dark:border-slate-800">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-none bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{isBn ? 'ওয়্যারহাউজে রিসিভড & বিলিকৃত' : 'Received & Calibrated'}</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-right border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handlePrintSticker(c)}
                            className="px-2.5 py-1 rounded-none bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-normal transition-all border border-slate-300 dark:border-slate-700 cursor-pointer flex items-center space-x-1"
                            title={isBn ? 'স্টিকার / মেমো প্রিন্ট করুন' : 'Print Receipt Sticker'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{isBn ? 'মেমো' : 'Memo'}</span>
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
    </div>
  );
};
