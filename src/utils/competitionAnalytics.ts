/**
 * محرك التحليل الذكي لنهاية المسابقات والاختبارات
 * يحسب نسب الإتقان لكل جدول ولكل طالب، ويولد توصيات تعليمية ذكية وتقارير إكسل
 */

import { toHindi } from './format';

export interface QuestionAttemptLog {
  table: number;
  operation: '×' | '÷';
  questionText: string;
  correctAnswer: number;
  selectedOption: number | null;
  isCorrect: boolean;
  timeSpent: number;
}

export interface RawParticipantAnalyticsInput {
  id: string;
  name: string;
  score: number;
  correctAnswers: number;
  totalAnswered: number;
  totalTimeSpent?: number;
  eliminated?: boolean;
  questionLogs?: QuestionAttemptLog[];
}

export interface TableStat {
  table: number;
  total: number;
  correct: number;
  percentage: number;
  avgTime: number;
}

export interface AnalyzedParticipant {
  id: string;
  name: string;
  rank: number;
  score: number;
  correctAnswers: number;
  totalAnswered: number;
  exactPercentage: number;
  percentage: number;
  timeSpent: number;
  avgTimePerQuestion: number;
  qualifiesForCertificate: boolean;
  eliminated?: boolean;
  tableStats: Record<number, TableStat>;
  strongTables: number[];
  needsReviewTables: number[];
  mistakes: QuestionAttemptLog[];
  smartNote: string;
}

export interface CompetitionSmartAnalysis {
  participants: AnalyzedParticipant[];
  testedTables: number[];
  globalTableStats: TableStat[];
  overallPercentage: number;
  totalQuestions: number;
  totalCorrect: number;
  avgTimePerQuestion: number;
  qualifiedCount: number;
  strongestTables: TableStat[];
  weakestTables: TableStat[];
  multiAccuracy: number | null;
  diviAccuracy: number | null;
  smartInsights: string[];
}

export function buildParticipantSmartNote(
  exactPct: number,
  avgTime: number,
  strongTables: number[],
  needsReviewTables: number[],
  totalAnswered: number
): string {
  if (totalAnswered === 0) return 'لم يكمل أسئلة كافية للتقييم';

  if (exactPct > 90) {
    if (avgTime <= 4) {
      return 'أداء استثنائي وسرعة بديهة عالية جداً — متقن ومؤهل للشهادة 🏆';
    }
    return 'إتقان متميز وتفوق واضح — مؤهل لشهادة التفوق 🌟';
  }

  if (exactPct >= 75) {
    if (needsReviewTables.length > 0) {
      return `مستوى جيد جداً، ويُنصح بمراجعة سريعة لجدول (${needsReviewTables.map(t => toHindi(t)).join('، ')})`;
    }
    return 'أداء مستقر وجيد جداً، يحتاج تدريب سرعة إضافي للوصول فوق ٩٠٪';
  }

  if (needsReviewTables.length > 0) {
    return `يحتاج خطة تقوية مركزة في جداول: (${needsReviewTables.map(t => toHindi(t)).join('، ')})`;
  }

  if (strongTables.length > 0) {
    return `أجاد في جدول (${strongTables.map(t => toHindi(t)).join('، ')}) ويحتاج ممارسة متدرجة لبقية الجداول`;
  }

  return 'يحتاج مراجعة تأسيسية وتدريب فردي هادئ بدون ضغط الوقت';
}

export function analyzeCompetitionResults(
  rawParticipants: RawParticipantAnalyticsInput[],
  configuredTables: number[],
  opMode: 'multi' | 'divi' | 'mixed'
): CompetitionSmartAnalysis {
  // Collect all tables appearing either in configuredTables or logs
  const tableSet = new Set<number>(configuredTables);
  rawParticipants.forEach(p => {
    (p.questionLogs || []).forEach(log => {
      if (log.table) tableSet.add(log.table);
    });
  });
  const testedTables = Array.from(tableSet).sort((a, b) => a - b);

  // Global accumulators
  const globalTableMap = new Map<number, { total: number; correct: number; timeSum: number }>();
  testedTables.forEach(t => globalTableMap.set(t, { total: 0, correct: 0, timeSum: 0 }));

  let multiTotal = 0;
  let multiCorrect = 0;
  let diviTotal = 0;
  let diviCorrect = 0;
  let totalQuestions = 0;
  let totalCorrect = 0;
  let totalTimeAll = 0;

  const analyzedParticipants: AnalyzedParticipant[] = rawParticipants.map((p, idx) => {
    const logs = p.questionLogs || [];
    const perTableRaw = new Map<number, { total: number; correct: number; timeSum: number }>();

    logs.forEach(log => {
      const t = log.table;
      if (!perTableRaw.has(t)) perTableRaw.set(t, { total: 0, correct: 0, timeSum: 0 });
      const entry = perTableRaw.get(t)!;
      entry.total += 1;
      if (log.isCorrect) entry.correct += 1;
      entry.timeSum += log.timeSpent || 0;

      if (!globalTableMap.has(t)) globalTableMap.set(t, { total: 0, correct: 0, timeSum: 0 });
      const gEntry = globalTableMap.get(t)!;
      gEntry.total += 1;
      if (log.isCorrect) gEntry.correct += 1;
      gEntry.timeSum += log.timeSpent || 0;

      if (log.operation === '×') {
        multiTotal += 1;
        if (log.isCorrect) multiCorrect += 1;
      } else if (log.operation === '÷') {
        diviTotal += 1;
        if (log.isCorrect) diviCorrect += 1;
      }
    });

    const tableStats: Record<number, TableStat> = {};
    const strongTables: number[] = [];
    const needsReviewTables: number[] = [];

    perTableRaw.forEach((val, tableNum) => {
      const pct = val.total > 0 ? Math.round((val.correct / val.total) * 100) : 0;
      tableStats[tableNum] = {
        table: tableNum,
        total: val.total,
        correct: val.correct,
        percentage: pct,
        avgTime: val.total > 0 ? Number((val.timeSum / val.total).toFixed(1)) : 0
      };
      if (pct >= 90) strongTables.push(tableNum);
      else if (pct < 70) needsReviewTables.push(tableNum);
    });

    strongTables.sort((a, b) => a - b);
    needsReviewTables.sort((a, b) => a - b);

    const exactPercentage = p.totalAnswered > 0 ? (p.correctAnswers / p.totalAnswered) * 100 : 0;
    const percentage = Math.round(exactPercentage);
    const timeSpent = Number((p.totalTimeSpent || 0).toFixed(1));
    const avgTimePerQuestion = p.totalAnswered > 0 ? Number((timeSpent / p.totalAnswered).toFixed(1)) : 0;
    const qualifiesForCertificate = exactPercentage > 90;

    totalQuestions += p.totalAnswered;
    totalCorrect += p.correctAnswers;
    totalTimeAll += timeSpent;

    return {
      id: p.id,
      name: p.name,
      rank: idx + 1,
      score: p.score,
      correctAnswers: p.correctAnswers,
      totalAnswered: p.totalAnswered,
      exactPercentage,
      percentage,
      timeSpent,
      avgTimePerQuestion,
      qualifiesForCertificate,
      eliminated: p.eliminated,
      tableStats,
      strongTables,
      needsReviewTables,
      mistakes: logs.filter(l => !l.isCorrect),
      smartNote: buildParticipantSmartNote(
        exactPercentage,
        avgTimePerQuestion,
        strongTables,
        needsReviewTables,
        p.totalAnswered
      )
    };
  });

  const globalTableStats: TableStat[] = Array.from(globalTableMap.entries())
    .filter(([, val]) => val.total > 0)
    .map(([table, val]) => ({
      table,
      total: val.total,
      correct: val.correct,
      percentage: Math.round((val.correct / val.total) * 100),
      avgTime: Number((val.timeSum / val.total).toFixed(1))
    }))
    .sort((a, b) => a.table - b.table);

  const sortedByPerf = [...globalTableStats].sort((a, b) => b.percentage - a.percentage);
  const strongestTables = sortedByPerf.filter(t => t.percentage >= 85).slice(0, 3);
  const weakestTables = [...globalTableStats]
    .filter(t => t.percentage < 80)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 3);

  const overallPercentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const avgTimePerQuestion = totalQuestions > 0 ? Number((totalTimeAll / totalQuestions).toFixed(1)) : 0;
  const qualifiedCount = analyzedParticipants.filter(p => p.qualifiesForCertificate).length;

  const multiAccuracy = multiTotal > 0 ? Math.round((multiCorrect / multiTotal) * 100) : null;
  const diviAccuracy = diviTotal > 0 ? Math.round((diviCorrect / diviTotal) * 100) : null;

  // Generate smart diagnostic Arabic insights
  const smartInsights: string[] = [];

  if (analyzedParticipants.length === 1) {
    const solo = analyzedParticipants[0];
    if (solo.exactPercentage > 90) {
      smartInsights.push(
        `حقق الطالب ${solo.name} نسبة عامة ممتازة بلغت ${toHindi(solo.percentage)}٪، وبذلك استحق شهادة التفوق بجدارة.`
      );
    } else {
      smartInsights.push(
        `بلغت النسبة العامة للطالب ${solo.name} ${toHindi(solo.percentage)}٪ (يشترط للحصول على الشهادة تجاوز ٩٠٪).`
      );
    }
  } else {
    smartInsights.push(
      `بلغ متوسط الإتقان العام للفصل ${toHindi(overallPercentage)}٪، واجتاز حاجز ٩٠٪ للحصول على الشهادة ${toHindi(qualifiedCount)} من أصل ${toHindi(analyzedParticipants.length)} طلاب.`
    );
  }

  if (strongestTables.length > 0) {
    smartInsights.push(
      `أعلى الجداول إتقاناً: ${strongestTables.map(t => `جدول ${toHindi(t.table)} (${toHindi(t.percentage)}٪)`).join('، ')}.`
    );
  }

  if (weakestTables.length > 0) {
    smartInsights.push(
      `أبرز الجداول التي تحتاج مراجعة وتدريباً إضافياً: ${weakestTables.map(t => `جدول ${toHindi(t.table)} (${toHindi(t.percentage)}٪)`).join('، ')}.`
    );
  } else if (globalTableStats.length > 0) {
    smartInsights.push('جميع الجداول المختبرة حققت نسبة إتقان مرتفعة (٨٠٪ فأكثر) دون وجود تعثر ملحوظ.');
  }

  if (opMode === 'mixed' && multiAccuracy !== null && diviAccuracy !== null) {
    const diff = Math.abs(multiAccuracy - diviAccuracy);
    if (diff >= 10) {
      if (multiAccuracy > diviAccuracy) {
        smartInsights.push(
          `نسبة الإتقان في الضرب (${toHindi(multiAccuracy)}٪) أعلى من القسمة (${toHindi(diviAccuracy)}٪)؛ يُنصح بربط حقائق القسمة بالضرب العكسي.`
        );
      } else {
        smartInsights.push(
          `نسبة الإتقان في القسمة (${toHindi(diviAccuracy)}٪) تفوقت على الضرب (${toHindi(multiAccuracy)}٪).`
        );
      }
    } else {
      smartInsights.push(
        `توازن ممتاز بين عمليتي الضرب (${toHindi(multiAccuracy)}٪) والقسمة (${toHindi(diviAccuracy)}٪).`
      );
    }
  }

  if (avgTimePerQuestion > 0) {
    if (avgTimePerQuestion <= 3.5 && overallPercentage < 80) {
      smartInsights.push(
        `متوسط سرعة الإجابة (${toHindi(avgTimePerQuestion.toFixed(1))} ث) سريع نسبياً مع وجود أخطاء، مما يدل على التسرع؛ شجّع على التروي نصف ثانية قبل الضغط.`
      );
    } else if (avgTimePerQuestion <= 4.5 && overallPercentage >= 85) {
      smartInsights.push(
        `سرعة استحضار ذهنية ممتازة بمتوسط ${toHindi(avgTimePerQuestion.toFixed(1))} ثانية لكل سؤال.`
      );
    }
  }

  return {
    participants: analyzedParticipants,
    testedTables,
    globalTableStats,
    overallPercentage,
    totalQuestions,
    totalCorrect,
    avgTimePerQuestion,
    qualifiedCount,
    strongestTables,
    weakestTables,
    multiAccuracy,
    diviAccuracy,
    smartInsights
  };
}

/**
 * تصدير التقرير التحليلي الذكي متضمناً نسبة كل جدول والنسبة العامة لكل طالب إلى إكسل
 */
export function exportSmartAnalysisToExcel(
  analysis: CompetitionSmartAnalysis,
  title: string = 'التقرير_التحليلي_الذكي'
): void {
  if (!analysis || analysis.participants.length === 0) return;

  const tableHeaders = analysis.testedTables.map(t => `جدول ${t} (%)`);
  const headers = [
    'الترتيب',
    'اسم الطالب',
    'النسبة العامة (%)',
    'الدرجة',
    'الإجابات الصحيحة',
    'إجمالي الأسئلة',
    'متوسط الزمن (ث)',
    ...tableHeaders,
    'استحقاق الشهادة (>٩٠٪)',
    'التحليل والتوصية الذكية'
  ];

  const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;

  const rows: string[] = [headers.map(escapeCsv).join(',')];

  analysis.participants.forEach(p => {
    const perTableCells = analysis.testedTables.map(t => {
      const stat = p.tableStats[t];
      return stat ? `${stat.percentage}% (${stat.correct}/${stat.total})` : '—';
    });

    const row = [
      p.rank,
      p.name,
      `${p.percentage}%`,
      p.score,
      p.correctAnswers,
      p.totalAnswered,
      p.avgTimePerQuestion.toFixed(1),
      ...perTableCells,
      p.qualifiesForCertificate ? 'مستحق للشهادة (>٩٠٪)' : 'غير مستحق (٩٠٪ أو أقل)',
      p.smartNote
    ];

    rows.push(row.map(escapeCsv).join(','));
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${title}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
