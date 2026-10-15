/**
 * School Student Data Models & Synchronization Utilities
 * Riyadh Al-Ebdaa Schools
 */

export interface SchoolStudent {
  id: string;
  name: string;
  gradeId: string; // grade3, grade4, grade5, grade6
  gradeName: string;
  section: string; // أ، ب، ج، د
  level: number; // 1 to 5
  participationCount: number;
  lastActiveDate: string; // e.g. 'اليوم', 'أمس', 'منذ يومين', 'لم يشارك'
  totalScore: number;
  correctCount: number;
  totalAnswered: number;
  bestStreak: number;
}

export interface GradeInfo {
  id: string;
  name: string;
  shortName: string;
  sections: string[];
}

export const SCHOOL_GRADES: GradeInfo[] = [
  { id: 'grade3', name: 'الصف الثالث الابتدائي', shortName: 'الثالث', sections: ['أ', 'ب', 'ج', 'د'] },
  { id: 'grade4', name: 'الصف الرابع الابتدائي', shortName: 'الرابع', sections: ['أ', 'ب', 'ج', 'د'] },
  { id: 'grade5', name: 'الصف الخامس الابتدائي', shortName: 'الخامس', sections: ['أ', 'ب', 'ج', 'د'] },
  { id: 'grade6', name: 'الصف السادس الابتدائي', shortName: 'السادس', sections: ['أ', 'ب', 'ج', 'د'] },
];

const STORAGE_KEY = 'riyadh_al_ebdaa_students_list';

// Empty default list - as requested by user to upload real school names
export const INITIAL_SCHOOL_STUDENTS: SchoolStudent[] = [];

export function loadSavedStudents(): SchoolStudent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return INITIAL_SCHOOL_STUDENTS;
}

export function saveStudentsList(students: SchoolStudent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
  } catch {
    // ignore
  }
}

import { getAdminAuthHeaders } from '../utils/auth';

/**
 * Fetch students from server with local storage fallback
 */
export async function fetchSchoolStudentsFromServer(): Promise<SchoolStudent[]> {
  try {
    const res = await fetch('/api/school/students');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.students)) {
        saveStudentsList(data.students);
        return data.students;
      }
    }
  } catch {
    // fallback to local storage
  }
  return loadSavedStudents();
}

/**
 * Sync students list to server (Requires Admin Auth)
 */
export async function syncStudentsListToServer(students: SchoolStudent[]): Promise<boolean> {
  saveStudentsList(students);
  try {
    const res = await fetch('/api/school/students/batch', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: JSON.stringify({ students, mode: 'replace' })
    });
    return res.ok;
  } catch {
    return false;
  }
}

const RECORDED_ROUNDS_KEY = 'riyadh_client_recorded_rounds';

function getClientRecordedRounds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(RECORDED_ROUNDS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
}

function addClientRecordedRound(id: string) {
  if (typeof window === 'undefined' || !id) return;
  try {
    const s = getClientRecordedRounds();
    s.add(id);
    localStorage.setItem(RECORDED_ROUNDS_KEY, JSON.stringify([...s]));
  } catch {
    // ignore
  }
}

/**
 * Record a game participation to server and local storage with idempotency roundId
 */
export async function recordGameParticipation(
  results: Array<{
    name: string;
    score: number;
    correctCount: number;
    totalAnswered: number;
    streak?: number;
  }>,
  roundId?: string
): Promise<void> {
  if (!Array.isArray(results) || results.length === 0) return;

  const finalRoundId = (roundId || `direct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`).trim();
  const recorded = getClientRecordedRounds();
  if (recorded.has(finalRoundId)) {
    // Already recorded locally, skip to avoid double addition
    return;
  }
  addClientRecordedRound(finalRoundId);

  // Update local storage first
  const current = loadSavedStudents();
  let updated = false;

  const now = 'اليوم';
  const updatedList = current.map(st => {
    const res = results.find(r => r.name.trim() === st.name.trim());
    if (res) {
      updated = true;
      const newScore = (st.totalScore || 0) + res.score;
      const newCorrect = (st.correctCount || 0) + res.correctCount;
      const newTotal = (st.totalAnswered || 0) + res.totalAnswered;
      const newParticipation = (st.participationCount || 0) + 1;
      const newStreak = Math.max(st.bestStreak || 0, res.streak || 0);

      // Calculate level: 1 (0-100), 2 (101-300), 3 (301-600), 4 (601-1000), 5 (>1000)
      let newLevel = 1;
      if (newScore > 1000) newLevel = 5;
      else if (newScore > 600) newLevel = 4;
      else if (newScore > 300) newLevel = 3;
      else if (newScore > 100) newLevel = 2;

      return {
        ...st,
        totalScore: newScore,
        correctCount: newCorrect,
        totalAnswered: newTotal,
        participationCount: newParticipation,
        bestStreak: newStreak,
        level: newLevel,
        lastActiveDate: now
      };
    }
    return st;
  });

  if (updated) {
    saveStudentsList(updatedList);
  }

  // Also push to server with roundId
  try {
    await fetch('/api/school/record-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, roundId: finalRoundId })
    });
  } catch {
    // ignore
  }
}


export function parsePastedStudentNames(
  rawText: string,
  gradeId: string,
  section: string
): SchoolStudent[] {
  const gradeInfo = SCHOOL_GRADES.find(g => g.id === gradeId);
  const gradeName = gradeInfo?.name || 'الصف المحدد';

  const lines = rawText
    .split(/[\r\n,]+/)
    .map(line => line.trim())
    .filter(line => line.length > 1);

  return lines.map((name, idx) => ({
    id: `student-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    gradeId,
    gradeName,
    section: section === 'all' ? 'أ' : section,
    level: 1,
    participationCount: 0,
    lastActiveDate: 'لم يشارك',
    totalScore: 0,
    correctCount: 0,
    totalAnswered: 0,
    bestStreak: 0
  }));
}
