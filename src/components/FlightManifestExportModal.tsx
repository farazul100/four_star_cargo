import React from 'react';
import { Printer, Download, FileSpreadsheet, X, Plane } from 'lucide-react';
import { FlyingProposal, Carton, Language } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getProposalDisplayCode } from '../lib/db';
import { sortCartonsForTableDisplay, getCartonRowSpanInfo, getSlNumberForCartonRow } from './BookedCartonsHub';

interface FlightManifestExportModalProps {
  proposal: FlyingProposal;
  cartons: Carton[];
  language: Language;
  onClose: () => void;
}

export const getProposalAttachedCartons = (proposal: FlyingProposal, cartons: Carton[]): Carton[] => {
  if (proposal.carton_ids && proposal.carton_ids.length > 0) {
    const attached = cartons.filter((c) => proposal.carton_ids?.includes(c.id));
    if (attached.length > 0) return attached;
  }
  const flightNo = proposal.flight_number || proposal.flying_name;
  if (flightNo) {
    const attached = cartons.filter(
      (c) => c.flight_number === flightNo || (c as any).proposal_id === proposal.id
    );
    if (attached.length > 0) return attached;
  }
  if (proposal.warehouse_id || proposal.warehouse_name) {
    const matchedWh = cartons.filter(
      (c) =>
        (c.current_warehouse_id && c.current_warehouse_id === proposal.warehouse_id) ||
        (c.warehouse_name && c.warehouse_name === proposal.warehouse_name) ||
        ((c as any).origin_warehouse_id && (c as any).origin_warehouse_id === proposal.warehouse_id)
    );
    if (matchedWh.length > 0 && proposal.items_count) {
      return matchedWh.slice(0, proposal.items_count);
    }
  }
  return cartons.filter((c) => (proposal.carton_ids || []).includes(c.id));
};

export const exportProposalToExcel = (proposal: FlyingProposal, cartons: Carton[]) => {
  const flightDate = proposal.date || new Date().toISOString().split('T')[0];
  const lotNumber = getProposalDisplayCode(proposal);
  const awbNumber = proposal.awb_number || '';
  const hubName = proposal.warehouse_name || 'CHINA GUANGZHOU HUB';

  const attachedCartons = getProposalAttachedCartons(proposal, cartons);
  const listToExport = sortCartonsForTableDisplay(attachedCartons);

  const totalWeight = proposal.total_weight || listToExport.reduce((sum, c) => sum + (c.gross_weight || 0), 0);

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Flight Manifest</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px; }
        th, td { border: 1px solid #000000; padding: 6px; text-align: center; vertical-align: middle; }
        .yellow-header { background-color: #FFC000; color: #000000; font-weight: bold; font-size: 13px; text-align: center; height: 30px; }
        .blue-header { background-color: #3B82F6; color: #FFFFFF; font-weight: bold; font-size: 13px; text-align: center; height: 30px; }
        .table-header { background-color: #FFFFFF; font-weight: bold; font-size: 10px; text-align: center; }
      </style>
    </head>
    <body>
      <table>
        <!-- ROW 1: GOLDEN YELLOW HEADER (LOT NUMBER IS FLIGHT NUMBER) -->
        <tr>
          <td colspan="12" class="yellow-header">
            Date: ${flightDate} &nbsp;&nbsp;&nbsp;&nbsp; LOT- ${lotNumber} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; AWB(${awbNumber})
          </td>
        </tr>
        <!-- ROW 2: ROYAL BLUE HEADER -->
        <tr>
          <td colspan="12" class="blue-header">
            FOUR STAR CARGO (${hubName.toUpperCase()}) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; WT( ${totalWeight.toFixed(1)} KG)
          </td>
        </tr>
        <!-- ROW 3: TABLE HEADERS WITH ENGLISH & CHINESE -->
        <tr class="table-header">
          <td style="font-weight: bold;">SL/NO</td>
          <td style="font-weight: bold;">ENTRY DATE</td>
          <td style="font-weight: bold;">SHIPMENT CTN. NO:</td>
          <td style="font-weight: bold;">CTN. NO:</td>
          <td style="font-weight: bold;">Customer Shipping mark</td>
          <td style="font-weight: bold;">Product name</td>
          <td style="font-weight: bold;">產品名稱</td>
          <td style="font-weight: bold;">Quantity/CTN<br/>每箱产品数量</td>
          <td style="font-weight: bold;">N.Weight<br/>每箱净重量</td>
          <td style="font-weight: bold;">G.Weight<br/>每箱毛重</td>
          <td style="font-weight: bold;">CBM/CTN<br/>每箱体积</td>
          <td style="font-weight: bold;">TRACKING NO</td>
        </tr>
        <!-- DATA ROWS -->
        ${listToExport
          .map((c, i) => {
            const spanInfo = getCartonRowSpanInfo(listToExport, i);
            const slNum = getSlNumberForCartonRow(listToExport, i);

            const entryDate = c.created_at ? new Date(c.created_at).toISOString().slice(2, 10).replace(/-/g, ' ') : flightDate;
            const shipCtnNo = c.packaging_number || c.master_group_id || (c.is_merged ? `MERGED-${c.ctn_no}` : `CTN-${c.ctn_no}`);
            const displayMark = c.sub_shipping_mark || c.shipping_mark;
            const custMark = c.customer_name && !c.customer_name.includes('Unassigned') 
              ? `${displayMark}<br/>${c.customer_name}` 
              : displayMark;
            const trackingNo = c.tracking_number || c.master_tracking_number || c.pathao_tracking_code || c.packaging_number || `TRK-${c.ctn_no}`;

            const rowBg = c.row_color ? c.row_color : (spanInfo.isMerged ? '#EEF2FF' : '#FFFFFF');
            const rowStyle = `background-color: ${rowBg};`;

            return `
              <tr style="${rowStyle}">
                ${spanInfo.isFirst ? `<td rowspan="${spanInfo.rowSpan}" style="background-color: ${rowBg}; font-weight: bold; text-align: center; vertical-align: middle;">${slNum}</td>` : ''}
                <td style="background-color: ${rowBg}; vertical-align: middle;">${entryDate}</td>
                ${spanInfo.isFirst ? `<td rowspan="${spanInfo.rowSpan}" style="background-color: ${rowBg}; font-weight: bold; text-align: center; vertical-align: middle;">${shipCtnNo}</td>` : ''}
                <td style="background-color: ${rowBg}; font-weight: bold; vertical-align: middle;">${c.ctn_no}</td>
                <td style="text-align: left; background-color: ${rowBg}; vertical-align: middle;">${custMark}</td>
                <td style="text-align: left; background-color: ${rowBg}; vertical-align: middle;">${c.product_name_en || ''}</td>
                <td style="text-align: left; background-color: ${rowBg}; vertical-align: middle;">${c.product_name_cn || ''}</td>
                <td style="background-color: ${rowBg}; vertical-align: middle;">${c.quantity || 1}</td>
                <td style="background-color: ${rowBg}; vertical-align: middle;">${(c.net_weight || c.gross_weight * 0.9).toFixed(1)}</td>
                <td style="background-color: ${rowBg}; font-weight: bold; vertical-align: middle;">${c.gross_weight.toFixed(1)}</td>
                <td style="background-color: ${rowBg}; vertical-align: middle;">${c.cbm.toFixed(2)}</td>
                <td style="background-color: ${rowBg}; font-family: monospace; vertical-align: middle;">${trackingNo}</td>
              </tr>
            `;
          })
          .join('')}
        <!-- SUMMARY TOTALS ROW -->
        <tr style="font-weight: bold; background-color: #F9FAFB;">
          <td colspan="7" style="text-align: right; font-weight: bold;">TOTAL PAYLOAD:</td>
          <td>${listToExport.reduce((sum, c) => sum + (c.quantity || 1), 0)}</td>
          <td>${listToExport.reduce((sum, c) => sum + (c.net_weight || c.gross_weight * 0.9), 0).toFixed(1)}</td>
          <td>${listToExport.reduce((sum, c) => sum + (c.gross_weight || 0), 0).toFixed(1)}</td>
          <td>${listToExport.reduce((sum, c) => sum + (c.cbm || 0), 0).toFixed(2)}</td>
          <td>${listToExport.length} Cartons</td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Flight_Manifest_${lotNumber}_${flightDate.replace(/[- ]/g, '_')}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportProposalToCSV = (proposal: FlyingProposal, cartons: Carton[]) => {
  // Plain CSV strips background colors, borders, and cell merging in Google Sheets/Excel.
  // Using styled Excel XML format guarantees full design preservation (Yellow Lot Header, Blue Cargo Header, Borders, Fonts) when imported into Google Sheets!
  exportProposalToExcel(proposal, cartons);
};

export const FlightManifestExportModal: React.FC<FlightManifestExportModalProps> = ({
  proposal,
  cartons,
  language,
  onClose,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  const flightDate = proposal.date || new Date().toISOString().split('T')[0];
  const lotNumber = getProposalDisplayCode(proposal);
  const awbNumber = proposal.awb_number || '';
  const hubName = proposal.warehouse_name || 'CHINA GUANGZHOU HUB';

  const attachedCartons = getProposalAttachedCartons(proposal, cartons);
  const listToExport = sortCartonsForTableDisplay(attachedCartons);

  const totalWeight = proposal.total_weight || listToExport.reduce((sum, c) => sum + (c.gross_weight || 0), 0);
  const totalCbm = proposal.total_cbm || listToExport.reduce((sum, c) => sum + (c.cbm || 0), 0);
  const totalQty = listToExport.reduce((sum, c) => sum + (c.quantity || 1), 0);
  const totalNetWt = listToExport.reduce((sum, c) => sum + (c.net_weight || c.gross_weight * 0.9), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs font-sans">
      <div
        className={`w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* MODAL ACTION BAR (NO PRINT) */}
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-slate-200 dark:border-slate-700 no-print">
          <div className="flex items-center space-x-2">
            <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-semibold">
                {isBn ? 'ফ্লাইট ম্যানিফেস্ট প্রিন্ট ও এক্সপোর্ট রিপোর্ট' : 'Flight Manifest Export & Print Portal'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                Flight: <span className="font-semibold text-blue-600 dark:text-sky-300">{lotNumber}</span> ({flightDate})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isBn ? 'প্রিন্ট করুন' : 'Print Manifest'}</span>
            </button>

            <button
              onClick={() => exportProposalToExcel(proposal, cartons)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isBn ? 'এক্সেল ফাইল (ডিজাইন সহ)' : 'Download Excel (.xlsx)'}</span>
            </button>

            <button
              onClick={() => exportProposalToCSV(proposal, cartons)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isBn ? 'গুগল শিট (ডিজাইন সহ)' : 'Google Sheet (Styled)'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE CONTENT BODY */}
        <div className="p-6 overflow-y-auto flex-1 bg-white text-black font-sans text-xs">
          <div className="max-w-4xl mx-auto border border-black shadow-sm overflow-hidden">
            {/* ROW 1: GOLDEN YELLOW HEADER (LOT NUMBER IS FLIGHT NUMBER) */}
            <div className="bg-[#FFC000] text-black font-semibold text-sm text-center py-2 border-b border-black tracking-wide">
              Date: {flightDate} &nbsp;&nbsp;&nbsp;&nbsp; LOT- {lotNumber} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; AWB({awbNumber})
            </div>

            {/* ROW 2: ROYAL BLUE HEADER */}
            <div className="bg-[#3B82F6] text-white font-semibold text-sm text-center py-2 border-b border-black tracking-wide">
              FOUR STAR CARGO ({hubName.toUpperCase()}) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; WT( {totalWeight.toFixed(1)} KG)
            </div>

            {/* TABLE MANIFEST LIST */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse border border-black">
                <thead className="bg-white text-black font-semibold uppercase text-[10px] text-center border-b border-black">
                  <tr>
                    <th className="p-2 border border-black w-10">SL/NO</th>
                    <th className="p-2 border border-black whitespace-nowrap">ENTRY DATE</th>
                    <th className="p-2 border border-black whitespace-nowrap">SHIPMENT CTN. NO:</th>
                    <th className="p-2 border border-black whitespace-nowrap">CTN. NO:</th>
                    <th className="p-2 border border-black whitespace-nowrap">Customer Shipping mark</th>
                    <th className="p-2 border border-black whitespace-nowrap">Product name</th>
                    <th className="p-2 border border-black whitespace-nowrap">產品名稱</th>
                    <th className="p-2 border border-black whitespace-nowrap text-center">
                      Quantity/CTN<br />
                      <span className="text-[9px] font-normal">每箱产品数量</span>
                    </th>
                    <th className="p-2 border border-black whitespace-nowrap text-center">
                      N.Weight<br />
                      <span className="text-[9px] font-normal">每箱净重量</span>
                    </th>
                    <th className="p-2 border border-black whitespace-nowrap text-center">
                      G.Weight<br />
                      <span className="text-[9px] font-normal">每箱毛重</span>
                    </th>
                    <th className="p-2 border border-black whitespace-nowrap text-center">
                      CBM/CTN<br />
                      <span className="text-[9px] font-normal">每箱体积</span>
                    </th>
                    <th className="p-2 border border-black whitespace-nowrap">TRACKING NO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black text-xs font-normal">
                  {listToExport.map((c, i) => {
                    const spanInfo = getCartonRowSpanInfo(listToExport, i);
                    const slNum = getSlNumberForCartonRow(listToExport, i);

                    const entryDate = c.created_at
                      ? new Date(c.created_at).toISOString().slice(2, 10).replace(/-/g, ' ')
                      : flightDate;
                    const shipCtnNo = c.packaging_number || c.master_group_id || (c.is_merged ? `MERGED-${c.ctn_no}` : `CTN-${c.ctn_no}`);
                    const displayMark = c.sub_shipping_mark || c.shipping_mark;
                    const custMark =
                      c.customer_name && !c.customer_name.includes('Unassigned')
                        ? `${displayMark}\n${c.customer_name}`
                        : displayMark;
                    const trackingNo = c.tracking_number || c.master_tracking_number || c.pathao_tracking_code || c.packaging_number || `TRK-${c.ctn_no}`;

                    const rowBgStyle: React.CSSProperties = c.row_color
                      ? { backgroundColor: c.row_color, color: '#0F172A' }
                      : spanInfo.isMerged
                      ? { backgroundColor: '#EEF2FF' }
                      : {};

                    return (
                      <tr key={c.id} style={rowBgStyle} className="text-center">
                        {spanInfo.isFirst && (
                          <td rowSpan={spanInfo.rowSpan} style={rowBgStyle} className="p-2 border border-black font-bold font-mono align-middle">
                            {slNum}
                          </td>
                        )}
                        <td style={rowBgStyle} className="p-2 border border-black whitespace-nowrap align-middle">{entryDate}</td>
                        {spanInfo.isFirst && (
                          <td rowSpan={spanInfo.rowSpan} style={rowBgStyle} className="p-2 border border-black whitespace-nowrap font-mono font-bold align-middle">
                            {shipCtnNo}
                          </td>
                        )}
                        <td style={rowBgStyle} className="p-2 border border-black whitespace-nowrap font-medium align-middle">{c.ctn_no}</td>
                        <td style={rowBgStyle} className="p-2 border border-black text-left whitespace-pre-line font-medium text-blue-700 dark:text-blue-900 align-middle">
                          {custMark}
                        </td>
                        <td style={rowBgStyle} className="p-2 border border-black text-left align-middle">{c.product_name_en}</td>
                        <td style={rowBgStyle} className="p-2 border border-black text-left align-middle">{c.product_name_cn || '-'}</td>
                        <td style={rowBgStyle} className="p-2 border border-black align-middle">{c.quantity || 1}</td>
                        <td style={rowBgStyle} className="p-2 border border-black align-middle">{(c.net_weight || c.gross_weight * 0.9).toFixed(1)}</td>
                        <td style={rowBgStyle} className="p-2 border border-black font-semibold align-middle">{c.gross_weight.toFixed(1)}</td>
                        <td style={rowBgStyle} className="p-2 border border-black align-middle">{c.cbm.toFixed(2)}</td>
                        <td style={rowBgStyle} className="p-2 border border-black font-mono text-[11px] font-semibold text-slate-800 align-middle">{trackingNo}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="font-semibold bg-slate-50 text-black border-t-2 border-black">
                  <tr>
                    <td colSpan={7} className="p-2.5 text-right border border-black uppercase">
                      Total Payload Summary:
                    </td>
                    <td className="p-2.5 text-center border border-black">{totalQty}</td>
                    <td className="p-2.5 text-center border border-black">{totalNetWt.toFixed(1)} kg</td>
                    <td className="p-2.5 text-center border border-black text-emerald-800">{totalWeight.toFixed(1)} kg</td>
                    <td className="p-2.5 text-center border border-black text-purple-800">{totalCbm.toFixed(2)} CBM</td>
                    <td className="p-2.5 text-center border border-black font-mono">{listToExport.length} Cartons</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

