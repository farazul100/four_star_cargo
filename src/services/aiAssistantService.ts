import { User, Carton, FlyingProposal, LedgerEntry } from '../types';
import { getHostingerDbData } from '../lib/db';

const GOOGLE_MODEL_CANDIDATES = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
];

export interface ChatMessageItem {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

/**
 * Builds live system context for the active user & cargo operations
 */
export const buildCargoSystemContext = (currentUser?: User | null): string => {
  const db = getHostingerDbData() as any;
  const cartons: Carton[] = db.cartons || [];
  const proposals: FlyingProposal[] = db.proposals || [];
  const ledger: LedgerEntry[] = db.ledgerEntries || db.ledger || [];
  const warehouses = db.warehouses || [];

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  let context = `--- SYSTEM & USER CONTEXT ---
System: Four Star Cargo (M/S Four Star Cargo Express Tracking & Air Freight Management System)
Today Date: ${todayStr}
`;

  if (currentUser) {
    context += `Active User: ${currentUser.name} (${currentUser.role})
Assigned Warehouse: ${currentUser.warehouse_name || currentUser.warehouse_id || 'All Hubs'}
Phone: ${currentUser.phone || 'N/A'}
`;
  } else {
    context += `User Mode: Public Customer / Guest
`;
  }

  // Cartons summary
  const bookedCount = cartons.filter((c) => c.status === 'booked' || c.status === 'proposed').length;
  const transitCount = cartons.filter((c) => c.status === 'in_transit').length;
  const receivedCount = cartons.filter((c) => c.status === 'received').length;
  const deliveredCount = cartons.filter((c) => c.status === 'delivered').length;

  context += `\n--- CARTON OVERVIEW SUMMARY ---
Total Cartons in Database: ${cartons.length}
1. Guangzhou Hub (Booked): ${bookedCount} CTNs
2. In-Transit (Flying): ${transitCount} CTNs
3. Dhaka Hub (Received): ${receivedCount} CTNs
4. Delivered to Customer: ${deliveredCount} CTNs
`;

  // Flight proposals summary
  const activeFlights = proposals.filter((p) => p.status === 'in_transit' || p.status === 'approved');
  context += `\n--- FLIGHT PROPOSALS & AIR FREIGHT ---
Total Flights Recorded: ${proposals.length}
Active Flights Flying/Approved: ${activeFlights.length}
`;
  if (activeFlights.length > 0) {
    activeFlights.slice(0, 5).forEach((f) => {
      context += `- Flight #${f.flight_number || f.flying_name} (${f.flying_name}): Status=${f.status}, Cartons=${f.items_count || f.carton_ids?.length || 0}, Weight=${f.total_weight || 0}kg\n`;
    });
  }

  // Ledger / financial summary for Accountants & Super Admin
  if (!currentUser || currentUser.role === 'super_admin' || currentUser.role === 'accountant') {
    const totalPayments = ledger.filter((l) => l.type === 'payment').reduce((acc, l) => acc + (l.amount || 0), 0);
    const totalCharges = ledger.filter((l) => l.type === 'charge').reduce((acc, l) => acc + (l.amount || 0), 0);

    context += `\n--- FINANCIAL & LEDGER OVERVIEW ---
Total Charges Billed: ৳${totalCharges.toLocaleString()}
Total Payments Collected: ৳${totalPayments.toLocaleString()}
`;
  }

  // Warehouses list
  if (warehouses.length > 0) {
    context += `\n--- WAREHOUSE HUBS ---
${warehouses.map((w: any) => `- ${w.name} (${w.code}): ${w.address || 'Standard Hub'}`).join('\n')}
`;
  } else {
    context += `\n--- WAREHOUSE HUBS ---
1. Guangzhou Air Cargo Hub (China Hub)
2. Dhaka Main Distribution Hub (Bangladesh)
`;
  }

  context += `\n--- FREQUENTLY ASKED CARGO PROCEDURES ---
- Booking Procedure: Guangzhou warehouse receives cartons, attaches CTN No & Shipping Mark, generates Packaging Slip.
- Air Freight Tracking: Enter Master Tracking ID (e.g. EXP-994801), CTN No, or Shipping Mark on tracking portal.
- Hub Addresses: Guangzhou Hub (China), Dhaka Hub (Uttara/Banani, Dhaka).
`;

  return context;
};

/**
 * Main Gemini AI Call Service using Google AI Studio REST API
 */
export const askFourStarCargoAI = async (
  userPrompt: string,
  history: ChatMessageItem[] = [],
  currentUser?: User | null
): Promise<{ text: string; success: boolean; modelUsed?: string }> => {
  const db = getHostingerDbData() as any;
  const settings = db.settings || {};
  
  // Try reading Gemini API key from settings or localStorage
  const apiKey = (settings.gemini_api_key || localStorage.getItem('fsc_gemini_api_key') || '').trim();

  if (!apiKey) {
    return {
      text: '⚠️ Google Gemini AI API Key সেট করা নেই! অনুগ্রহ করে সুপার এডমিন সেটিংসে (System Settings) গিয়ে আপনার Gemini API Key দিয়ে সেভ করুন।',
      success: false,
    };
  }

  const systemContext = buildCargoSystemContext(currentUser);

  const fullPromptText = `You are "Four Star Cargo AI" — the official intelligent operations & tracking assistant for M/S Four Star Cargo.

${systemContext}

RULES & GUIDELINES FOR AI RESPONSES:
1. Always answer in the SAME LANGUAGE as the user's message (Bengali or English). Write natural, helpful, professional Bengali when asked in Bengali.
2. Be concise, accurate, and easy to read. Use bullet points and numbers when explaining data.
3. Use relevant emojis for clarity (📦 ✈️ 🏬 💰 ✅ ⚠️ 💬 📄).
4. For amounts in BDT currency, format with ৳ symbol (e.g. ৳50,000).
5. Use live context data provided above to answer questions about carton locations, flying status, warehouses, or collections.
6. If asked about how to track or book, explain the exact Four Star Cargo procedure briefly.
7. Be polite, friendly, and helpful as an AI copilot.

---
USER QUESTION:
${userPrompt}`;

  // Filter out any previous error messages (starting with ⚠️) from history
  const cleanHistory = history
    .filter((h) => h && h.content && !h.content.startsWith('⚠️'))
    .slice(-6);

  const contentsPayload = [
    {
      role: 'user',
      parts: [{ text: fullPromptText }],
    },
    ...cleanHistory.map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }],
    })),
  ];

  let firstErrorMsg = '';

  // Try model candidates in order
  for (const model of GOOGLE_MODEL_CANDIDATES) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: contentsPayload,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1500,
            },
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const aiText = data.candidates[0].content.parts[0].text.trim();
        return {
          text: aiText,
          success: true,
          modelUsed: model,
        };
      }

      if (data.error && data.error.message) {
        const msg = data.error.message;
        if (!firstErrorMsg) {
          firstErrorMsg = `${model}: ${msg}`;
        }
        if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || (response.status === 400 && msg.toLowerCase().includes('key'))) {
          return {
            text: '⚠️ দেওয়া Gemini API Key-টি অকার্যকর বা ভুল (API Key Invalid)। অনুগ্রহ করে Google AI Studio (aistudio.google.com) থেকে নতুন একটি সঠিক API Key নিয়ে সুপার এডমিন সেটিংসে রি-সেভ করুন।',
            success: false,
          };
        }
      }
    } catch (err: any) {
      if (!firstErrorMsg) {
        firstErrorMsg = err.message || 'Network error';
      }
    }
  }

  return {
    text: `⚠️ AI সাড়া দিতে পারেনি (${firstErrorMsg || 'Gemini API call failed'})। আপনার দেওয়া API Key টি Google AI Studio (aistudio.google.com) থেকে নতুন করে রি-জেনারেট করে সেটিংস-এ সেভ করুন।`,
    success: false,
  };
};
