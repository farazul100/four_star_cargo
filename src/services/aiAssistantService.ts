import { User, Carton, FlyingProposal, LedgerEntry } from '../types';
import { getHostingerDbData } from '../lib/db';

export interface ChatMessageItem {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

/**
 * Sanitizes and extracts clean API key string preserving dots, dashes, underscores
 */
export const getCleanGeminiApiKey = (): string => {
  const db = getHostingerDbData() as any;
  const settings = db.settings || {};
  let raw = settings.gemini_api_key || localStorage.getItem('fsc_gemini_api_key') || localStorage.getItem('gemini_api_key') || '';
  
  if (!raw) {
    try {
      const vpsSettings = localStorage.getItem('fsc_vps_settings') || localStorage.getItem('settings');
      if (vpsSettings) {
        const parsed = JSON.parse(vpsSettings);
        raw = parsed.gemini_api_key || '';
      }
    } catch {}
  }

  // Remove surrounding quotes, whitespace
  return (raw || '').replace(/^["']|["']$/g, '').trim();
};

/**
 * Dynamically queries Google AI Studio ModelService.ListModels to get available models for this specific key
 */
export const getAvailableGeminiModels = async (apiKey: string): Promise<{ models: string[]; error?: string }> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();

    if (response.ok && Array.isArray(data.models)) {
      const validModels = data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => (m.name || '').replace('models/', ''));

      if (validModels.length > 0) {
        return { models: validModels };
      }
    }

    if (data.error && data.error.message) {
      return { models: [], error: data.error.message };
    }
  } catch (err: any) {
    return { models: [], error: err.message || 'Network error listing models' };
  }

  return { models: ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'] };
};

/**
 * Real-time API Key Validator to test connectivity with Google AI Studio
 */
export const testGeminiApiKey = async (rawKey: string): Promise<{ success: boolean; message: string; modelUsed?: string }> => {
  const cleanKey = (rawKey || '').replace(/^["']|["']$/g, '').trim();
  
  if (!cleanKey) {
    return { success: false, message: 'API Key ফাকা! অনুগ্রহ করে সঠিক API Key প্রদান করুন।' };
  }

  if (cleanKey.length < 15) {
    return { success: false, message: '⚠️ দেওয়া API Key-টি খুবই ছোট, দয়া করে সম্পূর্ণ API Key কপি করুন।' };
  }

  // First query ModelService.ListModels
  const modelListRes = await getAvailableGeminiModels(cleanKey);
  if (modelListRes.error) {
    if (modelListRes.error.includes('API key not valid') || modelListRes.error.includes('API_KEY_INVALID')) {
      return { success: false, message: `⚠️ দেওয়া API Key-টি অকার্যকর বা ভুল (API Key Invalid: ${modelListRes.error})` };
    }
  }

  const modelCandidates = modelListRes.models.length > 0 
    ? modelListRes.models 
    : ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

  let lastErr = '';

  for (const model of modelCandidates) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return { success: true, message: `✅ Gemini API Key সফলভাবে কানেক্ট হয়েছে! (Active Model: ${model})`, modelUsed: model };
      }

      if (data.error && data.error.message) {
        lastErr = data.error.message;
      }
    } catch (err: any) {
      lastErr = err.message || 'Network error connecting to Google AI Studio';
    }
  }

  return { success: false, message: `⚠️ এপিআই কানেকশন সফল হয়নি: ${lastErr || 'Unknown error'}` };
};

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
  const apiKey = getCleanGeminiApiKey();

  if (!apiKey) {
    return {
      text: '⚠️ Google Gemini AI API Key সেট করা নেই! অনুগ্রহ করে সুপার এডমিন সেটিংসে (System Settings) গিয়ে আপনার Gemini API Key দিয়ে সেভ করুন।',
      success: false,
    };
  }

  // Dynamically discover valid models for this API key
  const modelListRes = await getAvailableGeminiModels(apiKey);
  const modelCandidates = modelListRes.models.length > 0 
    ? modelListRes.models 
    : ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

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

  // Try model candidates dynamically retrieved from Google AI Studio
  for (const model of modelCandidates) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
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
      }
    } catch (err: any) {
      if (!firstErrorMsg) {
        firstErrorMsg = err.message || 'Network error';
      }
    }
  }

  return {
    text: `⚠️ AI সাড়া দিতে পারেনি (${firstErrorMsg || 'Gemini API call failed'})। অনুগ্রহ করে আপনার API Key সঠিক আছে কিনা সুপার এডমিন সেটিংসে গিয়ে টেস্ট টেস্ট করুন।`,
    success: false,
  };
};
