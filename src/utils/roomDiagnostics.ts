/**
 * أداة التشخيص المؤقتة والآمنة لمسار إنشاء وفتح والانضمام إلى الغرف
 * Temporary & Secure Diagnostic Tool for Room Creation, Retrieval & Joining
 */

export type DiagnosticStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface DiagnosticError {
  stage: DiagnosticStage;
  message: string;
  attemptId: string;
  technicalDetails?: string; // يتم تسجيله فقط في Console
}

/**
 * توليد معرّف فريد ومميز لكل محاولة لربط سجلات المتصفح بسجلات الخادم
 */
export function generateAttemptId(prefix: string = 'DIAG'): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

/**
 * صياغة رسالة واضحة للمستخدم تحتوي رقم المرحلة ومعرف المحاولة
 * بدون كشف أي أسرار أو رموز خاصة
 */
export function formatDiagnosticMessage(stage: DiagnosticStage, attemptId: string, customMessage?: string): string {
  const baseMessages: Record<DiagnosticStage, string> = {
    1: 'فشل الاتصال بالخادم (تأكد من اتصال الإنترنت أو استجابة الخادم)',
    2: 'فشل إنشاء الغرفة على الخادم',
    3: 'تم إنشاء الغرفة ولكن فشل حفظ بياناتها على الخادم',
    4: 'تم إنشاء الغرفة بنجاح ولكن تعذر استرجاع بياناتها للتحقق منها',
    5: 'لم يتم العثور على رمز الغرفة المطلوب',
    6: 'فشل الانضمام إلى الغرفة',
    7: 'حدث خطأ في قاعدة البيانات أثناء معالجة الغرفة',
    8: 'حدث خطأ غير معروف أثناء معالجة الغرفة'
  };

  const text = customMessage || baseMessages[stage] || baseMessages[8];
  return `[المرحلة ${stage}] ${text} (معرّف المحاولة: ${attemptId})`;
}
