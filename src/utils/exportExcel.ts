/**
 * Export results to CSV formatted specifically for Microsoft Excel in Arabic
 * Includes UTF-8 BOM so Excel opens Arabic text cleanly without garbled characters
 */

export interface StudentResultRow {
  rank?: number;
  name: string;
  gradeName?: string;
  section?: string;
  score: number;
  correctAnswers: number;
  totalAnswered: number;
  percentage?: number;
  date?: string;
  status?: string;
}

export function exportResultsToExcel(rows: StudentResultRow[], filename: string = 'نتائج_مسابقة_جدول_الضرب') {
  if (!rows || rows.length === 0) return;

  const headers = [
    'الترتيب',
    'اسم الطالب',
    'الصف الدراسي',
    'الفصل',
    'الدرجة',
    'الإجابات الصحيحة',
    'إجمالي الأسئلة',
    'النسبة المئوية',
    'الحالة',
    'تاريخ المشاركة'
  ];

  const csvRows = [headers.join(',')];

  rows.forEach((r, idx) => {
    const rank = r.rank ?? (idx + 1);
    const pct = r.percentage ?? (r.totalAnswered > 0 ? Math.round((r.correctAnswers / r.totalAnswered) * 100) : 0);
    const date = r.date || new Date().toLocaleDateString('ar-SA');
    const status = r.status || (pct >= 80 ? 'متقن ومتميز' : pct >= 50 ? 'جيد' : 'يحتاج تدريب');

    const escapedName = `"${(r.name || '').replace(/"/g, '""')}"`;
    const escapedGrade = `"${(r.gradeName || 'الصف المحدد').replace(/"/g, '""')}"`;
    const escapedSection = `"${(r.section || 'أ').replace(/"/g, '""')}"`;

    csvRows.push([
      rank,
      escapedName,
      escapedGrade,
      escapedSection,
      r.score,
      r.correctAnswers,
      r.totalAnswered,
      `"${pct}%"`,
      `"${status}"`,
      `"${date}"`
    ].join(','));
  });

  // UTF-8 BOM
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
