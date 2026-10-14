import React, { useRef, useState } from 'react';
import { Award, Printer, X, Sparkles, Download, Edit3, Check, Eye } from 'lucide-react';
import html2canvas from 'html2canvas';
import { toHindi } from '../utils/format';
import { RiyadhEbdaaLogo } from './RiyadhEbdaaLogo';
import { sounds } from '../utils/audio';

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
  rank = 1
}) => {
  const [template, setTemplate] = useState<'gold' | 'navy' | 'emerald'>('gold');
  const [teacher, setTeacher] = useState<string>(initialTeacher);
  const [principal, setPrincipal] = useState<string>('قائد مدارس رياض الإبداع');
  const [showEditNames, setShowEditNames] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
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
    sounds.playTap();
    window.print();
  };

  const handleDownloadPng = async () => {
    if (!certRef.current || isDownloading) return;
    try {
      setIsDownloading(true);
      sounds.playTap();
      const canvas = await html2canvas(certRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `شهادة_تفوق_${studentName || 'البطل'}_افقية.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      sounds.playSuccess();
    } catch (e) {
      console.error('Error generating landscape certificate image:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  // Template styling classes for authentic royal landscape diploma
  const getThemeClasses = () => {
    if (template === 'navy') {
      return {
        wrapper: 'bg-[#080e21] text-white border-[#38bdf8]',
        accent: 'text-[#38bdf8]',
        subtext: 'text-slate-300',
        badgeBg: 'bg-sky-500/20 border-sky-400/50 text-sky-200',
        nameBox: 'bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border-sky-400 text-sky-300 shadow-sky-950/60',
        card: 'border-[12px] border-double border-[#38bdf8]',
        innerBorder: 'border-sky-500/40',
        seal: 'border-sky-400 text-sky-300 bg-sky-950/60 shadow-sky-500/30'
      };
    }
    if (template === 'emerald') {
      return {
        wrapper: 'bg-[#042017] text-white border-[#34d399]',
        accent: 'text-[#34d399]',
        subtext: 'text-emerald-100',
        badgeBg: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200',
        nameBox: 'bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 border-emerald-400 text-emerald-300 shadow-emerald-950/60',
        card: 'border-[12px] border-double border-[#34d399]',
        innerBorder: 'border-emerald-500/40',
        seal: 'border-emerald-400 text-emerald-300 bg-emerald-950/60 shadow-emerald-500/30'
      };
    }
    // Default Royal Golden Luxury
    return {
      wrapper: 'bg-[#fdfaf3] text-slate-900 border-[#c59a3f]',
      accent: 'text-[#8c6527]',
      subtext: 'text-slate-700',
      badgeBg: 'bg-amber-500/15 border-amber-600/40 text-amber-950',
      nameBox: 'bg-gradient-to-r from-amber-50 via-amber-100 to-amber-50 border-[#c59a3f] text-[#54360e] shadow-amber-900/15',
      card: 'border-[14px] border-double border-[#c59a3f]',
      innerBorder: 'border-[#c59a3f]/50',
      seal: 'border-[#c59a3f] text-[#8c6527] bg-amber-50/80 shadow-amber-500/20'
    };
  };

  const theme = getThemeClasses();

  return (
    <div className="cert-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md dir-rtl overflow-y-auto">
      {/* Strict Landscape Print Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: landscape !important;
            margin: 0 !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .cert-modal-backdrop {
            position: static !important;
            padding: 0 !important;
            background: transparent !important;
            overflow: visible !important;
            display: block !important;
          }
          .cert-modal-dialog {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            max-width: 100vw !important;
            max-height: none !important;
            box-shadow: none !important;
            width: 100vw !important;
            height: 100vh !important;
          }
          .cert-non-printable {
            display: none !important;
          }
          .cert-print-area {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            aspect-ratio: auto !important;
            border-width: 14px !important;
            border-style: double !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      <div className="cert-modal-dialog relative w-full max-w-5xl bg-slate-900/95 border border-slate-700 rounded-3xl p-3 sm:p-4 shadow-2xl space-y-2.5 my-auto">
        {/* Top Slim Control Bar */}
        <div className="cert-non-printable flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="font-black text-xs sm:text-sm">شهادة تفوق أفقية (Landscape) متوافقة تماماً مع الشاشة والطباعة</span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            {/* Template Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 px-1">النمط:</span>
              {[
                { id: 'gold', label: 'الذهبي 🏆' },
                { id: 'navy', label: 'الملكي 👑' },
                { id: 'emerald', label: 'الزمردي 💎' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => { sounds.playTap(); setTemplate(t.id as any); }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all ${
                    template === t.id
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Toggle Name Edit */}
            <button
              onClick={() => setShowEditNames(!showEditNames)}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-[11px] flex items-center gap-1 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>{showEditNames ? 'إخفاء الأسماء' : 'تعديل المعلم/القائد'}</span>
            </button>

            {/* Download Landscape PNG */}
            <button
              onClick={handleDownloadPng}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-black text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              title="تحميل الشهادة كصورة أفقية عالية الجودة"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'جاري التحميل...' : 'حفظ كصورة أفقية (PNG)'}</span>
            </button>

            {/* Print Landscape */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 rounded-xl transition-all shadow-md active:scale-95"
              title="طباعة الشهادة أفقياً"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة أفقية</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Inputs for Teacher & Principal Names */}
        {showEditNames && (
          <div className="cert-non-printable grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-xs">
            <div>
              <label className="block text-slate-300 font-bold text-[10px] mb-1">اسم معلم المادة:</label>
              <input
                type="text"
                value={teacher}
                onChange={e => setTeacher(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold text-[10px] mb-1">اسم قائد المدرسة / الإدارة:</label>
              <input
                type="text"
                value={principal}
                onChange={e => setPrincipal(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CERTIFICATE DISPLAY & PRINT AREA: STRICT WIDE LANDSCAPE   */}
        {/* ========================================================= */}
        <div
          ref={certRef}
          className={`cert-print-area relative w-full aspect-[16/9] max-h-[78vh] mx-auto p-4 sm:p-6 md:p-8 rounded-2xl shadow-2xl select-none flex flex-col justify-between overflow-hidden ${theme.wrapper} ${theme.card}`}
          dir="rtl"
        >
          {/* Subtle Islamic / Luxury Ornamental Geometric Pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#c59a3f_1.2px,transparent_1.2px)] [background-size:18px_18px]" />

          {/* Inner Ornate Framing Border */}
          <div className={`absolute inset-2 border ${theme.innerBorder} rounded-xl pointer-events-none`} />

          {/* Decorative Corner Ornaments (Arabesque Flourishes) */}
          <div className={`absolute top-3 right-3 text-xl md:text-2xl font-serif select-none ${theme.accent}`}>✦</div>
          <div className={`absolute top-3 left-3 text-xl md:text-2xl font-serif select-none ${theme.accent}`}>✦</div>
          <div className={`absolute bottom-3 right-3 text-xl md:text-2xl font-serif select-none ${theme.accent}`}>✦</div>
          <div className={`absolute bottom-3 left-3 text-xl md:text-2xl font-serif select-none ${theme.accent}`}>✦</div>

          {/* --------------------------------------------------------- */}
          {/* 1. TOP HEADER (HORIZONTAL ROW)                            */}
          {/* --------------------------------------------------------- */}
          <div className="relative flex items-center justify-between border-b border-current/15 pb-2 px-2 z-10">
            {/* Right: School Logo & Title */}
            <div className="flex items-center gap-2 text-right">
              <RiyadhEbdaaLogo size="sm" inverted={template !== 'gold'} />
              <div className="hidden sm:block">
                <p className="text-[10px] md:text-[11px] font-black leading-tight">المملكة العربية السعودية</p>
                <p className="text-[9px] md:text-[10px] opacity-75 font-bold">وزارة التعليم • مدارس رياض الإبداع</p>
              </div>
            </div>

            {/* Center: Grand Calligraphic Title */}
            <div className="text-center px-2">
              <div className={`text-[9px] sm:text-[11px] font-bold tracking-widest ${theme.accent}`}>
                بِسْمِ اللَّـهِ الرَّحْمَـٰنِ الرَّحِيمِ
              </div>
              <h1 className="text-lg sm:text-2xl md:text-3xl font-black font-['El_Messiri',serif] tracking-wider mt-0.5">
                شَهَادَةُ شُكْرٍ وَتَقْدِيرٍ وَتَفَوُّقٍ
              </h1>
            </div>

            {/* Left: Date & Certificate ID */}
            <div className="text-left font-mono">
              <div className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.badgeBg}`}>
                <span>التاريخ:</span>
                <span>{today}</span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------- */}
          {/* 2. MAIN HORIZONTAL BODY                                   */}
          {/* --------------------------------------------------------- */}
          <div className="relative text-center my-auto space-y-1.5 sm:space-y-2.5 px-3 z-10">
            {/* Ribbon Badge */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-[10px] sm:text-xs font-black shadow-xs ${theme.badgeBg}`}>
              <span>🥇 وسام المركز الأول وبطل مسابقة الرياضيات</span>
            </div>

            <p className={`text-xs sm:text-sm font-bold ${theme.subtext}`}>
              تَسُرُّ إدارة مدارس رياض الإبداع ومُعَلِّم الرياضيات أن يمنح هذه الشهادة للبطل المتفوق:
            </p>

            {/* Prominent Student Name Banner (Calligraphic Box) */}
            <div className={`inline-block py-1.5 sm:py-2 px-6 sm:px-12 border-y-2 rounded-xl shadow-lg my-0.5 transition-transform hover:scale-[1.01] ${theme.nameBox}`}>
              <span className="text-xl sm:text-3xl md:text-4xl font-black font-['El_Messiri',serif] tracking-wide">
                {studentName || 'بطل الرياضيات'}
              </span>
            </div>

            {/* Achievement Paragraph */}
            <p className={`text-xs sm:text-sm leading-relaxed font-medium max-w-2xl mx-auto ${theme.subtext}`}>
              وذلك نظير تحقيقه <span className="font-black text-amber-500">المركز الأول 🥇</span> وفوزه بلقب بطل المسابقة بحصوله على{' '}
              <span className="font-black underline">{toHindi(score)} درجات</span> بنسبة إتقان{' '}
              <span className="font-black text-emerald-500">{toHindi(percentage)}٪</span> في{' '}
              <span className="font-bold">{title}</span>، سائلين الله له دوام الإبداع والتفوق العلمي.
            </p>

            {/* Horizontal Metric Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
              <div className={`px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-black flex items-center gap-1 border ${theme.badgeBg}`}>
                <Sparkles className="w-3 h-3" />
                <span>النتيجة: {toHindi(correctCount)} من {toHindi(totalQuestions)}</span>
              </div>
              <div className={`px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-black border ${theme.badgeBg}`}>
                <span>نسبة الإتقان: {toHindi(percentage)}٪</span>
              </div>
              <div className={`px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-black border ${theme.badgeBg}`}>
                <span>المستوى: ممتاز مع مرتبة الشرف 🌟</span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------- */}
          {/* 3. BOTTOM FOOTER (SIGNATURES & OFFICIAL EMBOSSED SEAL)    */}
          {/* --------------------------------------------------------- */}
          <div className="relative pt-2 border-t border-current/15 flex justify-between items-end px-4 sm:px-8 text-center z-10">
            {/* Right: Principal Signature */}
            <div className="text-right sm:text-center min-w-[100px]">
              <p className="text-[10px] opacity-75 font-bold">قائد المدرسة</p>
              <p className="mt-0.5 text-xs sm:text-sm font-black font-['El_Messiri',serif]">
                {principal}
              </p>
              <div className="w-20 sm:w-28 h-0.5 bg-current/25 mx-auto mt-1" />
            </div>

            {/* Center: Official Golden Embossed Seal */}
            <div>
              <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto border-2 border-dashed rounded-full flex flex-col items-center justify-center text-[8px] sm:text-[9px] font-black rotate-[-8deg] shadow-md ${theme.seal}`}>
                <span>معتمد</span>
                <span className="text-[11px] sm:text-xs">✦ 🏆 ✦</span>
                <span>رياض الإبداع</span>
              </div>
            </div>

            {/* Left: Teacher Signature */}
            <div className="text-left sm:text-center min-w-[100px]">
              <p className="text-[10px] opacity-75 font-bold">مُعَلِّم المادة</p>
              <p className="mt-0.5 text-xs sm:text-sm font-black font-['El_Messiri',serif]">
                {teacher}
              </p>
              <div className="w-20 sm:w-28 h-0.5 bg-current/25 mx-auto mt-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
