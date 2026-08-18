import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="bg-[#11202F] border border-[#1E3247] rounded-2xl overflow-hidden shadow-xl animate-pulse">
      <div className="p-4 border-b border-[#1E3247] flex items-center justify-between">
        <div className="h-4 w-32 bg-[#1E3247] rounded-md" />
        <div className="h-4 w-16 bg-[#1E3247] rounded-md" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="flex items-center space-x-4">
            <div className="h-8 w-8 bg-[#1E3247] rounded-xl shrink-0" />
            <div className="h-4 w-1/4 bg-[#1E3247] rounded-md" />
            <div className="h-4 w-1/4 bg-[#1E3247] rounded-md" />
            <div className="h-4 w-1/6 bg-[#1E3247] rounded-md" />
            <div className="h-4 w-1/6 bg-[#1E3247] rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-[#11202F] border border-[#1E3247] rounded-2xl p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 bg-[#1E3247] rounded" />
        <div className="h-8 w-8 bg-[#1E3247] rounded-xl" />
      </div>
      <div className="h-7 w-32 bg-[#1E3247] rounded-md" />
      <div className="h-3 w-20 bg-[#1E3247] rounded" />
    </div>
  );
};
