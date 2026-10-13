/**
 * Honor Board Modal (لوحة الشرف والأبطال)
 * Highlights top students, weekly and monthly champions, and best streaks
 * Riyadh Al-Ebdaa Schools
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, X, Medal, Flame, Star, Sparkles } from 'lucide-react';
import { SchoolStudent } from '../data/students';
import { toHindi } from '../utils/format';
import { RiyadhEbdaaLogo } from './RiyadhEbdaaLogo';

interface HonorBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: SchoolStudent[];
}

export const HonorBoardModal: React.FC<HonorBoardModalProps> = ({
  isOpen,
  onClose,
  students
}) => {
  const [filter, setFilter] = useState<'all' | 'streak' | 'recent'>('all');

  if (!isOpen) return null;

  // Sort students according to selected filter
  const sortedStudents = [...students].sort((a, b) => {
    if (filter === 'streak') {
      return (b.bestStreak || 0) - (a.bestStreak || 0);
    }
    if (filter === 'recent') {
      return (b.participationCount || 0) - (a.participationCount || 0);
    }
    return (b.totalScore || 0) - (a.totalScore || 0);
  });

  const top3 = sortedStudents.slice(0, 3);
  const remaining = sortedStudents.slice(3, 20);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md dir-rtl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col space-y-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">لوحة الشرف وفرسان الحساب</h2>
              <span className="text-[11px] text-amber-400 font-bold">مدارس رياض الإبداع • تكريم المتميزين</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RiyadhEbdaaLogo size="xs" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 shrink-0">
          {[
            { id: 'all', label: '🏆 أبطال النقاط الكلية' },
            { id: 'streak', label: '🔥 أعلى سلاسل الإتقان' },
            { id: 'recent', label: '⭐ الأكثر تفاعلاً ومشاركة' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all border text-center ${
                filter === tab.id
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Podium for Top 3 */}
        {sortedStudents.length > 0 ? (
          <div className="overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-3 gap-2 pt-2 items-end">
              {/* Rank 2 (Silver) */}
              {top3[1] && (
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-700/80 text-center space-y-1 shadow-lg">
                  <span className="text-2xl block">🥈</span>
                  <span className="text-xs font-bold text-slate-400 block">المركز الثاني</span>
                  <p className="text-xs sm:text-sm font-black text-white truncate font-['El_Messiri',serif]">
                    {top3[1].name}
                  </p>
                  <span className="text-xs font-mono font-black text-amber-400 block">
                    {toHindi(filter === 'streak' ? top3[1].bestStreak || 0 : top3[1].totalScore || 0)} {filter === 'streak' ? 'تتابع' : 'نقطة'}
                  </span>
                </div>
              )}

              {/* Rank 1 (Gold) */}
              {top3[0] && (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-500/20 to-yellow-500/5 border-2 border-amber-400 text-center space-y-1 shadow-xl -translate-y-2">
                  <span className="text-3xl block">🥇</span>
                  <span className="text-[11px] font-black text-amber-400 block uppercase">بطل الإبداع</span>
                  <p className="text-sm sm:text-base font-black text-white truncate font-['El_Messiri',serif]">
                    {top3[0].name}
                  </p>
                  <span className="text-sm font-mono font-black text-amber-300 block">
                    {toHindi(filter === 'streak' ? top3[0].bestStreak || 0 : top3[0].totalScore || 0)} {filter === 'streak' ? 'تتابع' : 'نقطة'}
                  </span>
                </div>
              )}

              {/* Rank 3 (Bronze) */}
              {top3[2] && (
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-700/80 text-center space-y-1 shadow-lg">
                  <span className="text-2xl block">🥉</span>
                  <span className="text-xs font-bold text-slate-400 block">المركز الثالث</span>
                  <p className="text-xs sm:text-sm font-black text-white truncate font-['El_Messiri',serif]">
                    {top3[2].name}
                  </p>
                  <span className="text-xs font-mono font-black text-amber-400 block">
                    {toHindi(filter === 'streak' ? top3[2].bestStreak || 0 : top3[2].totalScore || 0)} {filter === 'streak' ? 'تتابع' : 'نقطة'}
                  </span>
                </div>
              )}
            </div>

            {/* Remaining Ranks List */}
            {remaining.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-bold text-slate-400 block pb-1">بقية المتصدرين:</span>
                {remaining.map((st, idx) => (
                  <div
                    key={st.id}
                    className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-300 font-mono font-black text-[11px] flex items-center justify-center">
                        {toHindi(idx + 4)}
                      </span>
                      <span className="font-black text-white">{st.name}</span>
                      <span className="text-[10px] text-slate-400">({st.gradeName || 'الصف'} • فصل {st.section || 'أ'})</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-black text-amber-400">
                        {toHindi(filter === 'streak' ? st.bestStreak || 0 : st.totalScore || 0)} {filter === 'streak' ? 'تتابع' : 'نقطة'}
                      </span>
                      <span className="text-[10px] text-emerald-400">⭐ م.{toHindi(st.level || 1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 font-bold text-xs space-y-2">
            <Trophy className="w-8 h-8 mx-auto opacity-30 text-amber-400" />
            <p>لا توجد بيانات مسجلة في لوحة الشرف حتى الآن.</p>
            <p className="text-[11px] text-slate-600">ستظهر الأسماء تلقائياً عند إتمام أول مسابقة صفية.</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  );
};
