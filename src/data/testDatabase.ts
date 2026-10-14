/**
 * Test Sessions Database & Analytics
 * Riyadh Al-Ebdaa Schools
 */

import { exportResultsToExcel } from '../utils/exportExcel';
import { toHindi } from '../utils/format';

export interface TestParticipant {
  id: string;
  name: string;
  score: number;
  correctAnswers: number;
  totalAnswered: number;
  percentage: number;
  rank: number;
  eliminated?: boolean;
}

export interface TestSessionRecord {
  id: string;
  createdAt: number;
  dateFormatted: string;
  title: string;
  gradeId: string;
  gradeName: string;
  section: string;
  tables: number[];
  opMode: 'multi' | 'divi' | 'mixed';
  timeLimit: number;
  roundsPerStudent: number;
  competitionType: 'points' | 'sudden_death';
  totalParticipants: number;
  averageAccuracy: number;
  topStudentName: string;
  topStudentScore: number;
  participants: TestParticipant[];
}

const STORAGE_KEY = 'riyadh_test_database_sessions';

export function loadSavedTestSessions(): TestSessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveTestSessions(sessions: TestSessionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
}

/**
 * Fetch all test sessions from server with local storage fallback
 */
export async function fetchTestSessionsFromServer(): Promise<TestSessionRecord[]> {
  try {
    const res = await fetch('/api/school/tests');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tests)) {
        saveTestSessions(data.tests);
        return data.tests;
      }
    }
  } catch {
    // fallback
  }
  return loadSavedTestSessions();
}

/**
 * Save new test session to server and local storage
 */
export async function recordTestSessionToDatabase(record: Omit<TestSessionRecord, 'id' | 'createdAt' | 'dateFormatted'> & { id?: string }): Promise<TestSessionRecord> {
  const now = Date.now();
  const dateStr = new Date(now).toLocaleDateString('ar-SA', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const fullRecord: TestSessionRecord = {
    id: record.id || `test-${now}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    dateFormatted: dateStr,
    ...record
  };

  // Update local storage
  const current = loadSavedTestSessions();
  const updated = [fullRecord, ...current.filter(t => t.id !== fullRecord.id)];
  saveTestSessions(updated);

  // Send to server
  try {
    await fetch('/api/school/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: fullRecord })
    });
  } catch {
    // ignore
  }

  return fullRecord;
}

/**
 * Delete a test session
 */
export async function deleteTestSessionFromDatabase(id: string): Promise<boolean> {
  const current = loadSavedTestSessions();
  const filtered = current.filter(t => t.id !== id);
  saveTestSessions(filtered);

  try {
    const res = await fetch(`/api/school/tests/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return true;
  }
}

/**
 * Clear test sessions
 */
export async function clearTestDatabase(): Promise<boolean> {
  saveTestSessions([]);
  try {
    const res = await fetch('/api/school/tests', { method: 'DELETE' });
    return res.ok;
  } catch {
    return true;
  }
}

/**
 * Export test database to Excel
 */
export function exportTestDatabaseToExcel(sessions?: TestSessionRecord[]): void {
  const list = sessions || loadSavedTestSessions();
  if (list.length === 0) return;

  const rows: any[] = [];
  list.forEach(test => {
    test.participants.forEach(p => {
      rows.push({
        'رقم الاختبار': test.id,
        'التاريخ والوقت': test.dateFormatted,
        'الصف': test.gradeName,
        'الفصل': test.section,
        'الجداول المختبرة': test.tables.map(t => toHindi(t)).join('، '),
        'نوع العملية': test.opMode === 'multi' ? 'ضرب (×)' : test.opMode === 'divi' ? 'قسمة (÷)' : 'مختلط (× و ÷)',
        'نظام التنافس': test.competitionType === 'sudden_death' ? 'خروج مغلوب' : 'نقاط تراكمية',
        'الترتيب': p.rank,
        'اسم الطالب': p.name,
        'الدرجة / النقاط': p.score,
        'الإجابات الصحيحة': p.correctAnswers,
        'إجمالي الأسئلة': p.totalAnswered,
        'نسبة الإتقان': `${p.percentage}%`,
        'الحالة': p.eliminated ? 'مستبعد' : p.percentage >= 80 ? 'متقن ومتميز' : 'مشارك'
      });
    });
  });

  exportResultsToExcel(rows, `قاعدة_بيانات_اختبارات_الرياضيات_${new Date().toISOString().slice(0, 10)}`);
}
