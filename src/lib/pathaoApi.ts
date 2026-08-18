// Pathao Courier Official Merchant API Helper

export interface PathaoApiCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: string;
  envMode: 'sandbox' | 'production';
  autoSendCod?: boolean;
  enabled: boolean;
  isConnected?: boolean;
  lastConnectedAt?: string;
  accessToken?: string;
}

const DEFAULT_PATHAO_CREDENTIALS: PathaoApiCredentials = {
  clientId: '',
  clientSecret: '',
  username: '',
  password: '',
  storeId: '',
  envMode: 'production',
  autoSendCod: true,
  enabled: false,
  isConnected: false,
};

export const getPathaoApiSettings = (): PathaoApiCredentials => {
  const saved = localStorage.getItem('fsc_vps_pathao_api_settings');
  if (saved) {
    try {
      return { ...DEFAULT_PATHAO_CREDENTIALS, ...JSON.parse(saved) };
    } catch {}
  }
  return DEFAULT_PATHAO_CREDENTIALS;
};

export const savePathaoApiSettings = (settings: PathaoApiCredentials) => {
  localStorage.setItem('fsc_vps_pathao_api_settings', JSON.stringify(settings));
};

export const getPathaoBaseUrl = (envMode: 'sandbox' | 'production') => {
  return envMode === 'production'
    ? 'https://api-hermes.pathao.com/aladdin/api/v1'
    : 'https://stage-api.pathao.com/aladdin/api/v1';
};

/**
 * Tests Pathao API Credentials by requesting OAuth Access Token
 */
export const testPathaoConnection = async (credentials: PathaoApiCredentials): Promise<{
  success: boolean;
  message: string;
  accessToken?: string;
}> => {
  if (!credentials.clientId || !credentials.clientSecret || !credentials.username || !credentials.password) {
    return {
      success: false,
      message: 'Client ID, Secret, Username এবং Password আবশ্যক!',
    };
  }

  const baseUrl = getPathaoBaseUrl(credentials.envMode);

  try {
    const response = await fetch(`${baseUrl}/issue-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        username: credentials.username,
        password: credentials.password,
        grant_type: 'password',
      }),
    });

    const data = await response.json();

    if (response.ok && data.access_token) {
      return {
        success: true,
        message: 'পাঠাও কুরিয়ার API সফলভাবে যুক্ত ও কানেক্টেড হয়েছে!',
        accessToken: data.access_token,
      };
    } else {
      return {
        success: false,
        message: data.message || data.error_description || 'ভুল ক্রেডেনশিয়াল! পাঠাও কুরিয়ার কানেক্ট করা সম্ভব হয়নি।',
      };
    }
  } catch (err: any) {
    // If CORS or network error blocks direct browser request, check if valid inputs were entered or report connection error
    return {
      success: false,
      message: `কানেকশন এরর: ${err?.message || 'পাঠাও সার্ভারের সাথে সংযোগ তৈরি সম্ভব হয়নি। সঠিক API ক্রেডেনশিয়াল দিন।'}`,
    };
  }
};

/**
 * Creates an order / parcel booking in Pathao Courier API
 */
export const createPathaoParcel = async (
  credentials: PathaoApiCredentials,
  parcelData: {
    merchant_order_id: string;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    item_quantity: number;
    item_weight: number;
    amount_to_collect: number;
  }
): Promise<{
  success: boolean;
  message: string;
  consignmentId?: string;
  trackingCode?: string;
}> => {
  if (!credentials.isConnected || !credentials.clientId || !credentials.clientSecret) {
    return {
      success: false,
      message: 'পাঠাও কুরিয়ার কানেক্টেড নেই! সুপার এডমিন সেটিংস থেকে পাঠাও কানেক্ট করুন।',
    };
  }

  // First ensure fresh access token
  const auth = await testPathaoConnection(credentials);
  if (!auth.success || !auth.accessToken) {
    return {
      success: false,
      message: `পাঠাও অথেন্টিকেশন ব্যর্থ: ${auth.message}`,
    };
  }

  const baseUrl = getPathaoBaseUrl(credentials.envMode);

  try {
    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        store_id: credentials.storeId || undefined,
        merchant_order_id: parcelData.merchant_order_id,
        recipient_name: parcelData.recipient_name,
        recipient_phone: parcelData.recipient_phone,
        recipient_address: parcelData.recipient_address,
        recipient_city: 1, // Default Dhaka
        recipient_zone: 1,
        delivery_type: 48,
        item_type: 2, // Parcel
        special_instruction: 'Cargo carton delivery',
        item_quantity: parcelData.item_quantity || 1,
        item_weight: parcelData.item_weight || 0.5,
        amount_to_collect: parcelData.amount_to_collect || 0,
      }),
    });

    const data = await response.json();

    if (response.ok && (data.consignment_id || data.data?.consignment_id)) {
      const consignmentId = data.consignment_id || data.data?.consignment_id;
      const trackingCode = data.tracking_code || data.data?.tracking_code || consignmentId;

      return {
        success: true,
        message: 'পাঠাও কুরিয়ারে সফলভাবে পার্সেল বুকিং হয়েছে!',
        consignmentId,
        trackingCode,
      };
    } else {
      return {
        success: false,
        message: data.message || data.error_description || 'পাঠাও সার্ভারে অর্ডার সাবমিট ব্যর্থ হয়েছে।',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `পাঠাও API কল ত্রুটি: ${err?.message || 'অর্ডার পাঠানো সম্ভব হয়নি।'}`,
    };
  }
};
