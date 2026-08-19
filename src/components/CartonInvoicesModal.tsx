import React from 'react';
import { X, Printer, Package, ShieldCheck, Download, Barcode, MapPin, Scale, Globe } from 'lucide-react';
import { Carton, Language, User } from '../types';

interface CartonInvoicesModalProps {
  cartons: Carton[];
  onClose: () => void;
  language: Language;
  currentUser?: User;
}

export const CartonInvoicesModal: React.FC<CartonInvoicesModalProps> = ({
  cartons,
  onClose,
  language,
  currentUser,
}) => {
  const isBn = language === 'bn';

  if (!cartons || cartons.length === 0) return null;

  const handlePrintAll = () => {
    window.print();
  };

  const handlePrintSingle = (cartonId: string) => {
    const printContent = document.getElementById(`carton-inv-${cartonId}`);
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Carton Invoice Label - ${cartonId}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; color: #0f172a; }
            .invoice-box { border: 2px solid #00897b; padding: 20px; max-width: 650px; margin: 0 auto; page-break-after: always; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .badge { background: #00897b; color: white; padding: 4px 8px; font-size: 12px; font-weight: bold; }
            .barcode { font-family: monospace; font-size: 22px; letter-spacing: 4px; font-weight: bold; text-align: center; border: 1px dashed #00897b; padding: 8px; margin: 15px 0; background: #f8fafc; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 15px; }
            .details-grid div { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; }
            .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            .data-table th { background: #00897b; color: white; }
            .footer-stamps { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; text-align: center; }
            .stamp-box { border-top: 1px solid #94a3b8; width: 30%; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const masterTracking = cartons[0]?.master_tracking_number || cartons[0]?.tracking_number || 'N/A';
  const shippingMark = cartons[0]?.shipping_mark || 'N/A';
  const originWh = cartons[0]?.current_warehouse_name || 'Guangzhou Hub (China)';
  const destWh = cartons[0]?.destination_warehouse_name || 'Dhaka Central Hub (BD)';

  return (
    <div className="fixed inset-0 z-[2500] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      {/* Printable CSS Media Rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-invoices-area, #printable-invoices-area * {
            visibility: visible !important;
          }
          #printable-invoices-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
          .carton-page-break {
            page-break-after: always !important;
            break-after: page !important;
            margin-bottom: 0 !important;
            box-shadow: none !important;
            border: 2px solid #00897B !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="w-full max-w-5xl bg-slate-900 border-2 border-[#00897B] rounded-none shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Modal Control Bar (Screen Only) */}
        <div className="no-print p-4 bg-[#121214] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-none bg-[#00897B]/20 text-[#26A69A] border border-[#00897B]/40 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                {isBn ? `ইনভয়েস ও শিফটিং লেবেল জেনারেটর (মোট ${cartons.length}টি কার্টুন)` : `Carton Invoice & Shipping Labels (${cartons.length} Cartons)`}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Tracking: <strong className="text-[#26A69A]">{masterTracking}</strong> | Mark: <strong className="text-amber-400">{shippingMark}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handlePrintAll}
              className="px-4 py-2 bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs rounded-none transition-all shadow-md flex items-center space-x-2 cursor-pointer ring-2 ring-[#00897B]/50"
            >
              <Printer className="w-4 h-4" />
              <span>{isBn ? 'সকল কার্টুন ইনভয়েস প্রিন্ট করুন' : 'Print All Invoices'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-none transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-950" id="printable-invoices-area">
          {cartons.map((ctn, index) => {
            const ctnNoStr = ctn.ctn_no || `CTN-${index + 1}`;
            const pkgNoStr = ctn.packaging_number || `BOX-${101 + index}`;
            const barcodeCode = `${ctn.master_tracking_number || masterTracking}-${ctnNoStr}`;

            return (
              <div
                key={ctn.id}
                id={`carton-inv-${ctn.id}`}
                className="carton-page-break bg-white text-slate-900 border-2 border-[#00897B] p-6 shadow-xl relative overflow-hidden font-sans space-y-5"
              >
                {/* Printable Action Ribbon (Screen Only) */}
                <div className="no-print absolute top-3 right-3 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handlePrintSingle(ctn.id)}
                    className="px-3 py-1 bg-slate-100 hover:bg-[#00897B] text-slate-700 hover:text-white border border-slate-300 text-[11px] font-bold rounded-none transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isBn ? 'এই ১টি কার্টুন প্রিন্ট করুন' : 'Print Single Label'}</span>
                  </button>
                </div>

                {/* Company & Document Header */}
                <div className="border-b-2 border-[#00897B] pb-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-[#00897B] text-white font-extrabold text-xl flex items-center justify-center border-2 border-[#00695C] shadow-sm">
                      4★
                    </div>
                    <div>
                      <h1 className="text-lg font-black tracking-wider text-slate-900 leading-tight">
                        FOUR STAR CARGO
                      </h1>
                      <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest">
                        International Express Logistics & Cargo Management
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Guangzhou China • Dhaka Bangladesh • Dubai UAE
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="px-3 py-1 bg-[#00897B] text-white text-[11px] font-bold uppercase tracking-wider block mb-1">
                      CARGO SHIPPING INVOICE
                    </span>
                    <p className="text-xs font-mono font-bold text-slate-800">
                      Invoice No: <span className="text-[#00897B]">INV-{ctn.id.slice(-8).toUpperCase()}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Date: {new Date(ctn.created_at || Date.now()).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>

                {/* Barcode & Unique Tracking Banner */}
                <div className="bg-slate-50 border-2 border-dashed border-[#00897B] p-3 text-center space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    MASTER TRACKING ID & BARCODE SPECIFICATION
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-black tracking-widest text-[#00897B]">
                    ||| | ||||| ||| |||| || |||||| | |||
                  </div>
                  <div className="font-mono text-sm font-bold text-slate-900 tracking-widest">
                    {barcodeCode}
                  </div>
                </div>

                {/* Main 4-Block Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-100 p-2.5 border border-slate-300">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">CARTON NUMBER</span>
                    <span className="text-sm font-black text-[#00897B] font-mono">{ctnNoStr}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-semibold">
                      Index: {index + 1} of {cartons.length}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2.5 border border-slate-300">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">PACKAGING SLIP / BOX</span>
                    <span className="text-sm font-black text-slate-900 font-mono">{pkgNoStr}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-semibold">Slip Code</span>
                  </div>

                  <div className="bg-amber-50 p-2.5 border border-amber-300">
                    <span className="text-[10px] font-bold text-amber-800 block uppercase">SHIPPING MARK</span>
                    <span className="text-sm font-black text-amber-900 font-mono">{ctn.shipping_mark}</span>
                    <span className="text-[10px] text-amber-700 block mt-0.5 font-semibold">Freight Identity</span>
                  </div>

                  <div className="bg-emerald-50 p-2.5 border border-emerald-300">
                    <span className="text-[10px] font-bold text-emerald-800 block uppercase">MASTER TRACKING</span>
                    <span className="text-xs font-black text-emerald-900 font-mono truncate block">{masterTracking}</span>
                    <span className="text-[10px] text-emerald-700 block mt-0.5 font-semibold">Air Express</span>
                  </div>
                </div>

                {/* Customer & Route Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-[11px] text-[#00897B] uppercase block border-b border-slate-200 pb-1 mb-1">
                      CUSTOMER & RECIPIENT INFORMATION
                    </span>
                    <p className="font-bold text-slate-900">
                      Shipping Mark: <span className="text-[#00897B] font-mono">{ctn.shipping_mark}</span>
                    </p>
                    <p className="text-slate-700">
                      Customer Code: <span className="font-mono font-semibold">{(ctn as any).customer_code || 'CUST-GENERAL'}</span>
                    </p>
                    <p className="text-slate-600 text-[11px]">
                      Status: <span className="font-bold text-emerald-700 uppercase">Booked & Confirmed</span>
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-[11px] text-[#00897B] uppercase block border-b border-slate-200 pb-1 mb-1">
                      CARGO ROUTE & WAREHOUSE SPECIFICATION
                    </span>
                    <p className="font-bold text-slate-900 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-[#00897B] shrink-0" />
                      <span>Origin: {originWh}</span>
                    </p>
                    <p className="font-bold text-slate-900 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Destination: {destWh}</span>
                    </p>
                    <p className="text-slate-600 text-[11px]">
                      Booked By: <span className="font-semibold">{currentUser?.name || 'Warehouse Staff'}</span>
                    </p>
                  </div>
                </div>

                {/* Carton Product Specification Table */}
                <div>
                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-[#00897B] text-white font-bold text-[11px] uppercase">
                        <th className="border border-slate-400 p-2 text-left">Product Description</th>
                        <th className="border border-slate-400 p-2 text-left">Chinese Name (中文)</th>
                        <th className="border border-slate-400 p-2 text-center">Qty (PCS)</th>
                        <th className="border border-slate-400 p-2 text-center">N. Weight (KG)</th>
                        <th className="border border-slate-400 p-2 text-center">G. Weight (KG)</th>
                        <th className="border border-slate-400 p-2 text-center">CBM</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white text-slate-900 font-medium">
                        <td className="border border-slate-300 p-2 font-bold">{ctn.product_name_en}</td>
                        <td className="border border-slate-300 p-2 font-mono">{ctn.product_name_cn || '-'}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold">{ctn.quantity}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono">{ctn.net_weight} kg</td>
                        <td className="border border-slate-300 p-2 text-center font-mono font-extrabold text-[#00897B]">
                          {ctn.gross_weight} kg
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-mono">{ctn.cbm} m³</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Attached Packaging Slip Image (If Present) */}
                {ctn.photo_url && (
                  <div className="p-3 bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-slate-600 uppercase block">
                      ATTACHED PACKAGING SLIP / PRODUCT IMAGE
                    </span>
                    <img
                      src={ctn.photo_url}
                      alt="Packaging Slip"
                      className="max-h-36 max-w-sm object-contain border border-slate-300 shadow-sm"
                    />
                  </div>
                )}

                {/* Footer Stamp & Signature Verification Boxes */}
                <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-600">
                  <div className="text-center w-1/3 border-t border-slate-400 pt-1">
                    Prepared By (Warehouse Incharge)
                  </div>
                  <div className="text-center w-1/3 border-t border-slate-400 pt-1">
                    Verified & Measured By (QC)
                  </div>
                  <div className="text-center w-1/3 border-t border-slate-400 pt-1">
                    Carrier / Driver Signature
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
