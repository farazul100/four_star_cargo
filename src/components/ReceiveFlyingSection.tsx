import React, { useState } from 'react';
import {
  Truck,
  Plane,
  CheckCircle2,
  Search,
  Filter,
  Package,
  Calendar,
  AlertCircle,
  ArrowRight,
  Printer,
} from 'lucide-react';
import { FlyingProposal, Carton, Warehouse, User, Language } from '../types';
import { ToastContainer, ToastMessage } from './Toast';
import { getHostingerDbData, saveHostingerDbData, saveHostingerDbMultiData, logSystemAuditAction, formatWarehouseNameEn, resolveCanonicalWarehouseId } from '../lib/db';
import { recalculateCustomerLedgerAndBilling } from '../lib/ledgerHelper';
import { useTheme } from '../context/ThemeContext';

interface ReceiveFlyingSectionProps {
  proposals?: FlyingProposal[];
  setProposals?: React.Dispatch<React.SetStateAction<FlyingProposal[]>>;
  cartons: Carton[];
  setCartons: React.Dispatch<React.SetStateAction<Carton[]>>;
  currentUser: User;
  language: Language;
}

export const ReceiveFlyingSection: React.FC<ReceiveFlyingSectionProps> = ({
  proposals: initialProposals,
  setProposals: parentSetProposals,
  cartons,
  setCartons,
  currentUser,
  language,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  const dbData = getHostingerDbData();
  const [localProposals, setLocalProposals] = useState<FlyingProposal[]>(
    initialProposals && initialProposals.length > 0 ? initialProposals : dbData.proposals
  );

  const proposals = initialProposals && initialProposals.length > 0 ? initialProposals : localProposals;
  const updateProposals = parentSetProposals || setLocalProposals;

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_transit' | 'received'>('all');
  const [localWeights, setLocalWeights] = useState<Record<string, string>>({});

  const addToast = (title: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Handler: Mark Flight Received at Bangladesh Airport (By Operations Director)
  const handleMarkReceivedAtBdAirport = (proposalIds: string[], flightNo: string, cartonIds: string[]) => {
    const isBdWarehouseStaff = currentUser?.role === 'warehouse_incharge';

    // 1. Update proposal status to 'arrived_bd' so it unlocks for Warehouse Incharge
    const updatedProposals: FlyingProposal[] = proposals.map((p) => {
      if (proposalIds.includes(p.id) || (flightNo && (p.flight_number === flightNo || p.flying_name === flightNo))) {
        return { ...p, status: isBdWarehouseStaff ? ('received' as const) : ('arrived_bd' as any) };
      }
      return p;
    });
    updateProposals(updatedProposals);

    // 2. Update attached cartons status
    const targetFlightNo = flightNo;
    const updatedCartons: Carton[] = cartons.map((c) => {
      if (cartonIds.includes(c.id) || (targetFlightNo && c.flight_number === targetFlightNo)) {
        return {
          ...c,
          status: isBdWarehouseStaff ? ('received' as const) : ('in_transit' as const),
          current_warehouse_id: isBdWarehouseStaff ? 'wh-bd' : (c.current_warehouse_id || 'wh-china'),
          destination_warehouse_id: 'wh-bd',
        };
      }
      return c;
    });
    setCartons(updatedCartons);

    saveHostingerDbMultiData({
      fsc_vps_proposals: updatedProposals,
      fsc_vps_cartons: updatedCartons,
    });

    logSystemAuditAction(
      currentUser,
      'RECEIVE_FLYING_FLIGHT',
      'flying_proposal',
      flightNo || 'flight-batch',
      `ফ্লাইট ${flightNo || ''} বাংলাদেশ ওয়্যারহাউজে রিসিভ সম্পন্ন (${cartonIds.length}টি কার্টন রিসিভড)`
    );

    // 4. Success Feedback
    addToast(
      isBn
        ? isBdWarehouseStaff
          ? `✅ ফ্লাইট ${flightNo || ''} বাংলাদেশ ওয়্যারহাউজে সফলভাবে স্টক যুক্ত করা হয়েছে!`
          : `✅ ফ্লাইট ${flightNo || ''} বাংলাদেশ এয়ারপোর্টে প্রাপ্ত মার্ক করা হয়েছে! (ওয়্যারহাউজে রিসিভিং ডাটা উন্মুক্ত করা হয়েছে)`
        : `✅ Flight ${flightNo || ''} marked as Arrived at BD Airport!`,
      'success'
    );
  };

  // Filtered proposals list
  const userWhId = currentUser?.warehouse_id || 'wh-bd';
  const canonicalUserWhId = resolveCanonicalWarehouseId(userWhId, currentUser?.warehouse_name);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isWarehouseStaff = currentUser?.role === 'warehouse_incharge';
  const isBdWarehouseStaff = isWarehouseStaff;

  const accessibleProposals = React.useMemo(() => {
    return proposals.filter((p) => {
      // STRICT DESTINATION SCOPING: A warehouse ONLY receives incoming flights destined for ITSELF!
      if (!isSuperAdmin) {
        const pDest = resolveCanonicalWarehouseId(p.destination_warehouse_id, p.destination_warehouse_name);
        if (pDest !== canonicalUserWhId) return false;
      }

      // Hide pending/approved proposals for warehouse staff
      if (isWarehouseStaff && (p.status === 'approved' || p.status === 'pending')) {
        return false;
      }

      return true;
    });
  }, [proposals, currentUser, isSuperAdmin, isWarehouseStaff, canonicalUserWhId]);

  // Group filtered proposals into unified Flight Batch rows
  interface GroupedFlightProposal {
    groupKey: string;
    flying_name: string;
    flight_number: string;
    awb_number: string;
    date: string;
    warehouse_name: string;
    destination_warehouse_name: string;
    status: FlyingProposal['status'];
    proposal_ids: string[];
    carton_ids: string[];
    total_cartons: number;
    total_weight: number;
    total_cbm: number;
    sampleProposal: FlyingProposal;
  }

  const allGroupedBatches = React.useMemo(() => {
    const map = new Map<string, GroupedFlightProposal>();

    accessibleProposals.forEach((p) => {
      const key = (p.flight_number || p.flying_name || p.id).toLowerCase().trim();

      if (!map.has(key)) {
        map.set(key, {
          groupKey: key,
          flying_name: p.flying_name || p.flight_number || 'Flight Batch',
          flight_number: p.flight_number || p.flying_name || 'BS-206',
          awb_number: p.awb_number || '157-884120',
          date: p.date,
          warehouse_name: formatWarehouseNameEn(p.warehouse_name) || 'Guangzhou Air Cargo Hub',
          destination_warehouse_name: formatWarehouseNameEn(p.destination_warehouse_name) || 'Dhaka Central Freight Hub',
          status: p.status,
          proposal_ids: [p.id],
          carton_ids: p.carton_ids ? [...p.carton_ids] : [],
          total_cartons: p.items_count || (p.carton_ids ? p.carton_ids.length : 0),
          total_weight: p.total_weight || 0,
          total_cbm: p.total_cbm || 0,
          sampleProposal: p,
        });
      } else {
        const existing = map.get(key)!;
        if (!existing.proposal_ids.includes(p.id)) {
          existing.proposal_ids.push(p.id);
        }

        const newCartonIds = p.carton_ids || [];
        newCartonIds.forEach((id) => {
          if (!existing.carton_ids.includes(id)) {
            existing.carton_ids.push(id);
          }
        });

        existing.total_cartons += (p.items_count || (p.carton_ids ? p.carton_ids.length : 0));
        existing.total_weight += (p.total_weight || 0);
        existing.total_cbm += (p.total_cbm || 0);

        if (p.status === ('arrived_bd' as any) && existing.status !== 'received') {
          existing.status = 'arrived_bd' as any;
        } else if (p.status === 'received') {
          existing.status = 'received';
        }
      }
    });

    return Array.from(map.values());
  }, [accessibleProposals]);

  // Tab counts based on grouped flight batches
  const totalAllBatchesCount = allGroupedBatches.length;
  const totalInTransitBatchesCount = allGroupedBatches.filter(
    (b) => b.status === 'in_transit' || b.status === 'dispatched'
  ).length;
  const totalReceivedBatchesCount = allGroupedBatches.filter(
    (b) => b.status === 'received' || b.status === ('arrived_bd' as any)
  ).length;

  const groupedFlightList = React.useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return allGroupedBatches.filter((b) => {
      const matchesSearch =
        !search ||
        (b.flying_name || '').toLowerCase().includes(search) ||
        (b.flight_number || '').toLowerCase().includes(search) ||
        (b.awb_number || '').toLowerCase().includes(search) ||
        (b.warehouse_name || '').toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'received'
          ? (b.status === 'received' || b.status === ('arrived_bd' as any))
          : (b.status === 'in_transit' || b.status === 'dispatched');

      return matchesSearch && matchesStatus;
    });
  }, [allGroupedBatches, searchTerm, statusFilter]);

  // Flight Carton Scan & Receive Modal state
  const [selectedFlightForCartonReceive, setSelectedFlightForCartonReceive] = useState<any | null>(null);
  const [selectedCartonIdsInModal, setSelectedCartonIdsInModal] = useState<string[]>([]);

  // Print Manifest & Physical Receiving Sheet with Blank Live Weight Column for Pen Handwriting
  const handlePrintReceivingManifest = (flight: any, flightCartons: Carton[]) => {
    try {
      const totalWeight = flightCartons.reduce((sum, c) => sum + (c.bd_calibrated_weight !== undefined ? Number(c.bd_calibrated_weight) : (Number(c.gross_weight) || 0)), 0);
      const totalCbm = flightCartons.reduce((sum, c) => sum + (Number(c.cbm) || 0), 0);

      const rowsHtml = flightCartons
        .map((c, idx) => `
          <tr>
            <td style="text-align: center; font-weight: bold; color: #000; border: 1.5px solid #000; padding: 6px;">${idx + 1}</td>
            <td style="font-family: monospace; font-weight: 900; color: #000; border: 1.5px solid #000; padding: 6px;">${c.ctn_no}</td>
            <td style="font-family: monospace; font-weight: 900; color: #000; border: 1.5px solid #000; padding: 6px;">${c.packaging_number || '-'}</td>
            <td style="font-family: monospace; font-weight: 900; color: #000; border: 1.5px solid #000; padding: 6px;">${c.shipping_mark}</td>
            <td style="font-family: monospace; font-weight: bold; color: #000; border: 1.5px solid #000; padding: 6px;">${c.tracking_number}</td>
            <td style="color: #000; border: 1.5px solid #000; padding: 6px;">
              <div style="font-weight: 900; color: #000;">${c.product_name_en}</div>
              ${c.product_name_cn ? `<div style="font-size: 10px; color: #222; font-weight: bold;">${c.product_name_cn}</div>` : ''}
            </td>
            <td style="text-align: center; font-family: monospace; color: #000; border: 1.5px solid #000; padding: 6px;">
              <div><b style="color: #000;">${c.quantity || 1} Pcs</b></div>
              <div style="font-size: 10px; color: #111; font-weight: bold;">${c.cbm || 0.15} CBM</div>
            </td>
            <td style="text-align: center; font-family: monospace; font-weight: 900; color: #000; font-size: 13px; border: 1.5px solid #000; padding: 6px;">
              ${c.bd_calibrated_weight !== undefined ? c.bd_calibrated_weight : (c.gross_weight || '0')} KG
            </td>
            <!-- NEW BLANK LIVE WEIGHT COLUMN FOR PEN HANDWRITING -->
            <td style="text-align: center; border: 1.5px solid #000; padding: 6px; background-color: #ffffff;">
              <div style="border: 2px solid #000; height: 32px; width: 85px; margin: 0 auto; background: #ffffff; border-radius: 4px;"></div>
            </td>
            <td style="text-align: center; font-size: 11px; font-weight: 900; color: #000; border: 1.5px solid #000; padding: 6px;">
              ${c.status === 'received' || c.current_warehouse_id === 'wh-bd' ? 'RECEIVED' : 'IN-TRANSIT'}
            </td>
          </tr>
        `)
        .join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Flight Receiving Manifest - ${flight.flying_name || flight.flight_number}</title>
            <style>
              @page { size: A4 portrait; margin: 8mm; }
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 10px; color: #000000; background: #fff; font-size: 11px; }
              .header-table { width: 100%; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
              .company-title { font-size: 22px; font-weight: 900; letter-spacing: 1px; color: #000000; text-transform: uppercase; }
              .subtitle { font-size: 12px; font-weight: 700; color: #000000; margin-top: 2px; }
              .info-grid { display: flex; justify-content: space-between; background: #ffffff; border: 1.5px solid #000000; padding: 10px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #000000; }
              .info-col { width: 48%; }
              .info-row { margin-bottom: 4px; color: #000000; }
              .info-label { font-weight: 900; color: #000000; }
              .manifest-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
              .manifest-table th { background: #ffffff !important; color: #000000 !important; font-weight: 900 !important; padding: 8px 5px; border: 1.5px solid #000000 !important; text-transform: uppercase; font-size: 11px !important; letter-spacing: 0.3px; text-align: center; }
              .live-weight-header { background: #ffffff !important; color: #000000 !important; font-weight: 900 !important; font-size: 11px !important; }
              .footer-signatures { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; color: #000000; }
              .sig-box { text-align: center; width: 220px; border-top: 1.5px solid #000000; padding-top: 6px; color: #000000; }
            </style>
          </head>
          <body>
            <div class="header-table">
              <table style="width: 100%;">
                <tr>
                  <td style="width: 60px; vertical-align: middle;">
                    <img src="/logo.png" style="width: 50px; height: 50px; object-fit: contain;" onerror="this.style.display='none'" />
                  </td>
                  <td style="vertical-align: middle;">
                    <div class="company-title">M/S FOUR STAR CARGO</div>
                    <div class="subtitle">AIR CARGO FLIGHT RECEIVING & PHYSICAL INSPECTION MANIFEST</div>
                  </td>
                  <td style="text-align: right; vertical-align: middle; font-size: 10px; font-weight: bold; color: #444;">
                    Print Date: ${new Date().toLocaleString('en-US', { hour12: true })}
                  </td>
                </tr>
              </table>
            </div>

            <div class="info-grid">
              <div class="info-col">
                <div class="info-row"><span class="info-label">Flight Batch Name:</span> <b>${flight.flying_name || flight.flight_number}</b></div>
                <div class="info-row"><span class="info-label">Flight / AWB No:</span> <b>${flight.flight_number || 'N/A'} (AWB: ${flight.awb_number || 'N/A'})</b></div>
                <div class="info-row"><span class="info-label">Route:</span> <b>${flight.warehouse_name || 'Guangzhou Hub'} ➔ Dhaka Central Hub</b></div>
              </div>
              <div class="info-col" style="text-align: right;">
                <div class="info-row"><span class="info-label">Total Cartons Payload:</span> <b>${flightCartons.length} Cartons</b></div>
                <div class="info-row"><span class="info-label">Total Booked Weight:</span> <b>${totalWeight.toFixed(1)} KG</b></div>
                <div class="info-row"><span class="info-label">Total Volume:</span> <b>${totalCbm.toFixed(2)} CBM</b></div>
              </div>
            </div>

            <table class="manifest-table">
              <thead>
                <tr>
                  <th style="width: 30px;">#</th>
                  <th style="width: 75px;">CTN NO</th>
                  <th style="width: 95px;">SHIPMENT CTN NO.</th>
                  <th style="width: 90px;">SHIPPING MARK</th>
                  <th style="width: 110px;">TRACKING NO</th>
                  <th>PRODUCT NAME</th>
                  <th style="width: 75px;">QTY / CBM</th>
                  <th style="width: 90px;">BOOKED WEIGHT</th>
                  <th class="live-weight-header" style="width: 105px;">✍️ LIVE WEIGHT (লাইভ ওয়েট)</th>
                  <th style="width: 80px;">STATUS</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="footer-signatures">
              <div class="sig-box">Warehouse Receiver Signature</div>
              <div class="sig-box">Physical Scale Inspector</div>
              <div class="sig-box">Operation Director Approval</div>
            </div>
          </body>
        </html>
      `;

      // Use hidden iframe method - 100% immune to popup blockers!
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';

      document.body.appendChild(iframe);
      const frameDoc = iframe.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(htmlContent);
        frameDoc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }, 250);
      }
    } catch (err) {
      console.error('Print failed', err);
      window.print();
    }
  };

  // Handler: Realtime BD Weight Calibration per Carton
  const handleUpdateCartonWeight = (cartonId: string, newWeight: number) => {
    if (isNaN(newWeight) || newWeight < 0) return;

    const updatedCartons = cartons.map((c) => {
      if (c.id === cartonId || c.ctn_no === cartonId) {
        const origWt = c.origin_weight !== undefined ? c.origin_weight : (c.gross_weight || newWeight);
        return {
          ...c,
          gross_weight: newWeight,
          bd_calibrated_weight: newWeight,
          origin_weight: origWt,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    setCartons(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    // Sync flight proposal total weight with Hostinger DB immediately
    const targetCarton = updatedCartons.find((c) => c.id === cartonId || c.ctn_no === cartonId);
    if (targetCarton && targetCarton.flight_number) {
      const flightNo = targetCarton.flight_number;
      const flightCartons = updatedCartons.filter((c) => c.flight_number === flightNo);
      const newTotalWeight = flightCartons.reduce((acc, c) => acc + (c.gross_weight || 0), 0);

      const updatedProposals = proposals.map((p) => {
        if (p.flight_number === flightNo || p.flying_name === flightNo) {
          return { ...p, total_weight: newTotalWeight };
        }
        return p;
      });
      updateProposals(updatedProposals);
      saveHostingerDbData('fsc_vps_proposals', updatedProposals);
    }
  };

  // Individual Carton Receive Handler
  const handleReceiveSingleCarton = (target: Carton | string) => {
    const cartonId = typeof target === 'string' ? target : target.id;
    const ctnNo = typeof target === 'object' ? target.ctn_no : target;
    const shippingMark = typeof target === 'object' ? target.shipping_mark : undefined;

    const norm = (s?: string) => (s ? s.trim().toLowerCase() : '');

    // Check if user entered a custom weight in local weights
    const localWtStr =
      (cartonId && localWeights[cartonId]) ||
      (ctnNo && localWeights[ctnNo]) ||
      (cartonId && localWeights[norm(cartonId)]) ||
      (ctnNo && localWeights[norm(ctnNo)]);
    const parsedLocalWt = localWtStr !== undefined ? parseFloat(localWtStr) : NaN;

    let targetMatched = false;

    const updatedCartons = cartons.map((c) => {
      const matches =
        (c.id && cartonId && norm(c.id) === norm(cartonId)) ||
        (c.ctn_no && cartonId && norm(c.ctn_no) === norm(cartonId)) ||
        (ctnNo && c.ctn_no && norm(c.ctn_no) === norm(ctnNo)) ||
        (ctnNo && c.id && norm(c.id) === norm(ctnNo));

      if (matches) {
        targetMatched = true;
        const origWt = c.origin_weight !== undefined ? c.origin_weight : (c.gross_weight || 0);
        const finalWt = !isNaN(parsedLocalWt) && parsedLocalWt >= 0 ? parsedLocalWt : (c.bd_calibrated_weight !== undefined ? c.bd_calibrated_weight : (c.gross_weight || 0));

        return {
          ...c,
          status: 'received' as const,
          gross_weight: finalWt,
          bd_calibrated_weight: finalWt,
          origin_weight: origWt,
          current_warehouse_id: 'wh-bd',
          destination_warehouse_id: 'wh-bd',
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    if (!targetMatched) {
      console.warn('Carton match failed for receive target:', target);
    }

    setCartons(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);
    const res1 = recalculateCustomerLedgerAndBilling();
    if (res1.cartons) setCartons(res1.cartons);

    // Find the carton's flight number and update the proposal's total_weight in Super Admin DB
    const targetCartonObj = updatedCartons.find(
      (c) =>
        (c.id && cartonId && norm(c.id) === norm(cartonId)) ||
        (c.ctn_no && cartonId && norm(c.ctn_no) === norm(cartonId)) ||
        (ctnNo && c.ctn_no && norm(c.ctn_no) === norm(ctnNo))
    );
    if (targetCartonObj && targetCartonObj.flight_number) {
      const flightNo = targetCartonObj.flight_number;
      const flightCartons = updatedCartons.filter((c) => norm(c.flight_number) === norm(flightNo));
      const newTotalWeight = flightCartons.reduce((acc, c) => acc + (c.gross_weight || 0), 0);

      const updatedProposals = proposals.map((p) => {
        if (norm(p.flight_number) === norm(flightNo) || norm(p.flying_name) === norm(flightNo)) {
          return { ...p, total_weight: newTotalWeight };
        }
        return p;
      });
      updateProposals(updatedProposals);
      saveHostingerDbData('fsc_vps_proposals', updatedProposals);
    }

    logSystemAuditAction(
      currentUser,
      'carton_received_bd',
      'carton',
      cartonId,
      `Carton ${ctnNo || cartonId} received at BD Warehouse stock by ${currentUser.name}`
    );

    addToast(
      isBn ? '✅ কার্টুনটি মেপে বুঝে পেয়েছি! স্টক ইনভেন্টরি ও বিলিকৃত প্রোডাক্ট সেকশনে স্থানান্তরিত করা হয়েছে।' : '✅ Carton weight saved and received into Delivered Products stock!',
      'success'
    );
  };

  // Bulk Cartons Receive Handler
  const handleReceiveBulkCartons = (cartonIdsToReceive: string[], flightNo: string, proposalIds: string[]) => {
    if (!cartonIdsToReceive || cartonIdsToReceive.length === 0) {
      addToast(isBn ? 'কমপক্ষে একটি কার্টুন নির্বাচন করুন!' : 'Select at least one carton!', 'error');
      return;
    }

    const updatedCartons = cartons.map((c) => {
      if (cartonIdsToReceive.includes(c.id) || cartonIdsToReceive.includes(c.ctn_no) || (flightNo && c.flight_number === flightNo)) {
        const localWtStr = localWeights[c.id] || localWeights[c.ctn_no];
        const parsedLocalWt = localWtStr !== undefined ? parseFloat(localWtStr) : NaN;
        const finalWt = !isNaN(parsedLocalWt) && parsedLocalWt >= 0 ? parsedLocalWt : (c.bd_calibrated_weight || c.gross_weight || 0);

        return {
          ...c,
          status: 'received' as const,
          gross_weight: finalWt,
          bd_calibrated_weight: finalWt,
          current_warehouse_id: 'wh-bd',
          destination_warehouse_id: 'wh-bd',
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    setCartons(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);
    const resBulk = recalculateCustomerLedgerAndBilling();
    if (resBulk.cartons) setCartons(resBulk.cartons);

    // Check if all flight cartons are received
    const flightCartons = updatedCartons.filter(
      (c) => cartonIdsToReceive.includes(c.id) || (flightNo && c.flight_number === flightNo)
    );
    const allReceived = flightCartons.every((c) => c.status === 'received' && c.current_warehouse_id === 'wh-bd');

    if (allReceived) {
      const updatedProposals = proposals.map((p) => {
        if (proposalIds.includes(p.id) || (flightNo && (p.flight_number === flightNo || p.flying_name === flightNo))) {
          return { ...p, status: 'received' as const };
        }
        return p;
      });
      updateProposals(updatedProposals);
      saveHostingerDbData('fsc_vps_proposals', updatedProposals);
    }

    addToast(
      isBn
        ? `✅ ${cartonIdsToReceive.length} টি কার্টুন সফলভাবে বাংলাদেশ ওয়্যারহাউজ স্টকে স্থানান্তরিত করা হয়েছে!`
        : `✅ ${cartonIdsToReceive.length} cartons received into BD Warehouse stock!`,
      'success'
    );
  };

  // Weight calibration modal state
  const [selectedProposalForWeightCalib, setSelectedProposalForWeightCalib] = useState<FlyingProposal | null>(null);
  const [calibratedWeightInput, setCalibratedWeightInput] = useState<number>(0);

  const handleOpenWeightCalibModal = (p: FlyingProposal) => {
    setSelectedProposalForWeightCalib(p);
    setCalibratedWeightInput(p.total_weight || 450);
  };

  const handleSaveBdWeightCalibration = () => {
    if (!selectedProposalForWeightCalib) return;

    const proposalId = selectedProposalForWeightCalib.id;
    const newWeight = Number(calibratedWeightInput);

    if (isNaN(newWeight) || newWeight <= 0) {
      addToast(isBn ? '⚠️ অনুগ্রহ করে সঠিক ওজন (কেজি) প্রবেশ করান' : '⚠️ Please enter a valid weight in kg', 'error');
      return;
    }

    // 1. Update proposal total weight
    const updatedProposals = proposals.map((p) => {
      if (p.id === proposalId) {
        return { ...p, total_weight: newWeight };
      }
      return p;
    });
    updateProposals(updatedProposals);

    // 2. Update attached cartons weight proportionally
    const targetCartonIds = selectedProposalForWeightCalib.carton_ids || [];
    const targetFlightNo = selectedProposalForWeightCalib.flight_number;
    const attachedCartonsCount = cartons.filter(
      (c) => targetCartonIds.includes(c.id) || (targetFlightNo && c.flight_number === targetFlightNo)
    ).length || 1;

    const perCartonWeight = Number((newWeight / attachedCartonsCount).toFixed(2));

    const updatedCartons = cartons.map((c) => {
      if (targetCartonIds.includes(c.id) || (targetFlightNo && c.flight_number === targetFlightNo)) {
        return { ...c, gross_weight: perCartonWeight };
      }
      return c;
    });
    setCartons(updatedCartons);

    // 3. Save to Hostinger DB
    saveHostingerDbData('fsc_vps_proposals', updatedProposals);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);
    const resCalib = recalculateCustomerLedgerAndBilling();
    if (resCalib.cartons) setCartons(resCalib.cartons);

    addToast(
      isBn
        ? `⚖️ বাংলাদেশে পরিমাপকৃত সঠিক ওজন ${newWeight} kg সফলভাবে আপডেট করা হয়েছে!`
        : `⚖️ BD Calibrated official weight updated to ${newWeight} kg successfully!`,
      'success'
    );

    setSelectedProposalForWeightCalib(null);
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-700">
        <div>
          <h2 className={`text-xl font-extrabold flex items-center space-x-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <div className="p-2 rounded-xl bg-blue-600/20 text-sky-300 border border-blue-500/30">
              <Truck className="w-5 h-5" />
            </div>
            <span>{isBn ? 'রিসিভ ফ্লাইং (ইনকামিং কার্গো বিমান তালিকা)' : 'Receive Flying (Inbound Flight Dispatches)'}</span>
          </h2>
          <p className={`text-xs mt-1 font-semibold ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
            {isBn
              ? 'উৎস হাব (চীন, হংকং, দুবাই) থেকে রিলিজ হওয়া সকল ফ্লাইটের তথ্য। এখান থেকে ওজন এডিট ও "বাংলাদেশ এয়ারপোর্টে প্রাপ্ত" মার্ক করলে পণ্য বাংলাদেশ ওয়্যারহাউজে যুক্ত হবে।'
              : 'Inbound flight dispatches from origin hubs (China, Hong Kong, Dubai). Calibrate BD weight & mark "Received at BD Airport" to transfer cargo to BD stock.'}
          </p>
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
            placeholder={isBn ? 'ফ্লাইং নাম, ফ্লাইট নং, AWB বা উৎস হাব দিয়ে খুঁজুন...' : 'Search by Flying Name, Flight No, AWB or Origin...'}
            className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
              isDark ? 'bg-[#0F172A] border-slate-600 text-white placeholder-slate-300' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'
            }`}
          />
        </div>

        {/* Status Filter Pills */}
        <div className={`flex items-center p-1 rounded-xl border text-xs font-bold ${
          isDark ? 'bg-[#0F172A] border-slate-700' : 'bg-slate-100 border-slate-300/80'
        }`}>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg transition-all font-extrabold text-xs whitespace-nowrap cursor-pointer select-none ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : isDark
                ? 'text-white hover:text-white bg-slate-800/80 hover:bg-slate-700'
                : 'text-slate-800 hover:text-slate-900'
            }`}
          >
            {isBn ? 'সকল ফ্লাইট' : 'All Flights'} ({totalAllBatchesCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in_transit')}
            className={`px-3.5 py-1.5 rounded-lg transition-all font-extrabold text-xs whitespace-nowrap cursor-pointer select-none ${
              statusFilter === 'in_transit'
                ? 'bg-blue-600 text-white shadow-sm'
                : isDark
                ? 'text-white hover:text-white bg-slate-800/80 hover:bg-slate-700'
                : 'text-slate-800 hover:text-slate-900'
            }`}
          >
            ✈️ {isBn ? 'মিড-এিয়ার ফ্লাইটে চলমান' : 'Cruising Mid-Air'} ({totalInTransitBatchesCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('received')}
            className={`px-3.5 py-1.5 rounded-lg transition-all font-extrabold text-xs whitespace-nowrap cursor-pointer select-none ${
              statusFilter === 'received'
                ? 'bg-emerald-600 text-white shadow-sm'
                : isDark
                ? 'text-white hover:text-white bg-slate-800/80 hover:bg-slate-700'
                : 'text-slate-800 hover:text-slate-900'
            }`}
          >
            🛬 {isBn ? 'বাংলাদেশ এয়ারপোর্টে প্রাপ্ত' : 'Received at BD'} ({totalReceivedBatchesCount})
          </button>
        </div>
      </div>

      {/* Main Flights Table */}
      <div
        className={`border rounded-2xl overflow-hidden shadow-xl ${
          isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className={`text-sm font-extrabold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Plane className="w-4 h-4 text-blue-500" />
            <span>{isBn ? 'ইনকামিং ফ্লাইং ও ডিসপ্যাচ তালিকা' : 'Inbound Flights List'}</span>
          </h3>
          <span className={`text-xs font-mono font-extrabold ${isDark ? 'text-sky-300' : 'text-blue-600'}`}>
            {groupedFlightList.length} {isBn ? 'টি ফ্লাইট ব্যাচ' : 'Batches Found'}
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
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'ফ্লাইট তারিখ (DATE)' : 'Flight Date (DATE)'}</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'ফ্লাইং নাম / ব্যাচ টাইটেল' : 'Flying Name / Batch Title'}</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'ফ্লাইট নম্বর / AWB' : 'Flight No / AWB'}</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'উৎস হাব (ORIGIN)' : 'Origin Hub (ORIGIN)'}</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'কার্টুন সংখ্যা' : 'Cartons Count'}</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'বাংলাদেশে মেপে পাওয়া ওজন' : 'BD Calibrated Weight'}</th>
                <th className={`p-3.5 border-r border-slate-200 dark:border-slate-700 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'বর্তমান অবস্থা (STATUS)' : 'Status (STATUS)'}</th>
                <th className={`p-3.5 text-right font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'অ্যাকশন (BD RECEIVING & CALIBRATION)' : 'Action (BD Receiving & Calibration)'}</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                isDark ? 'divide-slate-800 text-white' : 'divide-slate-200 text-slate-800'
              }`}
            >
              {groupedFlightList.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`p-8 text-center text-xs font-extrabold border-b border-slate-200 dark:border-slate-700 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {isBn ? 'কোনো ফ্লাইং ডাটা পাওয়া যায়নি' : 'No flying flight batches found'}
                  </td>
                </tr>
              ) : (
                groupedFlightList.map((gf) => {
                  const isReceived = gf.status === 'received';
                  const isArrivedBd = gf.status === ('arrived_bd' as any) || isReceived || isBdWarehouseStaff;

                  return (
                    <tr key={gf.groupKey} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className={`p-3.5 font-mono font-extrabold border-r border-b border-slate-200 dark:border-slate-700 ${isDark ? 'text-sky-300' : 'text-blue-900'}`}>
                        {gf.date || '2026-08-16'}
                      </td>
                      <td className="p-3.5 font-normal text-slate-900 dark:text-white border-r border-b border-slate-200 dark:border-slate-700">
                        <div className={`font-extrabold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{gf.flying_name}</div>
                        <div className={`text-[10px] font-mono mt-0.5 font-semibold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>Flight Group: {gf.flight_number}</div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300 border-r border-b border-slate-200 dark:border-slate-700">
                        <div className={`font-extrabold ${isDark ? 'text-sky-300' : 'text-blue-900'}`}>{gf.flight_number}</div>
                        <div className={`text-[10px] mt-0.5 font-semibold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>AWB: {gf.awb_number}</div>
                      </td>
                      <td className="p-3.5 font-normal border-r border-b border-slate-200 dark:border-slate-700">
                        <span className="inline-flex items-center space-x-1.5">
                          <span className={`font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{gf.warehouse_name}</span>
                          <span className={`text-[10px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>➔ 🇧🇩 DAC</span>
                        </span>
                      </td>
                      <td className={`p-3.5 font-extrabold border-r border-b border-slate-200 dark:border-slate-700 ${isDark ? 'text-sky-300' : 'text-slate-800'}`}>
                        <span className={`font-extrabold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{gf.total_cartons}</span> {isBn ? 'কার্টুন' : 'Cartons'}
                      </td>
                      <td className={`p-3.5 font-mono font-extrabold border-r border-b border-slate-200 dark:border-slate-700 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-extrabold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{gf.total_weight} kg</span>
                          <button
                            type="button"
                            onClick={() => handleOpenWeightCalibModal(gf.sampleProposal)}
                            className={`p-1 px-2 rounded-md cursor-pointer transition-colors text-[11px] font-bold border ${
                              isDark
                                ? 'bg-blue-950/70 text-sky-300 hover:bg-blue-900/80 border-blue-700'
                                : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border-blue-300 font-extrabold shadow-2xs'
                            }`}
                            title={isBn ? 'বাংলাদেশে মেপে পাওয়া ওজন টিউন/এডিট করুন' : 'Calibrate Official BD Weight'}
                          >
                            ⚖️ {isBn ? 'এডিট' : 'Edit'}
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 border-r border-b border-slate-200 dark:border-slate-700">
                        {isArrivedBd ? (
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${
                            isDark
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-300 font-extrabold shadow-2xs'
                          }`}>
                            <span>🛬 {isBn ? 'বাংলাদেশ এয়ারপোর্টে প্রাপ্ত' : 'Arrived at BD Airport'}</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${
                            isDark
                              ? 'bg-blue-950/70 text-sky-300 border-blue-800'
                              : 'bg-blue-50 text-blue-900 border-blue-300 font-extrabold shadow-2xs'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-sky-400 animate-ping"></span>
                            <span>✈️ {isBn ? 'মিড-ফ্লাইয়ার ফ্লাইটে চলমান' : 'In Flight'}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenWeightCalibModal(gf.sampleProposal)}
                            className={`px-3 py-1.5 rounded-none font-normal text-xs transition-all border cursor-pointer select-none ${
                              isDark
                                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 shadow-2xs'
                            }`}
                          >
                            ⚖️ {isBn ? 'ওজন পুনর্নির্ধারণ' : 'Calibrate Weight'}
                          </button>

                          {isReceived ? (
                            <span
                              className={`text-[11px] font-normal inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-none border ${
                                isDark
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>{isBn ? 'ওয়্যারহাউজে স্থানান্তরিত' : 'Transferred to BD Warehouse'}</span>
                            </span>
                          ) : isArrivedBd ? (
                            isBdWarehouseStaff ? (
                              <button
                                type="button"
                                onClick={() => setSelectedFlightForCartonReceive(gf)}
                                className="px-3.5 py-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md flex items-center space-x-1.5 cursor-pointer select-none hover:scale-105 active:scale-95"
                              >
                                <Package className="w-4 h-4" />
                                <span>{isBn ? '📦 কার্টুন লিস্ট ও রিসিভ করুন' : 'View Cartons & Receive'}</span>
                              </button>
                            ) : (
                              <span
                                className={`text-[11px] font-normal inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-none border ${
                                  isDark
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>{isBn ? 'বাংলাদেশ এয়ারপোর্টে রিসিভড' : 'Received at BD Airport'}</span>
                              </span>
                            )
                          ) : isBdWarehouseStaff ? (
                            <button
                              type="button"
                              onClick={() => setSelectedFlightForCartonReceive(gf)}
                              className="px-3.5 py-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md flex items-center space-x-1.5 cursor-pointer select-none"
                            >
                              <Package className="w-4 h-4" />
                              <span>{isBn ? '📦 কার্টুন লিস্ট ও রিসিভ করুন' : 'View Cartons & Receive'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMarkReceivedAtBdAirport(gf.proposal_ids, gf.flight_number, gf.carton_ids)}
                              className="px-3.5 py-2 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md flex items-center space-x-1.5 cursor-pointer select-none hover:scale-105 active:scale-95 border border-blue-700"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{isBn ? '🛬 এয়ারপোর্টে পুরো ফ্লাইট প্রাপ্ত (একবারে রিসিভ)' : 'Mark BD Airport Received (All Flight)'}</span>
                            </button>
                          )}
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

      {/* BD Weight Calibration Modal */}
      {selectedProposalForWeightCalib && (
        <div className="fixed inset-0 z-50 bg-[#1E293B] backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-md w-full rounded-xl p-6 shadow-2xl border space-y-5 animate-in fade-in zoom-in-95 duration-200 ${
              isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-sky-300 border border-blue-500/30">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? '⚖️ বাংলাদেশে মেপে পাওয়া সঠিক ওজন পুনর্নির্ধারণ' : 'Official BD Weight Calibration'}
                  </h3>
                  <p className={`text-[11px] font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>
                    {selectedProposalForWeightCalib.flight_number} • {selectedProposalForWeightCalib.flying_name || selectedProposalForWeightCalib.warehouse_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProposalForWeightCalib(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-normal">
              <div className={`p-3 rounded-xl border text-xs font-semibold leading-relaxed ${
                isDark
                  ? 'bg-blue-950/70 border-blue-700/80 text-sky-200'
                  : 'bg-blue-50 border-blue-300 text-blue-950 font-extrabold'
              }`}>
                💡 {isBn
                  ? 'নোট: বাংলাদেশে আসার পর প্রোডাক্টের যে ওজন পরিমাপ করা হবে, সেটিই চূড়ান্ত সত্য ওজন হিসেবে গণ্য হবে এবং গ্রাহকের বিলে হিসাব হবে।'
                  : 'Note: Official gross weight measured upon arrival in Bangladesh is the final billable weight.'}
              </div>

              <div>
                <label className={`block font-extrabold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isBn ? 'বাংলাদেশে মেপে পাওয়া সঠিক মোট গ্রস ওজন (KG):' : 'Official BD Calibrated Gross Weight (KG):'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={calibratedWeightInput}
                  onChange={(e) => setCalibratedWeightInput(Number(e.target.value))}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-mono font-extrabold border focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProposalForWeightCalib(null)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                  isDark ? 'border-slate-700 text-white hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveBdWeightCalibration}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all cursor-pointer"
              >
                {isBn ? 'সেভ করুন ও ওজন আপডেট করুন' : 'Save BD Weight'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flight Carton Scan & Receive Modal */}
      {selectedFlightForCartonReceive && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/90 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div
            className={`max-w-5xl w-full rounded-2xl p-6 shadow-2xl border space-y-4 max-h-[90vh] flex flex-col ${
              isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3.5 border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-sky-300 border border-blue-500/30">
                  <Package className="w-5 h-5 font-bold" />
                </div>
                <div>
                  <h3 className={`text-base font-extrabold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <span>ফ্লাইট {selectedFlightForCartonReceive.flying_name || selectedFlightForCartonReceive.flight_number} কার্টুন তালিকা ও স্টক রিসিভিং</span>
                  </h3>
                  <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>
                    AWB: {selectedFlightForCartonReceive.awb_number || 'N/A'} • উৎস: {selectedFlightForCartonReceive.warehouse_name} ➔ ঢাকা সেন্ট্রাল Hub
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handlePrintReceivingManifest(selectedFlightForCartonReceive, cartons.filter((c) =>
                    (selectedFlightForCartonReceive.carton_ids && selectedFlightForCartonReceive.carton_ids.includes(c.id)) ||
                    (selectedFlightForCartonReceive.flight_number && c.flight_number === selectedFlightForCartonReceive.flight_number) ||
                    (selectedFlightForCartonReceive.flying_name && c.flight_number === selectedFlightForCartonReceive.flying_name)
                  ))}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center space-x-1.5 border border-slate-700"
                  title="লোগো, তথ্য ও লাইভ ওয়েটের খালি কলাম সহ প্রিন্ট করুন"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>{isBn ? 'প্রিন্ট করুন (Print Manifest)' : 'Print Manifest'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFlightForCartonReceive(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Bulk Action Bar */}
            {(() => {
              const flightCartons = cartons.filter((c) =>
                (selectedFlightForCartonReceive.carton_ids && selectedFlightForCartonReceive.carton_ids.includes(c.id)) ||
                (selectedFlightForCartonReceive.flight_number && c.flight_number === selectedFlightForCartonReceive.flight_number) ||
                (selectedFlightForCartonReceive.flying_name && c.flight_number === selectedFlightForCartonReceive.flying_name)
              );
              const pendingCartons = flightCartons.filter((c) => c.status !== 'received' || c.current_warehouse_id !== 'wh-bd');
              const receivedCartonsCount = flightCartons.filter((c) => c.status === 'received' && c.current_warehouse_id === 'wh-bd').length;

              const toggleSelectAllInModal = () => {
                if (selectedCartonIdsInModal.length === pendingCartons.length) {
                  setSelectedCartonIdsInModal([]);
                } else {
                  setSelectedCartonIdsInModal(pendingCartons.map((c) => c.id));
                }
              };

              return (
                <>
                  <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border ${
                    isDark ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>
                        রিসিভিং প্রোগ্রেস: <span className="text-emerald-400 font-extrabold">{receivedCartonsCount} / {flightCartons.length}</span> কার্টুন রিসিভড
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={toggleSelectAllInModal}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all border ${
                          isDark ? 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700' : 'bg-slate-200 text-slate-800 border-slate-300'
                        }`}
                      >
                        {selectedCartonIdsInModal.length === pendingCartons.length ? 'আন-সিলেক্ট' : 'সব সিলেক্ট'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleReceiveBulkCartons(
                            selectedCartonIdsInModal.length > 0 ? selectedCartonIdsInModal : pendingCartons.map((c) => c.id),
                            selectedFlightForCartonReceive.flight_number,
                            selectedFlightForCartonReceive.proposal_ids
                          )
                        }
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all flex items-center space-x-1.5 cursor-pointer border border-emerald-500 shadow-md"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>একত্রে সব রিসিভ করুন ({selectedCartonIdsInModal.length || pendingCartons.length} Cartons)</span>
                      </button>
                    </div>
                  </div>

                  {/* Cartons List Table */}
                  <div className="overflow-y-auto max-h-[52vh] border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-left text-xs font-normal">
                      <thead className={`uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200 dark:border-slate-700 font-extrabold ${
                        isDark ? 'bg-[#1E293B] text-white' : 'bg-slate-100 text-slate-900'
                      }`}>
                        <tr>
                          <th className="p-2.5 font-extrabold">#</th>
                          <th className="p-2.5 font-extrabold">CTN NO</th>
                          <th className="p-2.5 font-extrabold text-emerald-700 dark:text-emerald-300">SHIPMENT CTN NO.</th>
                          <th className="p-2.5 font-extrabold text-blue-700 dark:text-sky-300">SHIPPING MARK</th>
                          <th className="p-2.5 font-extrabold">TRACKING NO</th>
                          <th className="p-2.5 font-extrabold">PRODUCT NAME</th>
                          <th className="p-2.5 font-extrabold">QTY / CBM</th>
                          <th className="p-2.5 font-extrabold">BD CALIBRATED WEIGHT (KG)</th>
                          <th className="p-2.5 font-extrabold">STATUS</th>
                          <th className="p-2.5 text-right font-extrabold">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {flightCartons.map((c) => {
                          const isCartonReceived = c.status === 'received' || c.current_warehouse_id === 'wh-bd' || c.status === 'delivered';
                          const isChecked = selectedCartonIdsInModal.includes(c.id);

                          return (
                            <tr
                              key={c.id}
                              className="bg-white dark:bg-[#1E293B] hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                            >
                              <td className="p-2.5">
                                {!isCartonReceived && (
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      setSelectedCartonIdsInModal((prev) =>
                                        prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                      )
                                    }
                                    className="w-3.5 h-3.5 accent-[#00897B] rounded-md cursor-pointer"
                                  />
                                )}
                              </td>
                              <td className={`p-2.5 font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.ctn_no}</td>
                              <td className="p-2.5 font-mono font-extrabold text-emerald-700 dark:text-emerald-300">{c.packaging_number || '-'}</td>
                              <td className="p-2.5 font-extrabold text-blue-700 dark:text-sky-300">{c.shipping_mark}</td>
                              <td className={`p-2.5 font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{c.tracking_number}</td>
                              <td className="p-2.5 font-normal">
                                <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.product_name_en}</div>
                                {c.product_name_cn && (
                                  <div className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{c.product_name_cn}</div>
                                )}
                              </td>
                              <td className="p-2.5 font-mono text-purple-700 dark:text-purple-300 font-extrabold">
                                <div>{c.quantity || 1} Pcs</div>
                                <div className="text-[10px] text-fuchsia-600 dark:text-fuchsia-300">{c.cbm || 0.15} CBM</div>
                              </td>
                              <td className="p-2.5">
                                <div className="flex items-center space-x-1">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={
                                      localWeights[c.id] !== undefined
                                        ? localWeights[c.id]
                                        : (c.bd_calibrated_weight !== undefined
                                          ? String(c.bd_calibrated_weight)
                                          : String(c.gross_weight || ''))
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setLocalWeights((prev) => ({ ...prev, [c.id]: val }));
                                    }}
                                    onBlur={(e) => {
                                      const parsed = parseFloat(e.target.value);
                                      if (!isNaN(parsed) && parsed >= 0) {
                                        handleUpdateCartonWeight(c.id, parsed);
                                      }
                                    }}
                                    className="w-20 px-2 py-1 text-xs font-mono font-extrabold text-center rounded-lg border-2 border-slate-300 bg-white text-slate-900 dark:bg-[#0F172A] dark:text-white dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                                    title="বাংলাদেশে মেপে পাওয়া ওজন টিউন/এডিট করুন"
                                  />
                                  <span className={`text-[10px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>KG</span>
                                </div>
                              </td>
                              <td className="p-2.5">
                                {isCartonReceived ? (
                                  <span className="px-2.5 py-1 rounded-md bg-emerald-800 text-white text-[10px] font-black border border-emerald-900 shadow-2xs">
                                    BD রিসিভড
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-[10px] font-black border border-slate-900 shadow-2xs">
                                    ইন-ট্রানজিট
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right">
                                {isCartonReceived ? (
                                  <span className="text-[10px] text-white font-black px-2.5 py-1 rounded-md bg-emerald-800 border border-emerald-900 shadow-2xs">
                                    ইনভেন্টরিতে যুক্ত
                                  </span>
                                ) : isBdWarehouseStaff ? (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleReceiveSingleCarton(c)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all inline-flex items-center space-x-1 cursor-pointer border border-emerald-700 shadow-md"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>বুঝে পেয়েছি (রিসিভড)</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-white font-black px-2.5 py-1 rounded-md bg-blue-700 border border-blue-800 shadow-2xs">
                                    অপারেশনস ফ্লাইট রিসিভিং
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
