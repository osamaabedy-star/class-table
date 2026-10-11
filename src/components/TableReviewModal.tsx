import React, { useState } from 'react';
import { X, BookOpen } from 'lucide-react';
import { toHindi } from '../utils/format';

interface TableReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TableReviewModal: React.FC<TableReviewModalProps> = ({ isOpen, onClose }) => {
  const [activeTable, setActiveTable] = useState<number>(2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white">مراجعة جداول الضرب</h2>
              <p className="text-xs text-slate-400 font-medium">راجع نتائج جداول الضرب من ٢ إلى ١٢ قبل بدء المسابقة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table Selector Tabs */}
        <div className="flex gap-2 overflow-x-auto py-4 scrollbar-none">
          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
            <button
              key={n}
              onClick={() => setActiveTable(n)}
              className={`px-5 py-3 rounded-2xl font-black text-base whitespace-nowrap transition-all border ${
                activeTable === n
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30 scale-105'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800'
              }`}
            >
              جدول {toHindi(n)}
            </button>
          ))}
        </div>

        {/* Table Grid */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(factor => (
              <div
                key={factor}
                className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between hover:border-indigo-500 transition-colors"
              >
                <span className="text-slate-300 font-bold text-lg">
                  {toHindi(activeTable)} × {toHindi(factor)}
                </span>
                <span className="text-amber-400 font-black text-2xl font-mono">
                  {toHindi(activeTable * factor)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md"
          >
            إغلاق والعودة
          </button>
        </div>
      </div>
    </div>
  );
};
