import React, { useRef } from 'react';
import { Award, Download, Printer, X, Sparkles } from 'lucide-react';
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
  teacherName = 'أ/ أسامة إبراهيم',
  title = 'مسابقة جدول الضرب الكبرى',
  rank
}) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-2xl">
        {/* Actions Bar */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-yellow-400 font-bold">
            <Award className="w-6 h-6" />
            <span className="text-lg">شهادة تفوق وإتقان جدول الضرب</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-900 bg-yellow-400 rounded-xl hover:bg-yellow-300 transition-colors shadow-md"
            >
              <Printer className="w-4 h-4" />
              طباعة الشهادة
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Printable Area */}
        <div
          ref={certRef}
          className="relative p-10 md:p-14 bg-[#fdfbf7] text-slate-900 rounded-2xl border-[12px] border-double border-[#b48a3c] shadow-2xl overflow-hidden font-sans select-none print:m-0 print:border-[10px]"
          dir="rtl"
        >
          {/* Subtle background ornamentation */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#b48a3c_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Decorative Corner Ornaments */}
          <div className="absolute top-3 right-3 text-[#b48a3c] text-3xl font-serif">✦</div>
          <div className="absolute top-3 left-3 text-[#b48a3c] text-3xl font-serif">✦</div>
          <div className="absolute bottom-3 right-3 text-[#b48a3c] text-3xl font-serif">✦</div>
          <div className="absolute bottom-3 left-3 text-[#b48a3c] text-3xl font-serif">✦</div>

          <div className="relative text-center space-y-6">
            {/* Header: School Logo & Bismillah */}
            <div className="flex flex-col items-center justify-center gap-2">
              <RiyadhEbdaaLogo size="md" inverted={false} />
              <div className="text-xs font-bold text-[#8c6527] tracking-widest pt-1">
                بِسْمِ اللَّـهِ الرَّحْمَـٰنِ الرَّحِيمِ
              </div>
            </div>

            {/* Certificate Title */}
            <div>
              <h1 className="text-3xl md:text-5xl font-black text-[#6d4c18] font-['El_Messiri',serif] tracking-wide">
                شَهَادَةُ تَمَيُّزٍ وَإِبْدَاعٍ
              </h1>
              <p className="mt-2 text-base md:text-lg font-bold text-slate-600">
                في إتقان جدول الضرب والعمليات الحسابية
              </p>
            </div>

            {/* Body text */}
            <div className="space-y-4 max-w-2xl mx-auto py-2">
              <p className="text-lg md:text-xl text-slate-700 leading-relaxed">
                يَسُرُّ إدارة الفصل ومُعَلِّم الرياضيات أن يمنح هذه الشهادة للفائز المتميز:
              </p>

              <div className="inline-block py-3 px-8 bg-gradient-to-r from-yellow-50 via-amber-100 to-yellow-50 border-y-2 border-[#b48a3c] rounded-xl shadow-inner my-2">
                <span className="text-2xl md:text-4xl font-black text-[#5a3a0e] font-['El_Messiri',serif]">
                  {studentName}
                </span>
              </div>

              <p className="text-base md:text-lg text-slate-700 leading-relaxed font-medium">
                وذلك نظير تفوقه الباهر وحصوله على{' '}
                <span className="font-black text-[#8c6527]">{toHindi(score)} نقطة</span> بنسبة إتقان{' '}
                <span className="font-black text-emerald-700">{toHindi(percentage)}٪</span>{' '}
                {rank ? `(المركز ${rank === 1 ? 'الأول 🥇' : rank === 2 ? 'الثاني 🥈' : rank === 3 ? 'الثالث 🥉' : toHindi(rank)})` : ''}{' '}
                في <span className="font-bold text-slate-800">{title}</span>، سائلين الله له دوام التفوق والنجاح.
              </p>
            </div>

            {/* Badges / Stats Strip */}
            <div className="flex flex-wrap justify-center gap-4 py-3">
              <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs md:text-sm font-bold text-amber-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>الإجابات الصحيحة: {toHindi(correctCount)} من {toHindi(totalQuestions)}</span>
              </div>
              <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs md:text-sm font-bold text-amber-900">
                <span>التاريخ: {today}</span>
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-6 border-t border-amber-200/80 flex justify-between items-end px-6 md:px-12 text-center">
              <div>
                <p className="text-xs text-slate-500 font-bold">الختم والاعتماد</p>
                <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mt-1 border-2 border-dashed border-[#b48a3c] rounded-full flex items-center justify-center text-[10px] md:text-xs text-[#8c6527] font-black rotate-[-12deg] opacity-80">
                  معتمد ✦ تميز
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-bold">مشرف المسابقة ومُعَلِّم المادة</p>
                <p className="mt-2 text-base md:text-xl font-black text-[#5a3a0e] font-['El_Messiri',serif]">
                  {teacherName}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer tip */}
        <p className="text-xs text-center text-slate-400 mt-4">
          يمكنك طباعة الشهادة مباشرة أو حفظها بصيغة PDF عبر خيار الطباعة
        </p>
      </div>
    </div>
  );
};
