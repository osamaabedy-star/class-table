import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileSpreadsheet,
  Lock,
  Printer,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  XCircle
} from 'lucide-react';
import {
  AnalyzedParticipant,
  CompetitionSmartAnalysis,
  exportSmartAnalysisToExcel
} from '../utils/competitionAnalytics';
import { toHindi } from '../utils/format';
import { sounds } from '../utils/audio';
import { RiyadhEbdaaLogo } from './RiyadhEbdaaLogo';

interface SmartCompetitionReportProps {
  title: string;
  subtitle?: string;
  analysis: CompetitionSmartAnalysis;
  opMode: 'multi' | 'divi' | 'mixed';
  onOpenCertificate?: (
    name: string,
    score: number,
    correct: number,
    total: number,
    rank?: number
  ) => void;
  exportFileName?: string;
}

const getPercentageBadgeStyle = (pct: number) => {
  if (pct > 90) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 print:bg-emerald-50 print:text-emerald-800 print:border-emerald-300';
  }
  if (pct >= 75) {
    return 'bg-sky-500/15 text-sky-300 border-sky-500/35 print:bg-sky-50 print:text-sky-800 print:border-sky-300';
  }
  if (pct >= 60) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/35 print:bg-amber-50 print:text-amber-800 print:border-amber-300';
  }
  return 'bg-rose-500/15 text-rose-300 border-rose-500/35 print:bg-rose-50 print:text-rose-800 print:border-rose-300';
};

const getBarColorClass = (pct: number) => {
  if (pct > 90) return 'from-emerald-500 to-teal-400';
  if (pct >= 75) return 'from-sky-500 to-cyan-400';
  if (pct >= 60) return 'from-amber-500 to-yellow-400';
  return 'from-rose-500 to-orange-400';
};

export const SmartCompetitionReport: React.FC<SmartCompetitionReportProps> = ({
  title,
  subtitle,
  analysis,
  opMode,
  onOpenCertificate,
  exportFileName = 'التقرير_التحليلي_الذكي'
}) => {
  const isSingleStudent = analysis.participants.length === 1;
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(
    isSingleStudent ? analysis.participants[0]?.id || null : null
  );

  const reportDate = useMemo(() => {
    const raw = new Date().toLocaleDateString('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    return toHindi(raw);
  }, []);

  const opModeLabel =
    opMode === 'multi' ? 'الضرب (×)' : opMode === 'divi' ? 'القسمة (÷)' : 'مختلط (× و ÷)';

  const handlePrintReport = () => {
    sounds.playTap();
    document.body.setAttribute('data-print-mode', 'report');
    const cleanup = () => {
      document.body.removeAttribute('data-print-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1500);
    }, 60);
  };

  const handleExportExcel = () => {
    sounds.playTap();
    exportSmartAnalysisToExcel(analysis, exportFileName);
  };

  const renderStudentDetailCard = (p: AnalyzedParticipant) => {
    const tableList = analysis.testedTables
      .map(t => ({ table: t, stat: p.tableStats[t] }))
      .filter(item => item.stat && item.stat.total > 0);

    return (
      <div className="bg-slate-950/90 print:bg-slate-50 border border-indigo-500/30 print:border-slate-300 rounded-2xl p-4 space-y-3 text-right">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800 print:border-slate-300">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-400 print:text-amber-700" />
            <h4 className="text-sm font-black text-white print:text-slate-900">
              التقرير التفصيلي للطالب: {p.name}
            </h4>
            <span
              className={`text-[11px] font-black px-2 py-0.5 rounded-lg border ${getPercentageBadgeStyle(
                p.percentage
              )}`}
            >
              النسبة العامة: {toHindi(p.percentage)}٪
            </span>
          </div>

          {p.qualifiesForCertificate && onOpenCertificate ? (
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                onOpenCertificate(p.name, p.score, p.correctAnswers, p.totalAnswered, p.rank);
              }}
              className="report-hide-on-print px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 fill-current" />
              <span>طباعة الشهادة (اجتاز ٩٠٪)</span>
            </button>
          ) : (
            <span className="text-[11px] font-bold text-slate-400 print:text-slate-600 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>الشهادة لمن يجتاز ٩٠٪</span>
            </span>
          )}
        </div>

        {/* التشخيص الذكي للطالب */}
        <div className="p-2.5 rounded-xl bg-indigo-500/10 print:bg-indigo-50 border border-indigo-500/25 print:border-indigo-200 text-xs font-bold text-indigo-200 print:text-indigo-900 flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400 print:text-indigo-700 shrink-0" />
          <span>{p.smartNote}</span>
        </div>

        {/* نسب كل جدول للطالب */}
        {tableList.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-black text-slate-400 print:text-slate-700 block">
              تفصيل نسب الإتقان حسب كل جدول:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {tableList.map(({ table, stat }) => (
                <div
                  key={table}
                  className="bg-slate-900/90 print:bg-white border border-slate-800 print:border-slate-300 rounded-xl p-2 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-slate-200 print:text-slate-800">جدول {toHindi(table)}</span>
                    <span
                      className={`font-mono ${
                        stat.percentage > 90
                          ? 'text-emerald-400 print:text-emerald-700'
                          : stat.percentage >= 70
                          ? 'text-amber-300 print:text-amber-700'
                          : 'text-rose-400 print:text-rose-700'
                      }`}
                    >
                      {toHindi(stat.percentage)}٪
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 print:bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${getBarColorClass(stat.percentage)}`}
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 print:text-slate-600 font-mono">
                    <span>
                      {toHindi(stat.correct)} / {toHindi(stat.total)} صحيحة
                    </span>
                    <span>{toHindi(stat.avgTime.toFixed(1))}ث</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* مراجعة الأخطاء لتعزيز الفهم */}
        {p.mistakes.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-black text-rose-300 print:text-rose-700 block">
              مسائل تحتاج مراجعة ({toHindi(p.mistakes.length)}):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {p.mistakes.map((m, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 print:bg-rose-50 border border-rose-500/25 print:border-rose-300 text-[11px] font-mono font-bold flex items-center gap-1.5"
                >
                  <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                  <span className="text-white print:text-slate-900">{m.questionText}</span>
                  <span className="text-slate-400 print:text-slate-600">← الصحيح:</span>
                  <span className="text-emerald-400 print:text-emerald-700 font-black">
                    {toHindi(m.correctAnswer)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          p.totalAnswered > 0 && (
            <div className="text-[11px] font-black text-emerald-400 print:text-emerald-700 flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>أداء مثالي! أجاب عن جميع الأسئلة إجابات صحيحة دون أي أخطاء.</span>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div className="smart-report-printable w-full bg-slate-900/95 print:bg-white border border-slate-800 print:border-slate-300 rounded-3xl p-4 sm:p-6 shadow-2xl print:shadow-none space-y-5 text-right dir-rtl">
      {/* أنماط الطباعة المخصصة للتقرير فقط */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body[data-print-mode="report"] {
            background: #ffffff !important;
            color: #0f172a !important;
          }
          body[data-print-mode="report"] header,
          body[data-print-mode="report"] footer,
          body[data-print-mode="report"] .report-hide-on-print {
            display: none !important;
          }
          body[data-print-mode="report"] main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          body[data-print-mode="report"] .report-modal-backdrop {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            display: block !important;
          }
          body[data-print-mode="report"] .report-modal-dialog {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            max-width: 100% !important;
            max-height: none !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          body[data-print-mode="report"] .overflow-y-auto,
          body[data-print-mode="report"] .overflow-x-auto {
            overflow: visible !important;
            max-height: none !important;
          }
          body[data-print-mode="report"] .smart-report-printable {
            background: #ffffff !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            padding: 12px !important;
          }
        }
      `}</style>

      {/* ترويسة التقرير */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 print:border-slate-300">
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <RiyadhEbdaaLogo size="sm" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-400 print:text-amber-700 bg-amber-500/10 print:bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-500/25 print:border-amber-300 mb-1">
              <Brain className="w-3.5 h-3.5" />
              <span>التحليل الذكي وتقرير الأداء</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white print:text-slate-900 font-['El_Messiri',serif]">
              {title}
            </h3>
            <p className="text-[11px] text-slate-400 print:text-slate-600 font-bold">
              {subtitle ? `${subtitle} • ` : ''}
              العملية: {opModeLabel} • الجداول: {analysis.testedTables.map(t => toHindi(t)).join('، ')} • {reportDate}
            </p>
            <p className="text-[11px] text-amber-300/90 print:text-slate-700 font-bold mt-0.5">
              إشراف المعلم: أ/ أسامة إبراهيم الأبيدي • مدارس رياض الإبداع الأهلية
            </p>
          </div>
        </div>

        <div className="report-hide-on-print flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير التقرير إكسل</span>
          </button>
          <button
            type="button"
            onClick={handlePrintReport}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* مؤشرات الأداء الرئيسية (٤ بطاقات) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-950/80 print:bg-slate-50 border border-slate-800 print:border-slate-300 p-3 rounded-2xl">
          <div className="flex items-center justify-between text-[11px] text-slate-400 print:text-slate-600 font-bold mb-1">
            <span>النسبة العامة</span>
            <Target className="w-3.5 h-3.5 text-amber-400 print:text-amber-700" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400 print:text-slate-900">
            {toHindi(analysis.overallPercentage)}٪
          </div>
          <span className="text-[10px] text-slate-500 print:text-slate-600 font-bold">
            {toHindi(analysis.totalCorrect)} من {toHindi(analysis.totalQuestions)} إجابة
          </span>
        </div>

        <div className="bg-slate-950/80 print:bg-slate-50 border border-slate-800 print:border-slate-300 p-3 rounded-2xl">
          <div className="flex items-center justify-between text-[11px] text-slate-400 print:text-slate-600 font-bold mb-1">
            <span>مجتازو الشهادة (&gt;٩٠٪)</span>
            <Award className="w-3.5 h-3.5 text-emerald-400 print:text-emerald-700" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 print:text-emerald-700">
            {toHindi(analysis.qualifiedCount)} / {toHindi(analysis.participants.length)}
          </div>
          <span className="text-[10px] text-slate-500 print:text-slate-600 font-bold">
            بشرط تجاوز نسبة ٩٠٪
          </span>
        </div>

        <div className="bg-slate-950/80 print:bg-slate-50 border border-slate-800 print:border-slate-300 p-3 rounded-2xl">
          <div className="flex items-center justify-between text-[11px] text-slate-400 print:text-slate-600 font-bold mb-1">
            <span>متوسط سرعة السؤال</span>
            <Clock className="w-3.5 h-3.5 text-sky-400 print:text-sky-700" />
          </div>
          <div className="text-2xl font-black font-mono text-sky-400 print:text-slate-900">
            {toHindi(analysis.avgTimePerQuestion.toFixed(1))} ث
          </div>
          <span className="text-[10px] text-slate-500 print:text-slate-600 font-bold">
            معدل الاستجابة الذهنية
          </span>
        </div>

        <div className="bg-slate-950/80 print:bg-slate-50 border border-slate-800 print:border-slate-300 p-3 rounded-2xl">
          <div className="flex items-center justify-between text-[11px] text-slate-400 print:text-slate-600 font-bold mb-1">
            <span>أقوى جدول مختبَر</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400 print:text-indigo-700" />
          </div>
          <div className="text-xl font-black font-mono text-indigo-300 print:text-slate-900">
            {analysis.strongestTables[0]
              ? `جدول ${toHindi(analysis.strongestTables[0].table)}`
              : analysis.globalTableStats[0]
              ? `جدول ${toHindi(analysis.globalTableStats[0].table)}`
              : '—'}
          </div>
          <span className="text-[10px] text-slate-500 print:text-slate-600 font-bold">
            {analysis.strongestTables[0]
              ? `بنسبة ${toHindi(analysis.strongestTables[0].percentage)}٪`
              : 'حسب الأسئلة المنجزة'}
          </span>
        </div>
      </div>

      {/* نسبة الإتقان العامة حسب كل جدول */}
      {analysis.globalTableStats.length > 0 && (
        <div className="bg-slate-950/70 print:bg-white border border-slate-800 print:border-slate-300 rounded-2xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-black text-white print:text-slate-900 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-amber-400 print:text-amber-700" />
              <span>نسبة الإتقان لكل جدول (تحليل الجداول)</span>
            </h4>
            <span className="text-[10px] font-bold text-slate-400 print:text-slate-600">
              أخضر &gt; ٩٠٪ • أزرق ٧٥–٩٠٪ • أحمر &lt; ٦٠٪
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {analysis.globalTableStats.map(t => (
              <div
                key={t.table}
                className="bg-slate-900 print:bg-slate-50 border border-slate-800 print:border-slate-300 rounded-xl p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white print:text-slate-900">
                    جدول {toHindi(t.table)}
                  </span>
                  <span
                    className={`text-xs font-black font-mono px-1.5 py-0.2 rounded-md border ${getPercentageBadgeStyle(
                      t.percentage
                    )}`}
                  >
                    {toHindi(t.percentage)}٪
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 print:bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${getBarColorClass(t.percentage)}`}
                    style={{ width: `${t.percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 print:text-slate-600 font-mono">
                  <span>
                    {toHindi(t.correct)}/{toHindi(t.total)}
                  </span>
                  <span>{toHindi(t.avgTime.toFixed(1))}ث</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* التوصيات والاستنتاجات الذكية */}
      {analysis.smartInsights.length > 0 && (
        <div className="bg-gradient-to-l from-indigo-950/60 via-slate-950/90 to-slate-950/90 print:bg-indigo-50 border border-indigo-500/30 print:border-indigo-200 rounded-2xl p-3.5 sm:p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-indigo-300 print:text-indigo-900">
            <Sparkles className="w-4 h-4 text-amber-400 print:text-amber-600" />
            <span>الخلاصة والتوصيات التعليمية الذكية</span>
          </div>
          <ul className="space-y-1.5 text-xs font-bold text-slate-200 print:text-slate-800">
            {analysis.smartInsights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="text-amber-400 print:text-amber-700 mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* جدول التقرير المفصل: اسم الطالب + نسبة كل جدول + النسبة العامة + الشهادة لمن اجتاز ٩٠٪ */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs sm:text-sm font-black text-white print:text-slate-900">
            تقرير نتائج الطلاب التفصيلي (اضغط على اسم الطالب لعرض التفاصيل والأخطاء):
          </h4>
          <span className="text-[11px] font-bold text-amber-300 print:text-amber-800">
            تُمنح الشهادة لكل طالب اجتاز أكثر من ٩٠٪
          </span>
        </div>

        <div className="bg-slate-950/90 print:bg-white border border-slate-800 print:border-slate-300 rounded-2xl overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-900 print:bg-slate-100 border-b border-slate-800 print:border-slate-300 text-[11px] text-slate-300 print:text-slate-800 font-black">
              <tr>
                <th className="py-2.5 px-2.5 whitespace-nowrap">م</th>
                <th className="py-2.5 px-3 whitespace-nowrap">اسم الطالب</th>
                {analysis.testedTables.map(t => (
                  <th key={t} className="py-2.5 px-2 text-center whitespace-nowrap font-mono">
                    جـ {toHindi(t)}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-center whitespace-nowrap">النسبة العامة</th>
                <th className="py-2.5 px-2.5 text-center whitespace-nowrap">الدرجة / الزمن</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">الشهادة (&gt;٩٠٪)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 print:divide-slate-200 font-bold">
              {analysis.participants.map(p => {
                const isExpanded = expandedStudentId === p.id;
                return (
                  <React.Fragment key={p.id}>
                    <tr
                      onClick={() =>
                        setExpandedStudentId(prev => (prev === p.id ? null : p.id))
                      }
                      className={`cursor-pointer transition-colors hover:bg-slate-900/70 print:hover:bg-transparent ${
                        p.qualifiesForCertificate
                          ? 'bg-emerald-950/15 print:bg-emerald-50/40'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-2.5 font-mono text-amber-400 print:text-slate-800 whitespace-nowrap">
                        {p.rank === 1
                          ? '🥇'
                          : p.rank === 2
                          ? '🥈'
                          : p.rank === 3
                          ? '🥉'
                          : toHindi(p.rank)}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-white print:text-slate-900 font-black">
                          <span>{p.name}</span>
                          <span className="report-hide-on-print text-slate-500">
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </span>
                        </div>
                      </td>

                      {analysis.testedTables.map(t => {
                        const stat = p.tableStats[t];
                        return (
                          <td key={t} className="py-2.5 px-1.5 text-center font-mono whitespace-nowrap">
                            {stat && stat.total > 0 ? (
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded-md text-[11px] border ${getPercentageBadgeStyle(
                                  stat.percentage
                                )}`}
                                title={`${stat.correct} صحيحة من ${stat.total}`}
                              >
                                {toHindi(stat.percentage)}٪
                              </span>
                            ) : (
                              <span className="text-slate-600 print:text-slate-400">—</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black border ${getPercentageBadgeStyle(
                            p.percentage
                          )}`}
                        >
                          {toHindi(p.percentage)}٪
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 text-center font-mono text-slate-300 print:text-slate-700 whitespace-nowrap">
                        <span>
                          {toHindi(p.correctAnswers)}/{toHindi(p.totalAnswered)}
                        </span>
                        <span className="text-[10px] text-slate-400 print:text-slate-600 block">
                          ⏱ {toHindi(p.timeSpent.toFixed(1))}ث
                        </span>
                      </td>

                      <td
                        className="py-2.5 px-3 text-center whitespace-nowrap"
                        onClick={e => e.stopPropagation()}
                      >
                        {p.qualifiesForCertificate && onOpenCertificate ? (
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playTap();
                              onOpenCertificate(
                                p.name,
                                p.score,
                                p.correctAnswers,
                                p.totalAnswered,
                                p.rank
                              );
                            }}
                            className="report-hide-on-print inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-[11px] shadow-sm transition-transform hover:scale-105 cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5 fill-current" />
                            <span>إصدار الشهادة</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 print:text-slate-600 inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>{p.qualifiesForCertificate ? 'مؤهل' : 'أقل من ٩٠٪'}</span>
                          </span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-950/60 print:bg-slate-50">
                        <td
                          colSpan={analysis.testedTables.length + 5}
                          className="p-3"
                        >
                          {renderStudentDetailCard(p)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
