/**
 * Compact Student Picker Modal
 * Allows picking student from School Roster by Grade & Section
 * Riyadh Al-Ebdaa Schools
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, GraduationCap, Check } from 'lucide-react';
import { SchoolStudent, SCHOOL_GRADES } from '../data/students';
import { toHindi } from '../utils/format';

interface StudentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: SchoolStudent[];
  onSelectStudent: (name: string, student: SchoolStudent) => void;
}

export const StudentPickerModal: React.FC<StudentPickerModalProps> = ({
  isOpen,
  onClose,
  students,
  onSelectStudent
}) => {
  const [gradeId, setGradeId] = useState<string>('grade3');
  const [section, setSection] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  if (!isOpen) return null;

  const filtered = students.filter(s => {
    if (gradeId !== 'all' && s.gradeId !== gradeId) return false;
    if (section !== 'all' && s.section !== section) return false;
    if (search.trim() && !s.name.includes(search.trim())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm dir-rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col max-h-[85vh] space-y-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black text-white">اختيار الطالب من قائمة المدرسة</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grade Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setGradeId('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors ${
              gradeId === 'all'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            الكل
          </button>
          {SCHOOL_GRADES.map(g => (
            <button
              key={g.id}
              onClick={() => setGradeId(g.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                gradeId === g.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {g.shortName}
            </button>
          ))}
        </div>

        {/* Section Filter & Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pr-8 pl-2 py-1 text-xs text-white outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-1">
            {['all', 'أ', 'ب', 'ج'].map(sec => (
              <button
                key={sec}
                onClick={() => setSection(sec)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                  section === sec
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {sec === 'all' ? 'الكل' : sec}
              </button>
            ))}
          </div>
        </div>

        {/* Students List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-64">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 font-bold">
              لا توجد أسماء مطابقة في هذا الصف
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {filtered.map(st => (
                <button
                  key={st.id}
                  onClick={() => {
                    onSelectStudent(st.name, st);
                    onClose();
                  }}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-right flex flex-col justify-between transition-colors group"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-xs font-bold text-white truncate group-hover:text-amber-400">
                      {st.name}
                    </span>
                    <span className="text-[9px] font-black bg-amber-500/10 text-amber-400 px-1 py-0.2 rounded border border-amber-500/20">
                      م.{toHindi(st.level || 1)}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1">
                    {st.gradeName.replace(' الابتدائي', '')} ({st.section})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
