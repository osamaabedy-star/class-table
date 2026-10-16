/**
 * Hybrid Database Storage Adapter
 * Riyadh Al-Ebdaa Schools - Platform Storage Layer
 * 
 * Supports:
 * 1. Supabase / PostgreSQL (Production persistent cloud database)
 * 2. Local JSON Files + In-Memory Fallback (Local development & serverless fallback when DB env vars are absent)
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

// ==============================================================================
// Data Models & Interfaces
// ==============================================================================

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
  createdAt?: string;
  updatedAt?: string;
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
  hostToken?: string;
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
  resultsRecorded?: boolean;
}

// ==============================================================================
// JSON File & In-Memory Fallback State
// ==============================================================================

const STUDENTS_FILE = process.env.VERCEL ? '/tmp/riyadh_school_students.json' : join(rootDir, 'school_students.json');
const TESTS_FILE = process.env.VERCEL ? '/tmp/riyadh_test_sessions.json' : join(rootDir, 'test_sessions.json');
const ROOMS_FILE = process.env.VERCEL ? '/tmp/riyadh_rooms.json' : join(rootDir, 'rooms.json');
const RECORDED_GAMES_FILE = process.env.VERCEL ? '/tmp/riyadh_recorded_games.json' : join(rootDir, 'recorded_games.json');

function loadJsonFile<T>(filePath: string, fallbackPath: string | null, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed) return parsed;
    } else if (fallbackPath && fs.existsSync(fallbackPath)) {
      const data = fs.readFileSync(fallbackPath, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed) return parsed;
    }
  } catch (e) {
    console.warn(`[Storage Fallback] Could not read ${filePath}:`, e);
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: any): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    // In serverless / read-only contexts, in-memory state remains intact
  }
}

// In-Memory cache
let memoryStudents: SchoolStudent[] = loadJsonFile<SchoolStudent[]>(
  STUDENTS_FILE, 
  join(rootDir, 'school_students.json'), 
  []
);
let memoryTests: TestSessionRecord[] = loadJsonFile<TestSessionRecord[]>(
  TESTS_FILE, 
  join(rootDir, 'test_sessions.json'), 
  []
);
let memoryRooms: Record<string, Room> = loadJsonFile<Record<string, Room>>(
  ROOMS_FILE, 
  join(rootDir, 'rooms.json'), 
  {}
);
let memoryRecordedGames: Set<string> = new Set(
  loadJsonFile<string[]>(
    RECORDED_GAMES_FILE, 
    join(rootDir, 'recorded_games.json'), 
    []
  )
);

// ==============================================================================
// PostgreSQL / Supabase Connection Pool
// ==============================================================================

let pgPool: pg.Pool | null = null;
let isPostgresInitialized = false;
let initPromise: Promise<boolean> | null = null;

function getPostgresConnectionString(): string | null {
  const url = process.env.DATABASE_URL || 
              process.env.POSTGRES_URL || 
              process.env.SUPABASE_DB_URL || 
              process.env.POSTGRES_PRISMA_URL || 
              process.env.POSTGRES_URL_NON_POOLING;
  if (url && url.trim().length > 0) {
    return url.trim();
  }

  // Also support individual PG environment variables
  if (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER) {
    const user = encodeURIComponent(process.env.PGUSER);
    const pass = process.env.PGPASSWORD ? `:${encodeURIComponent(process.env.PGPASSWORD)}` : '';
    const host = process.env.PGHOST;
    const port = process.env.PGPORT || '5432';
    const db = process.env.PGDATABASE;
    return `postgres://${user}${pass}@${host}:${port}/${db}`;
  }

  return null;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getPostgresConnectionString());
}

function getPool(): pg.Pool | null {
  if (pgPool) return pgPool;

  const connectionString = getPostgresConnectionString();
  if (!connectionString) return null;

  try {
    const isLocal = connectionString.includes('localhost') || 
                    connectionString.includes('127.0.0.1') || 
                    connectionString.includes('/tmp');

    pgPool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pgPool.on('error', (err) => {
      console.error('[Postgres Pool Error]:', err.message);
    });

    return pgPool;
  } catch (e) {
    console.error('[Postgres Init Error]:', e);
    return null;
  }
}

/**
 * Initializes the schema tables in PostgreSQL idempotently (IF NOT EXISTS)
 * and migrates existing JSON files if PostgreSQL is currently empty.
 */
async function ensurePostgresSchema(): Promise<boolean> {
  if (isPostgresInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const pool = getPool();
    if (!pool) return false;

    try {
      // Test connection
      const client = await pool.connect();
      try {
        // Create core tables if not already existing
        await client.query(`
          CREATE TABLE IF NOT EXISTS grades (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            short_name VARCHAR(50) NOT NULL,
            display_order INT DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS sections (
            id SERIAL PRIMARY KEY,
            grade_id VARCHAR(50) NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
            name VARCHAR(20) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_grade_section UNIQUE(grade_id, name)
          );

          CREATE TABLE IF NOT EXISTS students (
            id VARCHAR(100) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            grade_id VARCHAR(50) NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
            grade_name VARCHAR(100) NOT NULL,
            section VARCHAR(20) NOT NULL DEFAULT 'أ',
            level INT NOT NULL DEFAULT 1,
            participation_count INT NOT NULL DEFAULT 0,
            total_score INT NOT NULL DEFAULT 0,
            correct_count INT NOT NULL DEFAULT 0,
            total_answered INT NOT NULL DEFAULT 0,
            best_streak INT NOT NULL DEFAULT 0,
            last_active_date VARCHAR(50) DEFAULT 'لم يشارك',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_student_identity UNIQUE (name, grade_id, section)
          );

          CREATE TABLE IF NOT EXISTS recorded_game_rounds (
            round_id VARCHAR(120) PRIMARY KEY,
            room_id VARCHAR(50),
            source VARCHAR(50) DEFAULT 'room',
            recorded_at TIMESTAMPTZ DEFAULT NOW(),
            participants_count INT DEFAULT 0,
            results_json JSONB DEFAULT '[]'::jsonb
          );

          CREATE TABLE IF NOT EXISTS rooms (
            id VARCHAR(20) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            room_type VARCHAR(50) NOT NULL DEFAULT 'duel',
            status VARCHAR(50) NOT NULL DEFAULT 'lobby',
            host_token VARCHAR(100),
            config JSONB NOT NULL DEFAULT '{}'::jsonb,
            questions JSONB NOT NULL DEFAULT '[]'::jsonb,
            students JSONB NOT NULL DEFAULT '{}'::jsonb,
            current_question_index INT NOT NULL DEFAULT 0,
            question_started_at BIGINT DEFAULT 0,
            intermission_ends_at BIGINT DEFAULT 0,
            results_recorded BOOLEAN NOT NULL DEFAULT FALSE,
            created_at BIGINT NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          ALTER TABLE rooms ADD COLUMN IF NOT EXISTS students JSONB NOT NULL DEFAULT '{}'::jsonb;

          CREATE TABLE IF NOT EXISTS test_sessions (
            id VARCHAR(120) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            grade_id VARCHAR(50) NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
            grade_name VARCHAR(100) NOT NULL,
            section VARCHAR(50) NOT NULL,
            tables JSONB NOT NULL DEFAULT '[]'::jsonb,
            op_mode VARCHAR(20) NOT NULL DEFAULT 'multi',
            time_limit INT NOT NULL DEFAULT 10,
            rounds_per_student INT NOT NULL DEFAULT 2,
            competition_type VARCHAR(50) NOT NULL DEFAULT 'points',
            total_participants INT NOT NULL DEFAULT 0,
            average_accuracy NUMERIC(5,2) DEFAULT 0,
            top_student_name VARCHAR(150),
            top_student_score INT DEFAULT 0,
            date_formatted VARCHAR(100),
            created_at BIGINT NOT NULL,
            created_at_dt TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS test_session_participants (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(120) NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
            student_id VARCHAR(100) REFERENCES students(id) ON DELETE SET NULL,
            name VARCHAR(150) NOT NULL,
            score INT NOT NULL DEFAULT 0,
            correct_answers INT NOT NULL DEFAULT 0,
            total_answered INT NOT NULL DEFAULT 0,
            percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
            rank INT NOT NULL DEFAULT 0,
            eliminated BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_session_participant UNIQUE (session_id, name)
          );

          INSERT INTO grades (id, name, short_name, display_order) VALUES
            ('grade3', 'الصف الثالث الابتدائي', 'الثالث', 3),
            ('grade4', 'الصف الرابع الابتدائي', 'الرابع', 4),
            ('grade5', 'الصف الخامس الابتدائي', 'الخامس', 5),
            ('grade6', 'الصف السادس الابتدائي', 'السادس', 6)
          ON CONFLICT (id) DO NOTHING;
        `);

        // Check if students table is empty; if so, migrate local JSON data
        const countRes = await client.query('SELECT COUNT(*) AS count FROM students');
        const dbStudentsCount = parseInt(countRes.rows[0]?.count || '0', 10);
        if (dbStudentsCount === 0 && memoryStudents.length > 0) {
          console.log(`[Database Migration] Migrating ${memoryStudents.length} students from JSON to PostgreSQL...`);
          for (const s of memoryStudents) {
            await client.query(`
              INSERT INTO students (
                id, name, grade_id, grade_name, section, level, 
                participation_count, total_score, correct_count, 
                total_answered, best_streak, last_active_date
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (name, grade_id, section) DO UPDATE SET
                total_score = EXCLUDED.total_score,
                correct_count = EXCLUDED.correct_count,
                total_answered = EXCLUDED.total_answered,
                participation_count = EXCLUDED.participation_count,
                best_streak = EXCLUDED.best_streak,
                level = EXCLUDED.level,
                last_active_date = EXCLUDED.last_active_date;
            `, [
              s.id, s.name, s.gradeId, s.gradeName, s.section, s.level || 1,
              s.participationCount || 0, s.totalScore || 0, s.correctCount || 0,
              s.totalAnswered || 0, s.bestStreak || 0, s.lastActiveDate || 'لم يشارك'
            ]);
          }
        }

        // Migrate test sessions if tests table is empty
        const testCountRes = await client.query('SELECT COUNT(*) AS count FROM test_sessions');
        const dbTestsCount = parseInt(testCountRes.rows[0]?.count || '0', 10);
        if (dbTestsCount === 0 && memoryTests.length > 0) {
          console.log(`[Database Migration] Migrating ${memoryTests.length} test sessions from JSON to PostgreSQL...`);
          for (const t of memoryTests) {
            await client.query(`
              INSERT INTO test_sessions (
                id, title, grade_id, grade_name, section, tables,
                op_mode, time_limit, rounds_per_student, competition_type,
                total_participants, average_accuracy, top_student_name,
                top_student_score, date_formatted, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
              ON CONFLICT (id) DO NOTHING;
            `, [
              t.id, t.title, t.gradeId, t.gradeName, t.section, JSON.stringify(t.tables || []),
              t.opMode, t.timeLimit, t.roundsPerStudent, t.competitionType,
              t.totalParticipants, t.averageAccuracy, t.topStudentName,
              t.topStudentScore, t.dateFormatted, t.createdAt
            ]);

            if (Array.isArray(t.participants)) {
              for (const p of t.participants) {
                await client.query(`
                  INSERT INTO test_session_participants (
                    session_id, student_id, name, score, correct_answers,
                    total_answered, percentage, rank, eliminated
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                  ON CONFLICT (session_id, name) DO NOTHING;
                `, [
                  t.id, p.id || null, p.name, p.score, p.correctAnswers,
                  p.totalAnswered, p.percentage, p.rank, Boolean(p.eliminated)
                ]);
              }
            }
          }
        }

        // Migrate recorded game IDs
        for (const rId of memoryRecordedGames) {
          await client.query(`
            INSERT INTO recorded_game_rounds (round_id, source)
            VALUES ($1, 'migrated_json')
            ON CONFLICT (round_id) DO NOTHING;
          `, [rId]);
        }

        isPostgresInitialized = true;
        console.log('[Storage Engine] Successfully connected to PostgreSQL / Supabase.');
        return true;
      } finally {
        client.release();
      }
    } catch (e: any) {
      console.warn('[Postgres Unavailable]: Falling back to local JSON / in-memory storage.', e.message);
      return false;
    }
  })();

  return initPromise;
}

// ==============================================================================
// Unified Storage Adapter API
// ==============================================================================

export const dbAdapter = {
  /**
   * Status and metadata check for storage engine
   */
  async getStorageStatus(): Promise<{
    type: 'postgresql' | 'json-memory';
    connected: boolean;
    configured: boolean;
    studentsCount: number;
    testsCount: number;
    roomsCount: number;
    connectionHost?: string;
  }> {
    const configured = isDatabaseConfigured();
    if (configured) {
      const ok = await ensurePostgresSchema();
      if (ok && pgPool) {
        try {
          const sRes = await pgPool.query('SELECT COUNT(*) AS count FROM students');
          const tRes = await pgPool.query('SELECT COUNT(*) AS count FROM test_sessions');
          const rRes = await pgPool.query('SELECT COUNT(*) AS count FROM rooms');
          return {
            type: 'postgresql',
            connected: true,
            configured: true,
            studentsCount: parseInt(sRes.rows[0]?.count || '0', 10),
            testsCount: parseInt(tRes.rows[0]?.count || '0', 10),
            roomsCount: parseInt(rRes.rows[0]?.count || '0', 10),
            connectionHost: 'Supabase / PostgreSQL Managed Instance'
          };
        } catch {
          // ignore error and report fallback
        }
      }
    }

    return {
      type: 'json-memory',
      connected: false,
      configured,
      studentsCount: memoryStudents.length,
      testsCount: memoryTests.length,
      roomsCount: Object.keys(memoryRooms).length
    };
  },

  // ----------------------------------------------------------------------------
  // Students Management
  // ----------------------------------------------------------------------------

  async getStudents(): Promise<SchoolStudent[]> {
    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        const res = await pgPool.query(`
          SELECT 
            id, name, grade_id AS "gradeId", grade_name AS "gradeName",
            section, level, participation_count AS "participationCount",
            total_score AS "totalScore", correct_count AS "correctCount",
            total_answered AS "totalAnswered", best_streak AS "bestStreak",
            last_active_date AS "lastActiveDate"
          FROM students
          ORDER BY grade_id ASC, section ASC, total_score DESC, name ASC;
        `);
        return res.rows;
      } catch (e) {
        console.warn('[Postgres Query Failed, using fallback]', e);
      }
    }

    return [...memoryStudents];
  },

  async saveStudents(students: SchoolStudent[], mode: 'replace' | 'merge' = 'replace'): Promise<SchoolStudent[]> {
    // Update local memory & file first
    if (mode === 'replace') {
      memoryStudents = students;
    } else {
      for (const newSt of students) {
        const existingIdx = memoryStudents.findIndex(s => s.id === newSt.id || (s.name === newSt.name && s.gradeId === newSt.gradeId && s.section === newSt.section));
        if (existingIdx >= 0) {
          memoryStudents[existingIdx] = { ...memoryStudents[existingIdx], ...newSt };
        } else {
          memoryStudents.push(newSt);
        }
      }
    }
    writeJsonFile(STUDENTS_FILE, memoryStudents);

    // Sync to PostgreSQL if connected
    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        if (mode === 'replace') {
          await client.query('DELETE FROM students');
        }

        for (const s of students) {
          await client.query(`
            INSERT INTO students (
              id, name, grade_id, grade_name, section, level, 
              participation_count, total_score, correct_count, 
              total_answered, best_streak, last_active_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (name, grade_id, section) DO UPDATE SET
              total_score = EXCLUDED.total_score,
              correct_count = EXCLUDED.correct_count,
              total_answered = EXCLUDED.total_answered,
              participation_count = EXCLUDED.participation_count,
              best_streak = EXCLUDED.best_streak,
              level = EXCLUDED.level,
              last_active_date = EXCLUDED.last_active_date,
              updated_at = NOW();
          `, [
            s.id, s.name, s.gradeId, s.gradeName, s.section, s.level || 1,
            s.participationCount || 0, s.totalScore || 0, s.correctCount || 0,
            s.totalAnswered || 0, s.bestStreak || 0, s.lastActiveDate || 'لم يشارك'
          ]);
        }

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('[Postgres saveStudents error]:', e);
      } finally {
        client.release();
      }
    }

    return this.getStudents();
  },

  async addOrUpdateStudent(student: SchoolStudent): Promise<SchoolStudent[]> {
    // Update memory
    const existingIdx = memoryStudents.findIndex(s => s.id === student.id || (s.name === student.name && s.gradeId === student.gradeId && s.section === student.section));
    if (existingIdx >= 0) {
      memoryStudents[existingIdx] = { ...memoryStudents[existingIdx], ...student };
    } else {
      memoryStudents.push(student);
    }
    writeJsonFile(STUDENTS_FILE, memoryStudents);

    // Sync to DB
    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        await pgPool.query(`
          INSERT INTO students (
            id, name, grade_id, grade_name, section, level, 
            participation_count, total_score, correct_count, 
            total_answered, best_streak, last_active_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (name, grade_id, section) DO UPDATE SET
            total_score = EXCLUDED.total_score,
            correct_count = EXCLUDED.correct_count,
            total_answered = EXCLUDED.total_answered,
            participation_count = EXCLUDED.participation_count,
            best_streak = EXCLUDED.best_streak,
            level = EXCLUDED.level,
            last_active_date = EXCLUDED.last_active_date,
            updated_at = NOW();
        `, [
          student.id, student.name, student.gradeId, student.gradeName, student.section, student.level || 1,
          student.participationCount || 0, student.totalScore || 0, student.correctCount || 0,
          student.totalAnswered || 0, student.bestStreak || 0, student.lastActiveDate || 'لم يشارك'
        ]);
      } catch (e) {
        console.error('[Postgres addOrUpdateStudent error]:', e);
      }
    }

    return this.getStudents();
  },

  async deleteStudent(id: string): Promise<boolean> {
    memoryStudents = memoryStudents.filter(s => s.id !== id);
    writeJsonFile(STUDENTS_FILE, memoryStudents);

    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        await pgPool.query('DELETE FROM students WHERE id = $1', [id]);
      } catch (e) {
        console.error('[Postgres deleteStudent error]:', e);
      }
    }
    return true;
  },

  async clearStudents(): Promise<void> {
    memoryStudents = [];
    writeJsonFile(STUDENTS_FILE, []);

    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        await pgPool.query('DELETE FROM students');
      } catch (e) {
        console.error('[Postgres clearStudents error]:', e);
      }
    }
  },

  // ----------------------------------------------------------------------------
  // Idempotent Game Participation & Score Recording
  // ----------------------------------------------------------------------------

  async isRoundRecorded(roundId: string): Promise<boolean> {
    const finalRoundId = roundId.trim();
    if (memoryRecordedGames.has(finalRoundId)) return true;

    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        const res = await pgPool.query('SELECT 1 FROM recorded_game_rounds WHERE round_id = $1 LIMIT 1', [finalRoundId]);
        if (res.rowCount && res.rowCount > 0) {
          memoryRecordedGames.add(finalRoundId);
          return true;
        }
      } catch (e) {
        // ignore
      }
    }
    return false;
  },

  async recordRoundId(roundId: string, metadata?: any): Promise<boolean> {
    const finalRoundId = roundId.trim();
    memoryRecordedGames.add(finalRoundId);
    writeJsonFile(RECORDED_GAMES_FILE, [...memoryRecordedGames]);

    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        await pgPool.query(`
          INSERT INTO recorded_game_rounds (round_id, room_id, source, participants_count, results_json)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (round_id) DO NOTHING;
        `, [
          finalRoundId,
          metadata?.roomId || null,
          metadata?.source || 'room',
          metadata?.participantsCount || 0,
          JSON.stringify(metadata?.results || [])
        ]);
      } catch (e) {
        console.error('[Postgres recordRoundId error]:', e);
      }
    }
    return true;
  },

  async applyGameResults(
    results: Array<{ name: string; score: number; correctCount: number; totalAnswered: number; streak?: number }>,
    roundId: string,
    roomId?: string
  ): Promise<{ success: boolean; alreadyRecorded?: boolean; updatedCount: number }> {
    const finalRoundId = (roundId || roomId || '').trim();
    if (!finalRoundId) {
      return { success: false, updatedCount: 0 };
    }

    // Idempotency check: prevent duplicate scoring under concurrent requests or repeats
    const alreadyRecorded = await this.isRoundRecorded(finalRoundId);
    if (alreadyRecorded) {
      return { success: true, alreadyRecorded: true, updatedCount: 0 };
    }

    // Mark as recorded immediately
    await this.recordRoundId(finalRoundId, {
      roomId,
      source: roomId ? 'room' : 'direct',
      participantsCount: results.length,
      results
    });

    let updatedCount = 0;

    // 1. Update in-memory & file roster
    for (const item of results) {
      const rawName = (item.name || '').trim();
      if (!rawName || rawName.includes('تجريبي')) continue;

      let st = memoryStudents.find(s => s.name.trim() === rawName);
      if (!st) {
        st = {
          id: `student-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: rawName,
          gradeId: 'grade4',
          gradeName: 'الصف الدراسي',
          section: 'أ',
          level: 1,
          participationCount: 0,
          lastActiveDate: 'اليوم',
          totalScore: 0,
          correctCount: 0,
          totalAnswered: 0,
          bestStreak: 0
        };
        memoryStudents.push(st);
      }

      const safeScore = Math.max(0, Math.min(1000, Number(item.score) || 0));
      const safeCorrect = Math.max(0, Math.min(1000, Number(item.correctCount) || 0));
      const safeAnswered = Math.max(safeCorrect, Math.min(1000, Number(item.totalAnswered) || 0));
      const safeStreak = Math.max(0, Math.min(1000, Number(item.streak) || 0));

      st.totalScore = (st.totalScore || 0) + safeScore;
      st.correctCount = (st.correctCount || 0) + safeCorrect;
      st.totalAnswered = (st.totalAnswered || 0) + safeAnswered;
      st.participationCount = (st.participationCount || 0) + 1;
      st.bestStreak = Math.max(st.bestStreak || 0, safeStreak);
      st.lastActiveDate = 'اليوم';

      if (st.totalScore > 1000) st.level = 5;
      else if (st.totalScore > 600) st.level = 4;
      else if (st.totalScore > 300) st.level = 3;
      else if (st.totalScore > 100) st.level = 2;
      else st.level = 1;

      updatedCount++;
    }
    writeJsonFile(STUDENTS_FILE, memoryStudents);

    // 2. Update PostgreSQL database in transaction
    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        for (const item of results) {
          const rawName = (item.name || '').trim();
          if (!rawName || rawName.includes('تجريبي')) continue;

          const safeScore = Math.max(0, Math.min(1000, Number(item.score) || 0));
          const safeCorrect = Math.max(0, Math.min(1000, Number(item.correctCount) || 0));
          const safeAnswered = Math.max(safeCorrect, Math.min(1000, Number(item.totalAnswered) || 0));
          const safeStreak = Math.max(0, Math.min(1000, Number(item.streak) || 0));

          await client.query(`
            INSERT INTO students (
              id, name, grade_id, grade_name, section, level,
              participation_count, total_score, correct_count,
              total_answered, best_streak, last_active_date
            ) VALUES (
              'student-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 4),
              $1, 'grade4', 'الصف الدراسي', 'أ', 1, 1, $2, $3, $4, $5, 'اليوم'
            )
            ON CONFLICT (name, grade_id, section) DO UPDATE SET
              total_score = students.total_score + $2,
              correct_count = students.correct_count + $3,
              total_answered = students.total_answered + $4,
              participation_count = students.participation_count + 1,
              best_streak = GREATEST(students.best_streak, $5),
              level = CASE 
                WHEN (students.total_score + $2) > 1000 THEN 5
                WHEN (students.total_score + $2) > 600 THEN 4
                WHEN (students.total_score + $2) > 300 THEN 3
                WHEN (students.total_score + $2) > 100 THEN 2
                ELSE 1
              END,
              last_active_date = 'اليوم',
              updated_at = NOW();
          `, [rawName, safeScore, safeCorrect, safeAnswered, safeStreak]);
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('[Postgres applyGameResults error]:', e);
      } finally {
        client.release();
      }
    }

    return { success: true, updatedCount };
  },

  // ----------------------------------------------------------------------------
  // Test Sessions Database
  // ----------------------------------------------------------------------------

  async getTests(): Promise<TestSessionRecord[]> {
    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        const testsRes = await pgPool.query(`
          SELECT 
            id, title, grade_id AS "gradeId", grade_name AS "gradeName",
            section, tables, op_mode AS "opMode", time_limit AS "timeLimit",
            rounds_per_student AS "roundsPerStudent", competition_type AS "competitionType",
            total_participants AS "totalParticipants", average_accuracy AS "averageAccuracy",
            top_student_name AS "topStudentName", top_student_score AS "topStudentScore",
            date_formatted AS "dateFormatted", created_at AS "createdAt"
          FROM test_sessions
          ORDER BY created_at DESC;
        `);

        const participantsRes = await pgPool.query(`
          SELECT 
            session_id, student_id AS "id", name, score, 
            correct_answers AS "correctAnswers", total_answered AS "totalAnswered",
            percentage, rank, eliminated
          FROM test_session_participants
          ORDER BY session_id ASC, rank ASC;
        `);

        const partMap: Record<string, TestParticipant[]> = {};
        for (const p of participantsRes.rows) {
          if (!partMap[p.session_id]) partMap[p.session_id] = [];
          partMap[p.session_id].push({
            id: p.id || '',
            name: p.name,
            score: p.score,
            correctAnswers: p.correctAnswers,
            totalAnswered: p.totalAnswered,
            percentage: Number(p.percentage),
            rank: p.rank,
            eliminated: Boolean(p.eliminated)
          });
        }

        return testsRes.rows.map(t => ({
          ...t,
          tables: Array.isArray(t.tables) ? t.tables : (typeof t.tables === 'string' ? JSON.parse(t.tables) : []),
          participants: partMap[t.id] || []
        }));
      } catch (e) {
        console.warn('[Postgres getTests failed, using fallback]', e);
      }
    }

    return [...memoryTests];
  },

  async saveTest(test: TestSessionRecord): Promise<TestSessionRecord[]> {
    const existingIdx = memoryTests.findIndex(t => t.id === test.id);
    if (existingIdx >= 0) {
      memoryTests[existingIdx] = test;
    } else {
      memoryTests.unshift(test);
    }
    writeJsonFile(TESTS_FILE, memoryTests);

    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`
          INSERT INTO test_sessions (
            id, title, grade_id, grade_name, section, tables,
            op_mode, time_limit, rounds_per_student, competition_type,
            total_participants, average_accuracy, top_student_name,
            top_student_score, date_formatted, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            tables = EXCLUDED.tables,
            op_mode = EXCLUDED.op_mode,
            time_limit = EXCLUDED.time_limit,
            rounds_per_student = EXCLUDED.rounds_per_student,
            competition_type = EXCLUDED.competition_type,
            total_participants = EXCLUDED.total_participants,
            average_accuracy = EXCLUDED.average_accuracy,
            top_student_name = EXCLUDED.top_student_name,
            top_student_score = EXCLUDED.top_student_score,
            date_formatted = EXCLUDED.date_formatted;
        `, [
          test.id, test.title, test.gradeId, test.gradeName, test.section,
          JSON.stringify(test.tables || []), test.opMode, test.timeLimit,
          test.roundsPerStudent, test.competitionType, test.totalParticipants,
          test.averageAccuracy, test.topStudentName, test.topStudentScore,
          test.dateFormatted, test.createdAt
        ]);

        if (Array.isArray(test.participants)) {
          for (const p of test.participants) {
            await client.query(`
              INSERT INTO test_session_participants (
                session_id, student_id, name, score, correct_answers,
                total_answered, percentage, rank, eliminated
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (session_id, name) DO UPDATE SET
                score = EXCLUDED.score,
                correct_answers = EXCLUDED.correct_answers,
                total_answered = EXCLUDED.total_answered,
                percentage = EXCLUDED.percentage,
                rank = EXCLUDED.rank,
                eliminated = EXCLUDED.eliminated;
            `, [
              test.id, p.id || null, p.name, p.score, p.correctAnswers,
              p.totalAnswered, p.percentage, p.rank, Boolean(p.eliminated)
            ]);
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('[Postgres saveTest error]:', e);
      } finally {
        client.release();
      }
    }

    return this.getTests();
  },

  async deleteTest(id: string): Promise<boolean> {
    memoryTests = memoryTests.filter(t => t.id !== id);
    writeJsonFile(TESTS_FILE, memoryTests);

    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        await pgPool.query('DELETE FROM test_sessions WHERE id = $1', [id]);
      } catch (e) {
        console.error('[Postgres deleteTest error]:', e);
      }
    }
    return true;
  },

  async clearTests(): Promise<void> {
    memoryTests = [];
    writeJsonFile(TESTS_FILE, []);

    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        await pgPool.query('DELETE FROM test_sessions');
      } catch (e) {
        console.error('[Postgres clearTests error]:', e);
      }
    }
  },

  // ----------------------------------------------------------------------------
  // Rooms Management
  // ----------------------------------------------------------------------------

  async getRoom(id: string): Promise<Room | null> {
    const code = id.toUpperCase();

    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        const res = await pgPool.query(`
          SELECT 
            id, title, room_type AS "roomType", status, host_token AS "hostToken",
            config, questions, students, current_question_index AS "currentQuestionIndex",
            question_started_at AS "questionStartedAt", intermission_ends_at AS "intermissionEndsAt",
            results_recorded AS "resultsRecorded", created_at AS "createdAt"
          FROM rooms
          WHERE id = $1 LIMIT 1;
        `, [code]);

        if (res.rowCount && res.rows[0]) {
          const row = res.rows[0];
          const room: Room = {
            id: row.id,
            title: row.title,
            roomType: row.roomType,
            status: row.status,
            hostToken: row.hostToken,
            config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
            questions: typeof row.questions === 'string' ? JSON.parse(row.questions) : (row.questions || []),
            students: typeof row.students === 'string' ? JSON.parse(row.students) : (row.students || {}),
            currentQuestionIndex: row.currentQuestionIndex,
            questionStartedAt: Number(row.questionStartedAt),
            intermissionEndsAt: Number(row.intermissionEndsAt),
            resultsRecorded: Boolean(row.resultsRecorded),
            createdAt: Number(row.createdAt)
          };
          memoryRooms[code] = room;
          return room;
        }
      } catch (e) {
        console.warn('[Postgres getRoom failed, using memory fallback]', e);
      }
    }

    return memoryRooms[code] || null;
  },

  async getAllRooms(): Promise<Room[]> {
    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        const res = await pgPool.query(`
          SELECT 
            id, title, room_type AS "roomType", status, host_token AS "hostToken",
            config, questions, students, current_question_index AS "currentQuestionIndex",
            question_started_at AS "questionStartedAt", intermission_ends_at AS "intermissionEndsAt",
            results_recorded AS "resultsRecorded", created_at AS "createdAt"
          FROM rooms
          ORDER BY created_at DESC;
        `);
        return res.rows.map(row => ({
          id: row.id,
          title: row.title,
          roomType: row.roomType,
          status: row.status,
          hostToken: row.hostToken,
          config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
          questions: typeof row.questions === 'string' ? JSON.parse(row.questions) : (row.questions || []),
          students: typeof row.students === 'string' ? JSON.parse(row.students) : (row.students || {}),
          currentQuestionIndex: row.currentQuestionIndex,
          questionStartedAt: Number(row.questionStartedAt),
          intermissionEndsAt: Number(row.intermissionEndsAt),
          resultsRecorded: Boolean(row.resultsRecorded),
          createdAt: Number(row.createdAt)
        }));
      } catch (e) {
        // fallback
      }
    }
    return Object.values(memoryRooms);
  },

  async saveRoom(room: Room): Promise<void> {
    const code = room.id.toUpperCase();
    memoryRooms[code] = room;
    writeJsonFile(ROOMS_FILE, memoryRooms);

    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        await pgPool.query(`
          INSERT INTO rooms (
            id, title, room_type, status, host_token, config, questions, students,
            current_question_index, question_started_at, intermission_ends_at,
            results_recorded, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            room_type = EXCLUDED.room_type,
            status = EXCLUDED.status,
            host_token = EXCLUDED.host_token,
            config = EXCLUDED.config,
            questions = EXCLUDED.questions,
            students = EXCLUDED.students,
            current_question_index = EXCLUDED.current_question_index,
            question_started_at = EXCLUDED.question_started_at,
            intermission_ends_at = EXCLUDED.intermission_ends_at,
            results_recorded = EXCLUDED.results_recorded,
            updated_at = NOW();
        `, [
          code, room.title, room.roomType, room.status, room.hostToken || null,
          JSON.stringify(room.config || {}), JSON.stringify(room.questions || []),
          JSON.stringify(room.students || {}),
          room.currentQuestionIndex || 0, room.questionStartedAt || 0,
          room.intermissionEndsAt || 0, Boolean(room.resultsRecorded),
          room.createdAt || Date.now()
        ]);
      } catch (e) {
        console.error('[Postgres saveRoom error]:', e);
      }
    }
  },

  async deleteRoom(id: string): Promise<void> {
    const code = id.toUpperCase();
    delete memoryRooms[code];
    writeJsonFile(ROOMS_FILE, memoryRooms);

    const hasDb = await ensurePostgresSchema();
    if (hasDb && pgPool) {
      try {
        await pgPool.query('DELETE FROM rooms WHERE id = $1', [code]);
      } catch (e) {
        // ignore
      }
    }
  },

  // ----------------------------------------------------------------------------
  // Complete Full Backup & Restore Utilities
  // ----------------------------------------------------------------------------

  async createFullBackup(): Promise<{
    timestamp: number;
    date: string;
    school: string;
    counts: {
      students: number;
      tests: number;
      rooms: number;
    };
    students: SchoolStudent[];
    tests: TestSessionRecord[];
  }> {
    const students = await this.getStudents();
    const tests = await this.getTests();
    const rooms = await this.getAllRooms();

    return {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      school: 'مدارس رياض الإبداع',
      counts: {
        students: students.length,
        tests: tests.length,
        rooms: rooms.length
      },
      students,
      tests
    };
  },

  async restoreBackup(backup: {
    students?: SchoolStudent[];
    tests?: TestSessionRecord[];
  }): Promise<{ restoredStudents: number; restoredTests: number }> {
    let restoredStudents = 0;
    let restoredTests = 0;

    if (Array.isArray(backup.students) && backup.students.length > 0) {
      await this.saveStudents(backup.students, 'replace');
      restoredStudents = backup.students.length;
    }

    if (Array.isArray(backup.tests) && backup.tests.length > 0) {
      for (const t of backup.tests) {
        await this.saveTest(t);
      }
      restoredTests = backup.tests.length;
    }

    return { restoredStudents, restoredTests };
  }
};
