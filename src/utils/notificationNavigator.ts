/**
 * Smart Notification Navigation Utility
 * Resolves exact module route based on notification content and user role.
 */
export const getNotificationTargetUrl = (
  notification: { title?: string; message?: string; link?: string; type?: string },
  userRole?: string
): string => {
  const rolePrefix =
    userRole === 'super_admin'
      ? '/admin'
      : userRole === 'operation_director'
      ? '/operations'
      : userRole === 'warehouse_incharge'
      ? '/warehouse'
      : userRole === 'accountant'
      ? '/accounts'
      : userRole === 'crm_executive'
      ? '/crm'
      : '/admin';

  let target = notification.link || '';
  if (target && target.startsWith('/')) {
    if (target.startsWith('/admin') || target.startsWith('/operations') || target.startsWith('/warehouse') || target.startsWith('/accounts') || target.startsWith('/crm')) {
      target = target.replace(/^\/(admin|operations|warehouse|accounts|crm)/, rolePrefix);
    }
    return target;
  }

  const text = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();

  if (text.includes('বুকিং') || text.includes('কার্টুন') || text.includes('booking') || text.includes('carton')) {
    return `${rolePrefix}/cartons`;
  }
  if (text.includes('ফ্লাইট') || text.includes('প্রপোজাল') || text.includes('flight') || text.includes('proposal')) {
    return `${rolePrefix}/proposals`;
  }
  if (text.includes('লেজার') || text.includes('ক্যাশ') || text.includes('টাকা') || text.includes('ledger') || text.includes('payment') || text.includes('billed')) {
    return `${rolePrefix}/ledger`;
  }
  if (text.includes('ইউজার') || text.includes('একাউন্ট') || text.includes('user') || text.includes('account')) {
    return `${rolePrefix}/users`;
  }
  if (text.includes('চ্যাট') || text.includes('ইনকোয়ারি') || text.includes('chat') || text.includes('inquiry')) {
    return `${rolePrefix}/chat`;
  }
  if (text.includes('ওয়্যারহাউজ') || text.includes('warehouse')) {
    return `${rolePrefix}/warehouses`;
  }

  return `${rolePrefix}/dashboard`;
};
