import React from 'react';
import { X, Printer, Package, MapPin } from 'lucide-react';
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

    // Grab all active Tailwind and custom CSS stylesheets from the main window head
    const headStylesHtml = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');

    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Carton Invoice Label - ${cartonId}</title>
          ${headStylesHtml}
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm 8mm;
            }
            * {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            }
            .invoice-box {
              border: 2px solid #00897b !important;
              padding: 16px !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              background-color: #ffffff !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
              max-height: 278mm !important;
              overflow: hidden !important;
            }
            .no-print {
              display: none !important;
            }
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
    }, 450);
  };

  const masterTracking = cartons[0]?.master_tracking_number || cartons[0]?.tracking_number || 'N/A';
  const shippingMark = cartons[0]?.shipping_mark || 'N/A';
  const originWh = cartons[0]?.current_warehouse_name || 'Guangzhou Hub (China)';
  const destWh = cartons[0]?.destination_warehouse_name || 'Dhaka Central Hub (BD)';
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://four.kee2mart.com';

  return (
    <div className="fixed inset-0 z-[2500] bg-[#1E293B]/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      {/* Printable CSS Media Rules - Forces Full Color, Borders, Grid & Styling in Print Mode */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
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
            padding: 0 !important;
            margin: 0 !important;
          }
          .carton-page-break {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 0 0 0 !important;
            padding: 14px 16px !important;
            box-shadow: none !important;
            border: 2px solid #00897B !important;
            max-height: 278mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background-color: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="w-full max-w-4xl bg-[#1E293B] border-2 border-[#00897B] rounded-none shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Top Modal Control Bar (Screen Only) */}
        <div className="no-print p-3 sm:p-4 bg-[#1E293B] border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-none bg-[#00897B]/20 text-[#26A69A] border border-[#00897B]/40 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold text-white">
                {isBn ? `ইনভয়েস ও শিফটিং লেবেল জেনারেটর (মোট ${cartons.length}টি কার্টুন)` : `Carton Invoice & Shipping Labels (${cartons.length} Cartons)`}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Tracking: <strong className="text-[#26A69A]">{masterTracking}</strong> | Mark: <strong className="text-amber-400">{shippingMark}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              type="button"
              onClick={handlePrintAll}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs rounded-none transition-all shadow-md flex items-center space-x-1.5 cursor-pointer ring-2 ring-[#00897B]/50"
            >
              <Printer className="w-4 h-4" />
              <span>{isBn ? 'সকল কার্টুন ইনভয়েস প্রিন্ট করুন' : 'Print All Invoices'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-none transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-5 bg-[#1E293B]" id="printable-invoices-area">
          {cartons.map((ctn, index) => {
            const ctnNoStr = ctn.ctn_no || `CTN-${index + 1}`;
            const pkgNoStr = ctn.packaging_number || `BOX-${101 + index}`;
            const trkNum = ctn.tracking_number || ctn.master_tracking_number || masterTracking;
            const barcodeCode = `${ctn.master_tracking_number || masterTracking}-${ctnNoStr}`;

            // Real-Time Dynamic QR Code URL linking to Public Cargo Tracking Portal with pre-filled tracking number
            const trackingPortalUrl = `${siteOrigin}/tracking?search=${encodeURIComponent(trkNum)}`;
            const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(trackingPortalUrl)}`;

            return (
              <div
                key={ctn.id}
                id={`carton-inv-${ctn.id}`}
                className="carton-page-break bg-white text-slate-900 border-2 border-[#00897B] p-4 sm:p-5 shadow-xl relative overflow-hidden font-sans space-y-3"
                style={{ backgroundColor: '#ffffff', borderColor: '#00897B' }}
              >
                {/* Printable Action Ribbon (Screen Only) */}
                <div className="no-print absolute top-2 right-2 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handlePrintSingle(ctn.id)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-[#00897B] text-slate-700 hover:text-white border border-slate-300 text-[10px] font-bold rounded-none transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Printer className="w-3 h-3" />
                    <span>{isBn ? 'এই ১টি কার্টুন প্রিন্ট করুন' : 'Print Single Label'}</span>
                  </button>
                </div>

                {/* Company & Document Header with Real-Time QR Code */}
                <div className="border-b-2 border-[#00897B] pb-3 flex items-start justify-between" style={{ borderBottomColor: '#00897B' }}>
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-11 h-11 text-white font-extrabold text-lg flex items-center justify-center border-2 border-[#00695C] shadow-sm shrink-0"
                      style={{ backgroundColor: '#00897B', color: '#ffffff', borderColor: '#00695C' }}
                    >
                      4★
                    </div>
                    <div>
                      <h1 className="text-base font-black tracking-wider text-slate-900 leading-tight">
                        FOUR STAR CARGO
                      </h1>
                      <p className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider">
                        International Express Logistics & Cargo Management
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono">
                        Guangzhou China • Dhaka Bangladesh • Dubai UAE
                      </p>
                    </div>
                  </div>

                  {/* Real-time Scannable Tracking QR Code + Invoice Badge */}
                  <div className="flex items-center space-x-3 text-right">
                    <div className="flex flex-col items-center">
                      <img
                        src={qrCodeImgUrl}
                        alt={`QR Code for Tracking ${trkNum}`}
                        className="w-16 h-16 sm:w-20 sm:h-20 border border-slate-300 p-1 bg-white shadow-2xs"
                        style={{ backgroundColor: '#ffffff', borderColor: '#CBD5E1' }}
                        title="Scan to track live cargo status"
                      />
                      <span className="text-[8px] font-mono font-bold text-[#00897B] mt-0.5 tracking-tighter" style={{ color: '#00897B' }}>
                        SCAN TO TRACK LIVE
                      </span>
                    </div>

                    <div className="flex flex-col items-end justify-center space-y-0.5">
                      <span
                        className="px-2 py-0.5 text-white text-[10px] font-bold uppercase tracking-wider block"
                        style={{ backgroundColor: '#00897B', color: '#ffffff' }}
                      >
                        CARGO SHIPPING INVOICE
                      </span>
                      <p className="text-[11px] font-mono font-bold text-slate-800">
                        Invoice No: <span className="text-[#00897B]" style={{ color: '#00897B' }}>INV-{ctn.id.slice(-8).toUpperCase()}</span>
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono">
                        Date: {new Date(ctn.created_at || Date.now()).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Barcode & Unique Tracking Banner */}
                <div
                  className="bg-slate-50 border-2 border-dashed border-[#00897B] p-2 text-center space-y-0.5"
                  style={{ backgroundColor: '#F8FAFC', borderColor: '#00897B' }}
                >
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    MASTER TRACKING ID & BARCODE SPECIFICATION
                  </div>
                  <div className="font-mono text-lg sm:text-xl font-black tracking-widest text-[#00897B] leading-none" style={{ color: '#00897B' }}>
                    ||| | ||||| ||| |||| || |||||| | |||
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-900 tracking-widest">
                    {barcodeCode}
                  </div>
                </div>

                {/* Main 4-Block Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-100 p-2 border border-slate-300" style={{ backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }}>
                    <span className="text-[9px] font-bold text-slate-500 block uppercase">CARTON NUMBER</span>
                    <span className="text-xs font-black text-[#00897B] font-mono" style={{ color: '#00897B' }}>{ctnNoStr}</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5 font-semibold">
                      Index: {index + 1} of {cartons.length}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2 border border-slate-300" style={{ backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }}>
                    <span className="text-[9px] font-bold text-slate-500 block uppercase">PACKAGING SLIP / BOX</span>
                    <span className="text-xs font-black text-slate-900 font-mono">{pkgNoStr}</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5 font-semibold">Slip Code</span>
                  </div>

                  <div className="bg-amber-50 p-2 border border-amber-300" style={{ backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}>
                    <span className="text-[9px] font-bold text-amber-800 block uppercase" style={{ color: '#92400E' }}>SHIPPING MARK</span>
                    <span className="text-xs font-black text-amber-900 font-mono" style={{ color: '#78350F' }}>{ctn.shipping_mark}</span>
                    <span className="text-[9px] text-amber-700 block mt-0.5 font-semibold" style={{ color: '#B45309' }}>Freight Identity</span>
                  </div>

                  <div className="bg-emerald-50 p-2 border border-emerald-300" style={{ backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' }}>
                    <span className="text-[9px] font-bold text-emerald-800 block uppercase" style={{ color: '#065F46' }}>MASTER TRACKING</span>
                    <span className="text-[11px] font-black text-emerald-900 font-mono truncate block" style={{ color: '#064E3B' }}>{trkNum}</span>
                    <span className="text-[9px] text-emerald-700 block mt-0.5 font-semibold" style={{ color: '#047857' }}>Air Express</span>
                  </div>
                </div>

                {/* Customer & Route Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 border border-slate-200 space-y-0.5" style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}>
                    <span className="font-bold text-[10px] text-[#00897B] uppercase block border-b border-slate-200 pb-0.5 mb-0.5" style={{ color: '#00897B', borderBottomColor: '#E2E8F0' }}>
                      CUSTOMER & RECIPIENT INFORMATION
                    </span>
                    <p className="font-bold text-slate-900 text-[11px]">
                      Shipping Mark: <span className="text-[#00897B] font-mono" style={{ color: '#00897B' }}>{ctn.shipping_mark}</span>
                    </p>
                    <p className="text-slate-700 text-[11px]">
                      Customer Code: <span className="font-mono font-semibold">{(ctn as any).customer_code || 'CUST-GENERAL'}</span>
                    </p>
                    <p className="text-slate-600 text-[10px]">
                      Status: <span className="font-bold text-emerald-700 uppercase" style={{ color: '#047857' }}>Booked & Confirmed</span>
                    </p>
                  </div>

                  <div className="p-2 bg-slate-50 border border-slate-200 space-y-0.5" style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}>
                    <span className="font-bold text-[10px] text-[#00897B] uppercase block border-b border-slate-200 pb-0.5 mb-0.5" style={{ color: '#00897B', borderBottomColor: '#E2E8F0' }}>
                      CARGO ROUTE & WAREHOUSE SPECIFICATION
                    </span>
                    <p className="font-bold text-slate-900 text-[11px] flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-[#00897B] shrink-0" style={{ color: '#00897B' }} />
                      <span>Origin: {originWh}</span>
                    </p>
                    <p className="font-bold text-slate-900 text-[11px] flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-emerald-600 shrink-0" style={{ color: '#059669' }} />
                      <span>Destination: {destWh}</span>
                    </p>
                    <p className="text-slate-600 text-[10px]">
                      Booked By: <span className="font-semibold">{currentUser?.name || 'Warehouse Staff'}</span>
                    </p>
                  </div>
                </div>

                {/* Carton Product Specification Table */}
                <div>
                  <table className="w-full border-collapse border border-slate-300 text-xs" style={{ borderColor: '#CBD5E1' }}>
                    <thead>
                      <tr className="bg-[#00897B] text-white font-bold text-[10px] uppercase" style={{ backgroundColor: '#00897B', color: '#ffffff' }}>
                        <th className="border border-slate-400 p-1.5 text-left" style={{ borderColor: '#94A3B8' }}>Product Description</th>
                        <th className="border border-slate-400 p-1.5 text-left" style={{ borderColor: '#94A3B8' }}>Chinese Name (中文)</th>
                        <th className="border border-slate-400 p-1.5 text-center" style={{ borderColor: '#94A3B8' }}>Qty (PCS)</th>
                        <th className="border border-slate-400 p-1.5 text-center" style={{ borderColor: '#94A3B8' }}>N. Weight (KG)</th>
                        <th className="border border-slate-400 p-1.5 text-center" style={{ borderColor: '#94A3B8' }}>G. Weight (KG)</th>
                        <th className="border border-slate-400 p-1.5 text-center" style={{ borderColor: '#94A3B8' }}>CBM</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white text-slate-900 font-medium text-[11px]">
                        <td className="border border-slate-300 p-1.5 font-bold" style={{ borderColor: '#CBD5E1' }}>{ctn.product_name_en}</td>
                        <td className="border border-slate-300 p-1.5 font-mono" style={{ borderColor: '#CBD5E1' }}>{ctn.product_name_cn || '-'}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-mono font-bold" style={{ borderColor: '#CBD5E1' }}>{ctn.quantity}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-mono" style={{ borderColor: '#CBD5E1' }}>{ctn.net_weight} kg</td>
                        <td className="border border-slate-300 p-1.5 text-center font-mono font-extrabold text-[#00897B]" style={{ borderColor: '#CBD5E1', color: '#00897B' }}>
                          {ctn.gross_weight} kg
                        </td>
                        <td className="border border-slate-300 p-1.5 text-center font-mono" style={{ borderColor: '#CBD5E1' }}>{ctn.cbm} m³</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Attached Packaging Slip Image (If Present) */}
                {ctn.photo_url && (
                  <div className="p-2 bg-slate-50 border border-slate-200 space-y-1" style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}>
                    <span className="text-[9px] font-bold text-slate-600 uppercase block">
                      ATTACHED PACKAGING SLIP / PRODUCT IMAGE
                    </span>
                    <img
                      src={ctn.photo_url}
                      alt="Packaging Slip"
                      className="max-h-24 max-w-xs object-contain border border-slate-300 shadow-sm"
                      style={{ borderColor: '#CBD5E1' }}
                    />
                  </div>
                )}

                {/* Footer Stamp & Signature Verification Boxes */}
                <div className="pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-600" style={{ borderTopColor: '#CBD5E1' }}>
                  <div className="text-center w-1/3 border-t border-slate-400 pt-1 font-medium" style={{ borderTopColor: '#94A3B8' }}>
                    Prepared By (Warehouse Incharge)
                  </div>
                  <div className="text-center w-1/3 border-t border-slate-400 pt-1 font-medium" style={{ borderTopColor: '#94A3B8' }}>
                    Verified & Measured By (QC)
                  </div>
                  <div className="text-center w-1/3 border-t border-slate-400 pt-1 font-medium" style={{ borderTopColor: '#94A3B8' }}>
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
