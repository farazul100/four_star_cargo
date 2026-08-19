import { User, Carton, FlyingProposal, LedgerEntry } from '../types';
import { getHostingerDbData } from '../lib/db';

export interface ChatMessageItem {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

/**
 * Sanitizes and extracts clean API key string for ALL user roles & guest sessions
 */
export const getCleanGeminiApiKey = (): string => {
  const db = getHostingerDbData() as any;
  const settings = db.settings || {};
  
  let raw = 
    settings.gemini_api_key || 
    localStorage.getItem('fsc_gemini_api_key') || 
    localStorage.getItem('gemini_api_key') || 
    '';
  
  if (!raw) {
    try {
      const vpsSettings = localStorage.getItem('fsc_vps_settings') || localStorage.getItem('settings');
      if (vpsSettings) {
        const parsed = JSON.parse(vpsSettings);
        raw = parsed.gemini_api_key || '';
      }
    } catch {}
  }

  if (!raw && typeof window !== 'undefined' && (window as any).__FSC_GEMINI_KEY__) {
    raw = (window as any).__FSC_GEMINI_KEY__;
  }

  const clean = (raw || '').replace(/^["']|["']$/g, '').trim();

  if (clean && typeof window !== 'undefined') {
    (window as any).__FSC_GEMINI_KEY__ = clean;
    try {
      localStorage.setItem('fsc_gemini_api_key', clean);
    } catch {}
  }

  return clean;
};

/**
 * Async API Key resolver with instant Hostinger server fallback for non-admin users & guests
 */
export const getCleanGeminiApiKeyAsync = async (): Promise<string> => {
  let key = getCleanGeminiApiKey();
  if (key) return key;

  try {
    const endpoints = [
      '/api/db.php',
      '/api/db',
      'https://four.kee2mart.com/api/db.php',
      'https://four.kee2mart.com/api/db',
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const dbData = await res.json();
          const apiK = 
            dbData?.settings?.gemini_api_key || 
            dbData?.fsc_vps_settings?.gemini_api_key || 
            dbData?.gemini_api_key || 
            '';
          if (apiK) {
            const clean = apiK.replace(/^["']|["']$/g, '').trim();
            if (clean) {
              localStorage.setItem('fsc_gemini_api_key', clean);
              localStorage.setItem('fsc_vps_settings', JSON.stringify({ gemini_api_key: clean }));
              if (typeof window !== 'undefined') (window as any).__FSC_GEMINI_KEY__ = clean;
              return clean;
            }
          }
        }
      } catch {}
    }
  } catch {}

  return '';
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
 * Searches exact database records based on user query
 */
export const buildCargoSystemContext = (currentUser?: User | null, userPrompt: string = ''): string => {
  const db = getHostingerDbData() as any;
  const cartons: Carton[] = db.cartons || [];
  const proposals: FlyingProposal[] = db.proposals || [];
  const ledger: LedgerEntry[] = db.ledgerEntries || db.ledger || [];
  const warehouses = db.warehouses || [];

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const queryLower = (userPrompt || '').toLowerCase().trim();

  let context = `--- SYSTEM & USER CONTEXT ---
System: Four Star Cargo (M/S Four Star Cargo Express Tracking & Air Freight Management System)
Today Date: ${todayStr}
`;

  if (currentUser) {
    context += `Active User: ${currentUser.name} (Role: ${currentUser.role})
Assigned Warehouse Hub: ${currentUser.warehouse_name || currentUser.warehouse_id || 'All Hubs'}
Phone: ${currentUser.phone || 'N/A'}
`;
  } else {
    context += `User Mode: Public Customer / Guest
`;
  }

  // Summary statistics
  const bookedCartons = cartons.filter((c) => c.status === 'booked' || c.status === 'proposed');
  const transitCartons = cartons.filter((c) => c.status === 'in_transit');
  const receivedCartons = cartons.filter((c) => c.status === 'received');
  const deliveredCartons = cartons.filter((c) => c.status === 'delivered');

  context += `\n--- LIVE CARTON STATS ---
Total Cartons in System: ${cartons.length}
1. Booked at Guangzhou Hub (China): ${bookedCartons.length} CTNs
2. In-Transit (Flying Air Freight): ${transitCartons.length} CTNs
3. Received at Dhaka Hub (Uttara): ${receivedCartons.length} CTNs
4. Delivered to Customers: ${deliveredCartons.length} CTNs
`;

  // Search matching cartons based on user prompt
  if (queryLower) {
    const matchedCartons = cartons.filter((c) => {
      if (!c) return false;
      const ctn = (c.ctn_no || '').toLowerCase();
      const mark = (c.shipping_mark || '').toLowerCase();
      const trk = (c.tracking_number || '').toLowerCase();
      const cust = ((c as any).customer_name || c.recipient_name || '').toLowerCase();
      const prod = (c.product_name_en || (c as any).product_name || '').toLowerCase();
      return (
        ctn.includes(queryLower) ||
        mark.includes(queryLower) ||
        trk.includes(queryLower) ||
        cust.includes(queryLower) ||
        prod.includes(queryLower) ||
        queryLower.includes(ctn) ||
        queryLower.includes(mark)
      );
    });

    if (matchedCartons.length > 0) {
      context += `\n--- SEARCH MATCHED CARTONS DETAILS (${matchedCartons.length} Found) ---\n`;
      matchedCartons.slice(0, 15).forEach((c, idx) => {
        const wt = c.gross_weight || c.bd_calibrated_weight || c.net_weight || c.origin_weight || 0;
        const custName = (c as any).customer_name || c.recipient_name || 'N/A';
        const prodName = c.product_name_en || (c as any).product_name || 'General Cargo';
        context += `${idx + 1}. CTN No: ${c.ctn_no || 'N/A'} | Shipping Mark: ${c.shipping_mark || 'N/A'} | Master Tracking ID: ${c.tracking_number || 'N/A'} | Status: ${c.status} | Weight: ${wt}kg | CBM: ${c.cbm || 0} | Customer: ${custName} | Warehouse: ${c.current_warehouse_name || c.current_warehouse_id || 'China Hub'} | Product: ${prodName}\n`;
      });
    }
  }

  // Include recent live cartons list
  if (cartons.length > 0) {
    context += `\n--- RECENT LIVE CARTONS SAMPLE ---\n`;
    cartons.slice(-10).forEach((c, idx) => {
      const wt = c.gross_weight || c.bd_calibrated_weight || c.net_weight || 0;
      const custName = (c as any).customer_name || c.recipient_name || 'N/A';
      context += `${idx + 1}. CTN No: ${c.ctn_no} | Shipping Mark: ${c.shipping_mark || 'N/A'} | Status: ${c.status} | Weight: ${wt}kg | Customer: ${custName}\n`;
    });
  }

  // Flight proposals summary
  const activeFlights = proposals.filter((p) => p.status === 'in_transit' || p.status === 'approved' || p.status === 'pending');
  context += `\n--- FLIGHT PROPOSALS & AIR FREIGHT (Total: ${proposals.length}, Active: ${activeFlights.length}) ---\n`;
  proposals.slice(-8).forEach((f, idx) => {
    context += `${idx + 1}. Flight: #${f.flight_number || f.flying_name} (${f.flying_name}) | Status: ${f.status} | Date: ${f.date} | CTNs Count: ${f.items_count || f.carton_ids?.length || 0} | Weight: ${f.total_weight || 0}kg | AWB: ${f.awb_number || 'N/A'} | Airline: ${f.airline || 'Standard Flight'}\n`;
  });

  // Ledger summary
  if (!currentUser || currentUser.role === 'super_admin' || currentUser.role === 'accountant') {
    const totalPayments = ledger.filter((l) => l.type === 'payment').reduce((acc, l) => acc + (l.amount || 0), 0);
    const totalCharges = ledger.filter((l) => l.type === 'charge').reduce((acc, l) => acc + (l.amount || 0), 0);

    context += `\n--- FINANCIAL LEDGER SUMMARY ---
Total Billed Charges: ৳${totalCharges.toLocaleString()}
Total Payments Collected: ৳${totalPayments.toLocaleString()}
Current Uncollected Due Balance: ৳${(totalCharges - totalPayments).toLocaleString()}
`;
  }

  // Warehouse hubs list
  if (warehouses.length > 0) {
    context += `\n--- WAREHOUSE HUBS ---
${warehouses.map((w: any) => `- ${w.name} (${w.code}): ${w.address || 'Standard Hub'}`).join('\n')}
`;
  } else {
    context += `\n--- WAREHOUSE HUBS ---
1. Guangzhou Air Cargo Hub (China Hub): Baiyun District, Guangzhou, Guangdong, China.
2. Dhaka Main Distribution Hub (Bangladesh): Sector 3, Uttara, Dhaka-1230.
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
  const apiKey = await getCleanGeminiApiKeyAsync();

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

  const systemContext = buildCargoSystemContext(currentUser, userPrompt);

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
    text: `⚠️ AI সাড়া দিতে পারেনি (${firstErrorMsg || 'Gemini API call failed'})। অনুগ্রহ করে সুপার এডমিন সেটিংসে (System Settings) আপনার API Key চেক করে টেস্ট করুন।`,
    success: false,
  };
};
