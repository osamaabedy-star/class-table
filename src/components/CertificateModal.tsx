import React, { useRef, useState } from 'react';
import { Award, Printer, X, Sparkles, Palette } from 'lucide-react';
import { toHindi } from '../utils/format';
import { RiyadhEbdaaLogo } from './RiyadhEbdaaLogo';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  teacherName?: string;
  title?: string;
  rank?: number;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  studentName,
  score,
  totalQuestions,
  correctCount,
  teacherName: initialTeacher = 'أ/ أسامة إبراهيم',
  title = 'مسابقة جدول الضرب الكبرى',
}) => {
  const [template, setTemplate] = useState<'gold' | 'navy' | 'emerald'>('gold');
  const [teacher, setTeacher] = useState<string>(initialTeacher);
  const [principal, setPrincipal] = useState<string>('قائد مدارس رياض الإبداع');
  const certRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const percentage = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
  const todayRaw = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const today = toHindi(todayRaw);

  const handlePrint = () => {
    window.print();
  };

  // Template styling classes
  const getThemeClasses = () => {
    if (template === 'navy') {
      return {
        wrapper: 'bg-[#0b1329] text-white border-[#38bdf8]',
        accent: 'text-[#38bdf8]',
        badgeBg: 'bg-sky-500/20 border-sky-400/40 text-sky-200',
        nameBox: 'bg-slate-900 border-sky-400/60 text-sky-300',
        card: 'border-[10px] border-double border-[#38bdf8]/80'
      };
    }
    if (template === 'emerald') {
      return {
        wrapper: 'bg-[#062c22] text-white border-[#34d399]',
        accent: 'text-[#34d399]',
        badgeBg: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200',
        nameBox: 'bg-emerald-950 border-emerald-400/60 text-emerald-300',
        card: 'border-[10px] border-double border-[#34d399]/80'
      };
    }
    // Default Gold
    return {
      wrapper: 'bg-[#fdfbf7] text-slate-900 border-[#b48a3c]',
      accent: 'text-[#8c6527]',
      badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-900',
      nameBox: 'bg-gradient-to-r from-yellow-50 via-amber-100 to-yellow-50 border-[#b48a3c] text-[#5a3a0e]',
      card: 'border-[12px] border-double border-[#b48a3c]'
    };
  };

  const theme = getThemeClasses();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md dir-rtl">
      <div className="relative w-full max-w-4xl max-h-[96vh] overflow-y-auto bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-700 shadow-2xl space-y-4">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Award className="w-5 h-5" />
            <span className="text-sm sm:text-base font-black">شهادة تفوق وبطل المسابقة</span>
          </div>

          {/* Template Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 px-1.5">النمط:</span>
            {[
              { id: 'gold', label: 'الذهبي' },
              { id: 'navy', label: 'الملكي' },
              { id: 'emerald', label: 'الزمردي' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                  template === t.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-xl hover:from-amber-300 hover:to-yellow-300 transition-all shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الشهادة</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inputs for Teacher & Principal Names */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 print:hidden text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1">اسم معلم المادة:</label>
            <input
              type="text"
              value={teacher}
              onChange={e => setTeacher(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">اسم قائد المدرسة / الإدارة:</label>
            <input
              type="text"
              value={principal}
              onChange={e => setPrincipal(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Certificate Printable Area */}
        <div
          ref={certRef}
          className={`relative p-8 md:p-12 rounded-2xl shadow-2xl overflow-hidden font-sans select-none print:m-0 print:border-[10px] ${theme.wrapper} ${theme.card}`}
          dir="rtl"
        >
          {/* Subtle background ornamentation */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#b48a3c_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Decorative Corner Ornaments */}
          <div className={`absolute top-3 right-3 text-3xl font-serif ${theme.accent}`}>✦</div>
          <div className={`absolute top-3 left-3 text-3xl font-serif ${theme.accent}`}>✦</div>
          <div className={`absolute bottom-3 right-3 text-3xl font-serif ${theme.accent}`}>✦</div>
          <div className={`absolute bottom-3 left-3 text-3xl font-serif ${theme.accent}`}>✦</div>

          <div className="relative text-center space-y-5">
            {/* Header: School Logo & Bismillah */}
            <div className="flex flex-col items-center justify-center gap-1.5">
              <RiyadhEbdaaLogo size="md" inverted={template !== 'gold'} />
              <div className={`text-xs font-bold tracking-widest pt-1 ${theme.accent}`}>
                بِسْمِ اللَّـهِ الرَّحْمَـٰنِ الرَّحِيمِ
              </div>
            </div>

            {/* Certificate Title */}
            <div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black mb-1.5 ${theme.badgeBg}`}>
                <span>🥇 وسام المركز الأول وبطل المسابقة</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black font-['El_Messiri',serif] tracking-wide">
                شَهَادَةُ تَمَيُّزٍ وَتَفَوُّقٍ
              </h1>
              <p className="mt-1 text-sm md:text-base font-bold opacity-80">
                بطل مسابقة الحساب الذهني وإتقان جدول الضرب
              </p>
            </div>

            {/* Body text */}
            <div className="space-y-3 max-w-2xl mx-auto py-1">
              <p className="text-base md:text-lg leading-relaxed font-bold opacity-90">
                يَسُرُّ إدارة مدارس رياض الإبداع ومُعَلِّم الرياضيات أن يمنح هذه الشهادة للبطل الفائز:
              </p>

              <div className={`inline-block py-2.5 px-8 border-y-2 rounded-xl shadow-inner my-1 ${theme.nameBox}`}>
                <span className="text-2xl md:text-4xl font-black font-['El_Messiri',serif]">
                  {studentName}
                </span>
              </div>

              <p className="text-sm md:text-base leading-relaxed font-medium opacity-90">
                وذلك نظير تحقيقه <span className="font-black text-amber-500">المركز الأول 🥇</span> وفوزه بلقب بطل المسابقة بحصوله على{' '}
                <span className="font-black underline">{toHindi(score)} درجات</span> بنسبة إتقان{' '}
                <span className="font-black text-emerald-500">{toHindi(percentage)}٪</span>{' '}
                في <span className="font-bold">{title}</span>، سائلين الله له دوام الإبداع والتفوق.
              </p>
            </div>

            {/* Badges Strip */}
            <div className="flex flex-wrap justify-center gap-3 py-2">
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${theme.badgeBg}`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>النتيجة: {toHindi(correctCount)} من {toHindi(totalQuestions)} درجات ({toHindi(percentage)}٪)</span>
              </div>
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold ${theme.badgeBg}`}>
                <span>التاريخ: {today}</span>
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-4 border-t border-current/20 flex justify-between items-end px-4 md:px-10 text-center">
              <div>
                <p className="text-xs opacity-75 font-bold">قائد المدرسة</p>
                <p className="mt-1 text-sm md:text-base font-black font-['El_Messiri',serif]">
                  {principal}
                </p>
              </div>

              <div>
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto border-2 border-dashed border-current rounded-full flex items-center justify-center text-[10px] md:text-xs font-black rotate-[-12deg] opacity-75">
                  معتمد ✦ تميز
                </div>
              </div>

              <div>
                <p className="text-xs opacity-75 font-bold">مُعَلِّم المادة</p>
                <p className="mt-1 text-sm md:text-base font-black font-['El_Messiri',serif]">
                  {teacher}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
