import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, User } from 'lucide-react';
import { Customer } from '../types';

interface SearchableCustomerSelectProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (customerId: string) => void;
  getCustomerStats: (custCode: string) => { currentDue: number };
  isDark?: boolean;
  isBn?: boolean;
  placeholder?: string;
  required?: boolean;
}

export const SearchableCustomerSelect: React.FC<SearchableCustomerSelectProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  getCustomerStats,
  isDark = false,
  isBn = false,
  placeholder,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCust = customers.find((c) => c.id === selectedCustomerId);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter customers dynamically by Name, Customer Code, Phone, or Shipping Mark
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.customer_code.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.shipping_mark && c.shipping_mark.toLowerCase().includes(q))
    );
  });

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer.id);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectCustomer('');
    setSearchQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden input for form HTML validation if required */}
      {required && (
        <input
          type="text"
          value={selectedCustomerId}
          onChange={() => {}}
          required
          tabIndex={-1}
          className="sr-only opacity-0 w-0 h-0 pointer-events-none absolute"
        />
      )}

      {/* Main Combobox Input Field */}
      <div
        onClick={() => {
          setIsOpen(true);
          if (inputRef.current) inputRef.current.focus();
        }}
        className={`w-full border rounded-none p-2.5 flex items-center justify-between cursor-pointer transition-all ${
          isOpen ? 'ring-2 ring-[#00897B] border-[#00897B]' : ''
        } ${
          isDark
            ? 'bg-[#0B1622] border-[#1E3247] text-white hover:border-slate-600'
            : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center space-x-2 overflow-hidden flex-1 mr-2">
          <Search className="w-4 h-4 text-[#00897B] shrink-0" />
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                placeholder ||
                (isBn
                  ? 'নাম, কোড, শিপিং মার্ক বা ফোন নম্বর লিখে খুঁজুন...'
                  : 'Search by name, code, mark, or phone...')
              }
              className={`w-full outline-none bg-transparent text-xs font-medium ${
                isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
              }`}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="truncate text-xs font-medium">
              {selectedCust ? (
                <div className="flex items-center space-x-1.5 truncate">
                  <span className="font-extrabold">{selectedCust.name}</span>
                  <span className="font-mono text-[11px] text-slate-400">({selectedCust.customer_code})</span>
                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-[#00897B]/10 text-[#00897B]">
                    ৳{getCustomerStats(selectedCust.customer_code).currentDue.toLocaleString()}
                  </span>
                </div>
              ) : (
                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                  {placeholder || (isBn ? '-- কাস্টমার সিলেক্ট বা টাইপ করে খুঁজুন --' : '-- Select or type customer name --')}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          {selectedCustomerId && !isOpen && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-[#00897B]' : ''}`}
          />
        </div>
      </div>

      {/* Floating Results List Popup */}
      {isOpen && (
        <div
          className={`absolute z-50 left-0 right-0 top-full mt-1 max-h-64 overflow-y-auto border shadow-2xl rounded-none animate-in fade-in-50 zoom-in-95 ${
            isDark
              ? 'bg-[#1E293B] border-[#1E3247] text-white divide-y divide-[#1E3247]'
              : 'bg-white border-slate-300 text-slate-900 divide-y divide-slate-100'
          }`}
        >
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((c) => {
              const due = getCustomerStats(c.customer_code).currentDue;
              const isSelected = c.id === selectedCustomerId;

              return (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#00897B]/15 font-bold border-l-4 border-[#00897B]'
                      : isDark
                      ? 'hover:bg-slate-800/80 text-slate-200'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold truncate text-sm">{c.name}</span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {c.customer_code}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>Phone: {c.phone}</span>
                      {c.shipping_mark && (
                        <span className="text-[#00897B] font-bold">| MARK: {c.shipping_mark}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center space-x-2">
                    <div className="text-right">
                      <span className="text-[9px] uppercase text-slate-400 font-bold block">বর্তমান বকেয়া</span>
                      <span
                        className={`font-mono text-xs font-black ${
                          due > 0 ? (isDark ? 'text-slate-100' : 'text-slate-900') : (isDark ? 'text-emerald-400' : 'text-emerald-800')
                        }`}
                      >
                        ৳{due.toLocaleString()}
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#00897B]" />}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
              <User className="w-5 h-5 mx-auto mb-1 text-slate-400 opacity-60" />
              <span>{isBn ? 'কোন কাস্টমার পাওয়া যায়নি' : 'No matching customer found'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
