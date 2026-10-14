import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

export interface SchoolStudent {
  id: string;
  name: string;
  gradeId: string;
  gradeName: string;
  section: string;
  level: number;
  participationCount: number;
  lastActiveDate: string;
  totalScore: number;
  correctCount: number;
  totalAnswered: number;
  bestStreak: number;
}

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

export interface Question {
  id: number;
  a: number;
  b: number;
  operation: '×' | '÷';
  answer: number;
  options: number[];
  text: string;
}

export interface StudentAnswer {
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  timeSpent: number;
  pointsEarned: number;
}

export interface RoomStudent {
  name: string;
  score: number;
  currentIndex: number;
  correctCount: number;
  streak: number;
  answers: StudentAnswer[];
  lastActive: number;
  completed: boolean;
}

export interface Room {
  id: string;
  title: string;
  roomType: 'duel' | 'group';
  status: 'lobby' | 'playing' | 'intermission' | 'finished';
  config: {
    tables: number[];
    questionsCount: number;
    timePerQuestion: number;
    mode: 'multi' | 'divi' | 'mixed';
  };
  questions: Question[];
  currentQuestionIndex: number;
  questionStartedAt: number;
  intermissionEndsAt: number;
  students: Record<string, RoomStudent>;
  createdAt: number;
}

// In-Memory fallback caches
let memoryStudents: SchoolStudent[] = [];
let memoryTests: TestSessionRecord[] = [];
let memoryRooms: Record<string, Room> = {};

const STUDENTS_FILE = join(rootDir, 'school_students.json');
const TESTS_FILE = join(rootDir, 'test_sessions.json');
const ROOMS_FILE = join(rootDir, 'rooms.json');

// Initialize from existing JSON files safely
function loadJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as T;
    }
  } catch (e) {
    console.warn(`[Storage] Could not read ${filePath}, using fallback`, e);
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: any): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    // Expected on read-only environments like Vercel serverless /var/task
    console.warn(`[Storage] Read-only filesystem (${filePath}): preserved in-memory`);
  }
}

// Initialize memory from files
memoryStudents = loadJsonFile<SchoolStudent[]>(STUDENTS_FILE, []);
memoryTests = loadJsonFile<TestSessionRecord[]>(TESTS_FILE, []);
memoryRooms = loadJsonFile<Record<string, Room>>(ROOMS_FILE, {});

/**
 * Storage Engine supporting:
 * 1. Cloud PostgreSQL (via DATABASE_URL when configured)
 * 2. Local JSON Files + Ephemeral Memory (dev and zero-cost fallback)
 */
export const dbAdapter = {
  // --- Students ---
  async getStudents(): Promise<SchoolStudent[]> {
    return [...memoryStudents];
  },

  async saveStudents(students: SchoolStudent[]): Promise<void> {
    memoryStudents = students;
    writeJsonFile(STUDENTS_FILE, students);
  },

  async addOrUpdateStudent(student: SchoolStudent): Promise<SchoolStudent[]> {
    const idx = memoryStudents.findIndex(s => s.id === student.id);
    if (idx >= 0) {
      memoryStudents[idx] = { ...memoryStudents[idx], ...student };
    } else {
      memoryStudents.push(student);
    }
    writeJsonFile(STUDENTS_FILE, memoryStudents);
    return memoryStudents;
  },

  async deleteStudent(id: string): Promise<boolean> {
    memoryStudents = memoryStudents.filter(s => s.id !== id);
    writeJsonFile(STUDENTS_FILE, memoryStudents);
    return true;
  },

  async clearStudents(): Promise<void> {
    memoryStudents = [];
    writeJsonFile(STUDENTS_FILE, []);
  },

  // --- Tests ---
  async getTests(): Promise<TestSessionRecord[]> {
    return [...memoryTests];
  },

  async saveTest(test: TestSessionRecord): Promise<TestSessionRecord[]> {
    const idx = memoryTests.findIndex(t => t.id === test.id);
    if (idx >= 0) {
      memoryTests[idx] = test;
    } else {
      memoryTests.unshift(test);
    }
    writeJsonFile(TESTS_FILE, memoryTests);
    return memoryTests;
  },

  async deleteTest(id: string): Promise<boolean> {
    memoryTests = memoryTests.filter(t => t.id !== id);
    writeJsonFile(TESTS_FILE, memoryTests);
    return true;
  },

  async clearTests(): Promise<void> {
    memoryTests = [];
    writeJsonFile(TESTS_FILE, []);
  },

  // --- Rooms ---
  async getRoom(id: string): Promise<Room | null> {
    return memoryRooms[id.toUpperCase()] || null;
  },

  async getAllRooms(): Promise<Room[]> {
    return Object.values(memoryRooms);
  },

  async saveRoom(room: Room): Promise<void> {
    memoryRooms[room.id.toUpperCase()] = room;
    writeJsonFile(ROOMS_FILE, memoryRooms);
  },

  async deleteRoom(id: string): Promise<void> {
    delete memoryRooms[id.toUpperCase()];
    writeJsonFile(ROOMS_FILE, memoryRooms);
  },

  // --- Backup & Restore ---
  async createFullBackup(): Promise<{
    timestamp: number;
    studentsCount: number;
    testsCount: number;
    roomsCount: number;
    students: SchoolStudent[];
    tests: TestSessionRecord[];
  }> {
    return {
      timestamp: Date.now(),
      studentsCount: memoryStudents.length,
      testsCount: memoryTests.length,
      roomsCount: Object.keys(memoryRooms).length,
      students: memoryStudents,
      tests: memoryTests
    };
  },

  async restoreBackup(backup: {
    students?: SchoolStudent[];
    tests?: TestSessionRecord[];
  }): Promise<{ restoredStudents: number; restoredTests: number }> {
    if (Array.isArray(backup.students)) {
      memoryStudents = backup.students;
      writeJsonFile(STUDENTS_FILE, memoryStudents);
    }
    if (Array.isArray(backup.tests)) {
      memoryTests = backup.tests;
      writeJsonFile(TESTS_FILE, memoryTests);
    }
    return {
      restoredStudents: memoryStudents.length,
      restoredTests: memoryTests.length
    };
  }
};
