import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { dbAdapter } from './src/services/dbAdapter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// In-memory rate limiting and login attempt protection
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const activeAdminTokens = new Set<string>();

// Enable CORS for all origins so external devices, phones, and friends can access without restriction
app.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  // Normalize URL if Vercel serverless rewrite removed or forwarded without /api
  if (!req.url.startsWith('/api') && (req.url.startsWith('/rooms') || req.url.startsWith('/school') || req.url.startsWith('/admin'))) {
    req.url = '/api' + req.url;
  }
  next();
});

// Helper: Verify Admin session token
function isAuthorizedAdminToken(token?: string): boolean {
  if (!token) return false;
  if (activeAdminTokens.has(token)) return true;
  const jwtSecret = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || 'riyadh_al_ebdaa_secret_key_2026';
  try {
    const [payloadBase64, sig] = token.split('.');
    if (payloadBase64 && sig) {
      const expectedSig = crypto.createHmac('sha256', jwtSecret).update(payloadBase64).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        if (payload && payload.exp && payload.exp > Date.now()) {
          activeAdminTokens.add(token);
          return true;
        }
      }
    }
  } catch {
    // Invalid format
  }
  return false;
}

// Middleware: Verify Admin Authorization for sensitive mutations
function requireAdminAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول كمسؤول للنظام للقيام بهذا الإجراء' });
    return;
  }
  const token = authHeader.split(' ')[1];
  if (!isAuthorizedAdminToken(token)) {
    res.status(403).json({ error: 'انتهت صلاحية الجلسة أو الرمز غير صالح، يرجى تسجيل الدخول مجدداً' });
    return;
  }
  next();
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

export interface Student {
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
  roomType: 'duel' | 'group'; // duel = 1v1, group = classroom online
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
  students: Record<string, Student>;
  createdAt: number;
  hostToken?: string;
  resultsRecorded?: boolean;
}

// Room persistence across serverless container invocations via /tmp and workspace root
const ROOMS_DATA_FILE = process.env.VERCEL ? '/tmp/riyadh_rooms.json' : join(__dirname, 'rooms.json');
let rooms: Record<string, Room> = {};

function loadRooms(): Record<string, Room> {
  try {
    if (fs.existsSync(ROOMS_DATA_FILE)) {
      const data = fs.readFileSync(ROOMS_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        rooms = { ...rooms, ...parsed };
      }
    } else if (process.env.VERCEL) {
      // In Vercel first load, try bundle fallback
      const rootRoomsFile = join(__dirname, 'rooms.json');
      if (fs.existsSync(rootRoomsFile)) {
        const data = fs.readFileSync(rootRoomsFile, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          rooms = { ...rooms, ...parsed };
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return rooms;
}

function saveRooms() {
  try {
    fs.writeFileSync(ROOMS_DATA_FILE, JSON.stringify(rooms, null, 2), 'utf-8');
  } catch (e) {
    // In read-only fallback, memory cache maintains state
  }
  // Sync to dbAdapter for cloud persistence
  try {
    Object.values(rooms).forEach(r => {
      dbAdapter.saveRoom(r).catch(() => {});
    });
  } catch {
    // ignore
  }
}

function getRoom(roomId: string | undefined): Room | undefined {
  if (!roomId) return undefined;
  loadRooms();
  return rooms[roomId.toUpperCase()];
}

loadRooms();

// Recorded game rounds idempotency tracking
const RECORDED_GAMES_FILE = process.env.VERCEL ? '/tmp/riyadh_recorded_games.json' : join(__dirname, 'recorded_games.json');
let recordedGameIds = new Set<string>();

function loadRecordedGameIds(): Set<string> {
  try {
    if (fs.existsSync(RECORDED_GAMES_FILE)) {
      const data = fs.readFileSync(RECORDED_GAMES_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) {
        list.forEach(id => {
          if (typeof id === 'string' && id.trim()) {
            recordedGameIds.add(id.trim());
          }
        });
      }
    }
  } catch (e) {
    // ignore
  }
  return recordedGameIds;
}

function saveRecordedGameIds() {
  try {
    fs.writeFileSync(RECORDED_GAMES_FILE, JSON.stringify([...recordedGameIds], null, 2), 'utf-8');
  } catch (e) {
    // In read-only serverless environment, in-memory Set maintains state
  }
}

loadRecordedGameIds();

// Verify if caller is authorized host of the room
function isAuthorizedHost(req: Request, room: Room): boolean {
  if (!room) return false;
  // 1. Direct host token in header
  const headerToken = (req.headers['x-host-token'] as string || '').trim();
  if (headerToken && room.hostToken && headerToken === room.hostToken) {
    return true;
  }
  // 2. Direct host token in query or body
  const queryToken = (req.query.hostToken as string || '').trim();
  if (queryToken && room.hostToken && queryToken === room.hostToken) {
    return true;
  }
  const bodyToken = (req.body?.hostToken as string || '').trim();
  if (bodyToken && room.hostToken && bodyToken === room.hostToken) {
    return true;
  }
  // 3. Admin authorization
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (isAuthorizedAdminToken(token)) {
      return true;
    }
  }
  // CRITICAL: query role=host is NOT accepted!
  return false;
}

// Sanitize room data for client responses, masking answers for students
function sanitizeRoomForClient(room: Room, isHost: boolean) {
  const sanitizedQuestions = room.questions.map((q, idx) => {
    // If host, or question has passed, the answer is visible
    const hasPassed = idx < room.currentQuestionIndex;
    return {
      ...q,
      answer: (isHost || hasPassed) ? q.answer : 0
    };
  });

  return {
    id: room.id,
    title: room.title,
    roomType: room.roomType,
    status: room.status,
    config: room.config,
    questions: sanitizedQuestions,
    currentQuestionIndex: room.currentQuestionIndex,
    questionStartedAt: room.questionStartedAt,
    intermissionEndsAt: room.intermissionEndsAt,
    students: room.students,
    createdAt: room.createdAt,
    resultsRecorded: room.resultsRecorded || false
  };
}

// Apply results safely to school students database
function applyResultsToSchoolStudents(results: Array<{ name: string; score: number; correctCount: number; totalAnswered: number; streak?: number }>): number {
  if (!Array.isArray(results) || results.length === 0) return 0;
  const current = loadSchoolStudents();
  let updatedCount = 0;

  for (const item of results) {
    const rawName = (item.name || '').trim();
    if (!rawName || rawName.includes('تجريبي')) continue;

    let student = current.find(s => s.name.trim() === rawName);
    if (!student) {
      student = {
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
      current.push(student);
    }

    // Validate boundaries to prevent corrupted values
    const safeScore = Math.max(0, Math.min(1000, Number(item.score) || 0));
    const safeCorrect = Math.max(0, Math.min(1000, Number(item.correctCount) || 0));
    const safeAnswered = Math.max(safeCorrect, Math.min(1000, Number(item.totalAnswered) || 0));
    const safeStreak = Math.max(0, Math.min(1000, Number(item.streak) || 0));

    student.totalScore = (student.totalScore || 0) + safeScore;
    student.correctCount = (student.correctCount || 0) + safeCorrect;
    student.totalAnswered = (student.totalAnswered || 0) + safeAnswered;
    student.participationCount = (student.participationCount || 0) + 1;
    student.bestStreak = Math.max(student.bestStreak || 0, safeStreak);
    student.lastActiveDate = 'اليوم';

    // Update level based on score
    if (student.totalScore > 1000) student.level = 5;
    else if (student.totalScore > 600) student.level = 4;
    else if (student.totalScore > 300) student.level = 3;
    else if (student.totalScore > 100) student.level = 2;
    else student.level = 1;

    updatedCount++;
  }

  if (updatedCount > 0) {
    saveSchoolStudents(current);
  }
  return updatedCount;
}

// Server-authoritative room completion recording (Strictly idempotent)
function recordRoomCompletionOnServer(room: Room) {
  if (room.resultsRecorded) return;
  room.resultsRecorded = true;
  saveRooms();

  const roundId = `room_${room.id}_${room.createdAt}`;
  if (recordedGameIds.has(roundId)) return;
  recordedGameIds.add(roundId);
  saveRecordedGameIds();

  // Extract non-test student scores
  const studentResults = Object.values(room.students || {})
    .filter(s => s && s.name && !s.name.includes('تجريبي'))
    .map(s => ({
      name: s.name,
      score: s.score || 0,
      correctCount: s.correctCount || 0,
      totalAnswered: s.answers?.length || room.questions.length,
      streak: s.streak || 0
    }));

  if (studentResults.length > 0) {
    applyResultsToSchoolStudents(studentResults);
  }
}


function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRoomQuestions(
  tables: number[],
  count: number,
  mode: 'multi' | 'divi' | 'mixed'
): Question[] {
  const validTables = tables.length > 0 ? tables : [2, 3, 4, 5, 6, 7, 8, 9, 10];
  const candidates: Array<{ a: number; b: number; operation: '×' | '÷'; answer: number }> = [];

  for (const table of validTables) {
    for (let factor = 1; factor <= 12; factor++) {
      if (mode === 'multi' || mode === 'mixed') {
        candidates.push({
          a: table,
          b: factor,
          operation: '×',
          answer: table * factor
        });
      }
      if (mode === 'divi' || mode === 'mixed') {
        const product = table * factor;
        candidates.push({
          a: product,
          b: table,
          operation: '÷',
          answer: factor
        });
      }
    }
  }

  // Support any question count without restrictions (cycles candidates if user requests more than available)
  const targetCount = Math.max(1, count || 10);
  const selectedCandidates: typeof candidates = [];

  while (selectedCandidates.length < targetCount && candidates.length > 0) {
    const pool = shuffle([...candidates]);
    for (const item of pool) {
      selectedCandidates.push(item);
      if (selectedCandidates.length >= targetCount) break;
    }
  }

  return selectedCandidates.map((c, idx) => {
    const correct = c.answer;
    const optionsSet = new Set<number>([correct]);

    const deltas = [
      c.operation === '×' ? c.a : 1,
      c.operation === '×' ? -c.a : -1,
      c.operation === '×' ? c.b : 2,
      c.operation === '×' ? -c.b : -2,
      1,
      -1,
      2,
      -2,
      10,
      -10
    ];

    for (const d of shuffle(deltas)) {
      if (optionsSet.size >= 4) break;
      const val = correct + d;
      if (val >= 0 && val !== correct) optionsSet.add(val);
    }

    let fallbackOffset = 3;
    while (optionsSet.size < 4) {
      optionsSet.add(Math.max(0, correct + fallbackOffset));
      fallbackOffset += 2;
    }

    const options = shuffle(Array.from(optionsSet));

    return {
      id: idx + 1,
      a: c.a,
      b: c.b,
      operation: c.operation,
      answer: correct,
      options,
      text: `${c.a} ${c.operation} ${c.b}`
    };
  });
}

// Check and trigger auto-advancing of room questions
function updateRoomState(room: Room) {
  const now = Date.now();

  // If in 3-second intermission, check if time has elapsed
  if (room.status === 'intermission') {
    if (now >= room.intermissionEndsAt) {
      if (room.currentQuestionIndex + 1 < room.questions.length) {
        room.currentQuestionIndex += 1;
        room.status = 'playing';
        room.questionStartedAt = now;
      } else {
        room.status = 'finished';
        recordRoomCompletionOnServer(room);
      }
    }
    return;
  }

  // If playing, check simulated students and whether all active students answered
  if (room.status === 'playing') {
    const studentList = Object.values(room.students);
    const q = room.questions[room.currentQuestionIndex];

    // Simulate answering for test student named "تجريبي"
    if (q && studentList.length > 0) {
      studentList.forEach(s => {
        const isTestStudent = s.name.includes('تجريبي');
        const alreadyAnswered = s.answers.some(a => a.questionIndex === room.currentQuestionIndex);
        if (isTestStudent && !alreadyAnswered) {
          // After ~1.2s from question start, test student answers
          if (now - room.questionStartedAt >= 1300) {
            const isCorrect = Math.random() < 0.85;
            const selectedOption = isCorrect
              ? q.answer
              : (q.options.find(opt => opt !== q.answer) ?? q.options[0]);
            const timeSpent = Math.min(room.config.timePerQuestion, Math.max(1, (now - room.questionStartedAt) / 1000));
            let pointsEarned = 0;
            if (isCorrect) {
              s.streak += 1;
              s.correctCount += 1;
              pointsEarned = 1; // Exactly 1 point per correct answer
              s.score += pointsEarned;
            } else {
              s.streak = 0;
            }
            s.answers.push({
              questionIndex: room.currentQuestionIndex,
              selectedOption,
              isCorrect,
              timeSpent,
              pointsEarned
            });
            s.currentIndex = room.currentQuestionIndex + 1;
            s.lastActive = now;
          }
        }
      });
    }

    if (studentList.length > 0) {
      const allAnswered = studentList.every(s =>
        s.answers.some(a => a.questionIndex === room.currentQuestionIndex)
      );

      // Or if question timer expired
      const timeoutExpired = (now - room.questionStartedAt) > ((room.config.timePerQuestion + 1) * 1000);

      if (allAnswered || timeoutExpired) {
        room.status = 'intermission';
        room.intermissionEndsAt = now + 3000; // Exactly 3-second break
      }
    }
  }
}

// 1. Create room (Supports unlimited concurrent rooms)
app.post('/api/rooms', (req: Request, res: Response) => {
  const {
    tables = [2, 3, 4, 5, 6, 7, 8, 9, 10],
    questionsCount = 10,
    timePerQuestion = 10,
    mode = 'multi',
    roomType = 'duel',
    title = 'تحدي جدول الضرب'
  } = req.body;

  // 4-character uppercase alphanumeric code
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let roomId = '';
  for (let i = 0; i < 4; i++) {
    roomId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  while (rooms[roomId]) {
    roomId = '';
    for (let i = 0; i < 4; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }

  const questions = generateRoomQuestions(tables, questionsCount, mode);
  const hostToken = crypto.randomBytes(24).toString('hex');

  rooms[roomId] = {
    id: roomId,
    title,
    roomType,
    status: 'lobby',
    config: {
      tables,
      questionsCount: questions.length,
      timePerQuestion,
      mode
    },
    questions,
    currentQuestionIndex: 0,
    questionStartedAt: 0,
    intermissionEndsAt: 0,
    students: {},
    createdAt: Date.now(),
    hostToken,
    resultsRecorded: false
  };

  saveRooms();

  res.json({
    roomId,
    hostToken,
    room: sanitizeRoomForClient(rooms[roomId], true)
  });
});

// 1.5 Get all active rooms (supports concurrent rooms dashboard)
app.get('/api/rooms', (req: Request, res: Response) => {
  const roomList = Object.values(rooms).map(r => {
    updateRoomState(r);
    return {
      id: r.id,
      title: r.title,
      roomType: r.roomType,
      status: r.status,
      currentQuestionIndex: r.currentQuestionIndex,
      totalQuestions: r.questions.length,
      studentCount: Object.keys(r.students).length,
      students: Object.values(r.students).map(s => ({
        name: s.name,
        score: s.score,
        correctCount: s.correctCount
      })),
      createdAt: r.createdAt
    };
  }).sort((a, b) => b.createdAt - a.createdAt);

  res.json({ rooms: roomList });
});

// 2. Get room details (with auto-advancing check & security answer masking for students)
app.get('/api/rooms/:roomId', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  updateRoomState(room);

  // Secure authorization check: query role=host is NOT allowed
  const isHost = isAuthorizedHost(req, room);
  res.json(sanitizeRoomForClient(room, isHost));
});

// 3. Join room
app.post('/api/rooms/:roomId/join', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { name } = req.body;
  const room = getRoom(roomId);

  if (!room) {
    res.status(404).json({ error: 'رمز الغرفة غير صحيح' });
    return;
  }

  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    res.status(400).json({ error: 'الاسم مطلوب' });
    return;
  }

  if (!room.students[trimmedName]) {
    room.students[trimmedName] = {
      name: trimmedName,
      score: 0,
      currentIndex: 0,
      correctCount: 0,
      streak: 0,
      answers: [],
      lastActive: Date.now(),
      completed: false
    };
  } else {
    room.students[trimmedName].lastActive = Date.now();
  }

  // If duel and 2 players joined, auto-start!
  if (room.roomType === 'duel' && Object.keys(room.students).length === 2 && room.status === 'lobby') {
    room.status = 'playing';
    room.currentQuestionIndex = 0;
    room.questionStartedAt = Date.now();
  }

  saveRooms();

  // Joining student is always sanitized as non-host
  res.json({ success: true, room: sanitizeRoomForClient(room, false) });
});

// 4. Start room manually (Protected: Host or Admin required)
app.post('/api/rooms/:roomId/start', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  if (!isAuthorizedHost(req, room)) {
    res.status(403).json({ error: 'غير مصرح: يتطلب إذن مسؤول الغرفة لبدء المسابقة' });
    return;
  }
  room.status = 'playing';
  room.currentQuestionIndex = 0;
  room.questionStartedAt = Date.now();
  saveRooms();
  res.json({ success: true, room: sanitizeRoomForClient(room, true) });
});

// 5. Submit answer (instant score calculation & 3s intermission trigger)
app.post('/api/rooms/:roomId/answer', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { name, questionIndex, selectedOption, timeRemaining } = req.body;
  const room = getRoom(roomId);

  if (!room || !room.students[name]) {
    res.status(404).json({ error: 'المتسابق أو الغرفة غير مسجل' });
    return;
  }

  const student = room.students[name];
  const question = room.questions[questionIndex];

  if (!question) {
    res.status(400).json({ error: 'السؤال غير صالح' });
    return;
  }

  const existing = student.answers.find(a => a.questionIndex === questionIndex);
  if (existing) {
    res.json({ success: true, student, isCorrect: existing.isCorrect });
    return;
  }

  const isCorrect = Number(selectedOption) === question.answer;
  let pointsEarned = 0;

  if (isCorrect) {
    student.streak += 1;
    student.correctCount += 1;
    pointsEarned = 1; // Exactly 1 point per correct answer
    student.score += pointsEarned;
  } else {
    student.streak = 0;
  }

  student.answers.push({
    questionIndex,
    selectedOption: Number(selectedOption),
    isCorrect,
    timeSpent: Math.max(0, room.config.timePerQuestion - (timeRemaining || 0)),
    pointsEarned
  });

  student.currentIndex = questionIndex + 1;
  student.lastActive = Date.now();

  // Trigger auto-advance check
  updateRoomState(room);
  saveRooms();

  res.json({
    success: true,
    isCorrect,
    correctAnswer: question.answer,
    pointsEarned,
    student,
    roomStatus: room.status,
    intermissionEndsAt: room.intermissionEndsAt
  });
});

// 6. Reset or end room (Protected: Host or Admin required)
app.post('/api/rooms/:roomId/end', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  if (!isAuthorizedHost(req, room)) {
    res.status(403).json({ error: 'غير مصرح: يتطلب إذن مسؤول الغرفة لإنهاء المسابقة' });
    return;
  }
  room.status = 'finished';
  recordRoomCompletionOnServer(room);
  saveRooms();
  res.json({ success: true, room: sanitizeRoomForClient(room, true) });
});

// 7. Advance / Skip to next question immediately by teacher (Protected: Host or Admin required)
app.post('/api/rooms/:roomId/next', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  if (!isAuthorizedHost(req, room)) {
    res.status(403).json({ error: 'غير مصرح: يتطلب إذن مسؤول الغرفة للتنقل بين الأسئلة' });
    return;
  }
  const now = Date.now();
  if (room.currentQuestionIndex + 1 < room.questions.length) {
    room.currentQuestionIndex += 1;
    room.status = 'playing';
    room.questionStartedAt = now;
  } else {
    room.status = 'finished';
    recordRoomCompletionOnServer(room);
  }
  saveRooms();
  res.json({ success: true, room: sanitizeRoomForClient(room, true) });
});

// 8. Go back to previous question by teacher (Protected: Host or Admin required)
app.post('/api/rooms/:roomId/prev', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  if (!isAuthorizedHost(req, room)) {
    res.status(403).json({ error: 'غير مصرح: يتطلب إذن مسؤول الغرفة للرجوع للسؤال السابق' });
    return;
  }
  if (room.currentQuestionIndex > 0) {
    room.currentQuestionIndex -= 1;
    room.status = 'playing';
    room.questionStartedAt = Date.now();
  }
  saveRooms();
  res.json({ success: true, room: sanitizeRoomForClient(room, true) });
});

// 9. Repeat current question (Protected: Host or Admin required; rolls back points to prevent duplication)
app.post('/api/rooms/:roomId/repeat', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  if (!isAuthorizedHost(req, room)) {
    res.status(403).json({ error: 'غير مصرح: يتطلب إذن مسؤول الغرفة لإعادة السؤال' });
    return;
  }
  const qIdx = room.currentQuestionIndex;

  // Cleanly roll back points and correct counts earned on this question to prevent doubling of scores
  Object.values(room.students).forEach(s => {
    const prevAnswer = s.answers.find(a => a.questionIndex === qIdx);
    if (prevAnswer) {
      if (prevAnswer.isCorrect) {
        s.score = Math.max(0, s.score - (prevAnswer.pointsEarned || 1));
        s.correctCount = Math.max(0, s.correctCount - 1);
      }
      s.answers = s.answers.filter(a => a.questionIndex !== qIdx);

      // Recalculate streak accurately from remaining answers
      let streak = 0;
      const sortedAnswers = [...s.answers].sort((a, b) => a.questionIndex - b.questionIndex);
      for (const ans of sortedAnswers) {
        if (ans.isCorrect) streak += 1;
        else streak = 0;
      }
      s.streak = streak;
    }
  });

  room.status = 'playing';
  room.questionStartedAt = Date.now();
  saveRooms();
  res.json({ success: true, room: sanitizeRoomForClient(room, true) });
});

// 10. Add mock/test student named "تجريبي" only (Protected: Host or Admin required)
app.post('/api/rooms/:roomId/add-test-student', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  if (!isAuthorizedHost(req, room)) {
    res.status(403).json({ error: 'غير مصرح: يتطلب إذن مسؤول الغرفة' });
    return;
  }
  const studentCount = Object.keys(room.students).filter(k => k.includes('تجريبي')).length;
  const testName = studentCount === 0 ? 'تجريبي' : `تجريبي ${studentCount + 1}`;
  room.students[testName] = {
    name: testName,
    score: 0,
    currentIndex: 0,
    correctCount: 0,
    streak: 0,
    answers: [],
    lastActive: Date.now(),
    completed: false
  };

  if (room.roomType === 'duel' && Object.keys(room.students).length === 2 && room.status === 'lobby') {
    room.status = 'playing';
    room.currentQuestionIndex = 0;
    room.questionStartedAt = Date.now();
  }

  saveRooms();
  res.json({ success: true, room: sanitizeRoomForClient(room, true), addedName: testName });
});

// ============================================================
// SCHOOL STUDENTS & ADMIN PORTAL PERSISTENCE & ANALYTICS
// ============================================================
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

const SCHOOL_DATA_FILE = process.env.VERCEL ? '/tmp/riyadh_school_students.json' : join(__dirname, 'school_students.json');
let inMemoryStudentsCache: SchoolStudent[] = [];

function loadSchoolStudents(): SchoolStudent[] {
  if (inMemoryStudentsCache.length > 0) return inMemoryStudentsCache;
  try {
    if (fs.existsSync(SCHOOL_DATA_FILE)) {
      const data = fs.readFileSync(SCHOOL_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryStudentsCache = parsed;
        return inMemoryStudentsCache;
      }
    } else if (process.env.VERCEL) {
      const rootSchoolFile = join(__dirname, 'school_students.json');
      if (fs.existsSync(rootSchoolFile)) {
        const data = fs.readFileSync(rootSchoolFile, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryStudentsCache = parsed;
          return inMemoryStudentsCache;
        }
      }
    }
  } catch (e) {
    console.error('Failed to read school_students.json:', e);
  }
  return inMemoryStudentsCache;
}

function saveSchoolStudents(list: SchoolStudent[]) {
  inMemoryStudentsCache = list;
  try {
    fs.writeFileSync(SCHOOL_DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    // In serverless / read-only filesystems (e.g. Vercel), preserve in memory safely
    console.warn('Filesystem read-only (e.g. Vercel), cached in memory:', e);
  }
}

// Admin login verification endpoint with brute-force rate limiting and cryptographically signed session tokens
app.post('/api/admin/login', (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };

  if (attempt.lockedUntil > now) {
    const remainingSecs = Math.ceil((attempt.lockedUntil - now) / 1000);
    res.status(429).json({
      error: `تم تجاوز الحد المسموح من محاولات الدخول. يرجى الانتظار ${remainingSecs} ثانية قبل المحاولة مجدداً`
    });
    return;
  }

  const { email, password } = req.body;
  const adminEmail = (process.env.ADMIN_EMAIL || 'osamaabedy@gmail.com').trim().toLowerCase();
  const adminPassword = (process.env.ADMIN_PASSWORD || '990001').trim();

  const userEmail = (email || '').trim().toLowerCase();
  const userPassword = (password || '').trim();

  // Timing safe comparison to mitigate timing attacks
  const emailMatch = userEmail === adminEmail;
  const passBuf = Buffer.from(userPassword);
  const targetBuf = Buffer.from(adminPassword);
  const passMatch = passBuf.length === targetBuf.length && crypto.timingSafeEqual(passBuf, targetBuf);

  if (emailMatch && passMatch) {
    // Reset failed attempt counter on success
    loginAttempts.delete(ip);

    // Generate signed token valid for 7 days
    const jwtSecret = process.env.JWT_SECRET || adminPassword || 'riyadh_al_ebdaa_secret_key_2026';
    const payload = {
      email: adminEmail,
      role: 'admin',
      exp: now + 7 * 24 * 60 * 60 * 1000,
      iat: now
    };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', jwtSecret).update(payloadBase64).digest('hex');
    const token = `${payloadBase64}.${signature}`;

    activeAdminTokens.add(token);

    res.json({
      success: true,
      email: adminEmail,
      token,
      expiresIn: 7 * 24 * 60 * 60
    });
  } else {
    attempt.count += 1;
    if (attempt.count >= 5) {
      attempt.lockedUntil = now + 5 * 60 * 1000; // Lock for 5 minutes after 5 failures
      attempt.count = 0;
    }
    loginAttempts.set(ip, attempt);

    res.status(401).json({
      error: 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور'
    });
  }
});

// 1. Get school students
app.get('/api/school/students', (req: Request, res: Response) => {
  const students = loadSchoolStudents();
  res.json({ students });
});

// 2. Batch upload / replace students (Protected: Admin Auth Required)
app.post('/api/school/students/batch', requireAdminAuth, (req: Request, res: Response) => {
  const { students, mode } = req.body;
  if (!Array.isArray(students)) {
    res.status(400).json({ error: 'قائمة الطلاب غير صالحة' });
    return;
  }
  let current = loadSchoolStudents();
  if (mode === 'replace') {
    current = students;
  } else {
    for (const newSt of students) {
      const existingIdx = current.findIndex(s => s.id === newSt.id || (s.name === newSt.name && s.gradeId === newSt.gradeId));
      if (existingIdx >= 0) {
        current[existingIdx] = { ...current[existingIdx], ...newSt };
      } else {
        current.push(newSt);
      }
    }
  }
  saveSchoolStudents(current);
  res.json({ success: true, count: current.length, students: current });
});

// 3. Add or update single student (Protected: Admin Auth Required)
app.post('/api/school/students', requireAdminAuth, (req: Request, res: Response) => {
  const studentData: SchoolStudent = req.body;
  if (!studentData || !studentData.name) {
    res.status(400).json({ error: 'اسم الطالب مطلوب' });
    return;
  }
  const current = loadSchoolStudents();
  const existingIdx = current.findIndex(s => s.id === studentData.id);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...studentData };
  } else {
    current.push({
      ...studentData,
      id: studentData.id || `student-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      level: studentData.level || 1,
      participationCount: studentData.participationCount || 0,
      totalScore: studentData.totalScore || 0,
      correctCount: studentData.correctCount || 0,
      totalAnswered: studentData.totalAnswered || 0,
      bestStreak: studentData.bestStreak || 0,
      lastActiveDate: studentData.lastActiveDate || 'لم يشارك'
    });
  }
  saveSchoolStudents(current);
  res.json({ success: true, students: current });
});

// 4. Delete student (Protected: Admin Auth Required)
app.delete('/api/school/students/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const current = loadSchoolStudents();
  const filtered = current.filter(s => s.id !== id);
  saveSchoolStudents(filtered);
  res.json({ success: true, count: filtered.length });
});

// 5. Clear all students (Protected: Admin Auth Required)
app.delete('/api/school/students', requireAdminAuth, (req: Request, res: Response) => {
  saveSchoolStudents([]);
  res.json({ success: true, count: 0 });
});

// 6. Record game participation results into school roster (Idempotent & Protected)
app.post('/api/school/record-game', (req: Request, res: Response) => {
  const { results, roundId, roomId, hostToken } = req.body;
  if (!Array.isArray(results)) {
    res.status(400).json({ error: 'نتائج غير صالحة' });
    return;
  }

  const finalRoundId = (roundId || roomId || '').trim();
  if (!finalRoundId) {
    res.status(400).json({ error: 'معرف الجولة مطلوب لمنع تكرار تسجيل النتائج' });
    return;
  }

  // If associated with an online room, verify caller is authorized host
  if (roomId) {
    const room = getRoom(roomId);
    if (room) {
      const isHost = isAuthorizedHost(req, room) || (hostToken && hostToken === room.hostToken);
      if (!isHost) {
        res.status(403).json({ error: 'غير مصرح: لا يمكن تسجيل نتائج الغرفة إلا من خلال الخادم أو المعلم المضيف' });
        return;
      }
    }
  }

  // Idempotency check: if round already recorded, skip to prevent score duplication
  if (recordedGameIds.has(finalRoundId)) {
    res.json({ success: true, alreadyRecorded: true, message: 'تم تسجيل نتائج هذه الجولة مسبقاً' });
    return;
  }

  recordedGameIds.add(finalRoundId);
  saveRecordedGameIds();

  const updatedCount = applyResultsToSchoolStudents(results);
  res.json({ success: true, updatedCount, roundId: finalRoundId });
});

// 7. Get comprehensive school analytics & honor rolls
app.get('/api/school/analytics', (req: Request, res: Response) => {
  const students = loadSchoolStudents();
  
  const totalStudents = students.length;
  const totalParticipations = students.reduce((acc, s) => acc + (s.participationCount || 0), 0);
  const totalScoreAll = students.reduce((acc, s) => acc + (s.totalScore || 0), 0);
  const totalCorrectAll = students.reduce((acc, s) => acc + (s.correctCount || 0), 0);
  const totalAnsweredAll = students.reduce((acc, s) => acc + (s.totalAnswered || 0), 0);

  const overallAccuracy = totalAnsweredAll > 0 
    ? Math.round((totalCorrectAll / totalAnsweredAll) * 100) 
    : 0;

  const gradeKeys = [
    { id: 'grade3', name: 'الصف الثالث الابتدائي' },
    { id: 'grade4', name: 'الصف الرابع الابتدائي' },
    { id: 'grade5', name: 'الصف الخامس الابتدائي' },
    { id: 'grade6', name: 'الصف السادس الابتدائي' }
  ];

  const gradeStats = gradeKeys.map(g => {
    const gradeStudents = students.filter(s => s.gradeId === g.id);
    const count = gradeStudents.length;
    const participations = gradeStudents.reduce((acc, s) => acc + (s.participationCount || 0), 0);
    const totalScore = gradeStudents.reduce((acc, s) => acc + (s.totalScore || 0), 0);
    const correct = gradeStudents.reduce((acc, s) => acc + (s.correctCount || 0), 0);
    const answered = gradeStudents.reduce((acc, s) => acc + (s.totalAnswered || 0), 0);
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    const avgScore = count > 0 ? Math.round(totalScore / count) : 0;

    const topStudent = [...gradeStudents].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))[0] || null;

    return {
      gradeId: g.id,
      gradeName: g.name,
      studentCount: count,
      participations,
      avgScore,
      accuracy,
      topStudent: topStudent ? { name: topStudent.name, score: topStudent.totalScore, section: topStudent.section } : null
    };
  });

  const sectionMap: Record<string, { count: number; participations: number; totalScore: number }> = {};
  for (const s of students) {
    const key = `${s.gradeName} - شعبة ${s.section}`;
    if (!sectionMap[key]) {
      sectionMap[key] = { count: 0, participations: 0, totalScore: 0 };
    }
    sectionMap[key].count += 1;
    sectionMap[key].participations += (s.participationCount || 0);
    sectionMap[key].totalScore += (s.totalScore || 0);
  }

  const sectionStats = Object.entries(sectionMap).map(([title, val]) => ({
    title,
    studentCount: val.count,
    participations: val.participations,
    avgScore: val.count > 0 ? Math.round(val.totalScore / val.count) : 0
  }));

  const topOverall = [...students]
    .filter(s => (s.participationCount || 0) > 0)
    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
    .slice(0, 10);

  const masteryStars = [...students]
    .filter(s => (s.totalAnswered || 0) >= 3 && (s.correctCount / s.totalAnswered) >= 0.8)
    .sort((a, b) => {
      const accA = a.correctCount / a.totalAnswered;
      const accB = b.correctCount / b.totalAnswered;
      return accB - accA;
    })
    .slice(0, 8);

  const mostActive = [...students]
    .filter(s => (s.participationCount || 0) > 0)
    .sort((a, b) => (b.participationCount || 0) - (a.participationCount || 0))
    .slice(0, 8);

  res.json({
    totalStudents,
    totalParticipations,
    overallAccuracy,
    totalScoreAll,
    gradeStats,
    sectionStats,
    honorRolls: {
      topOverall,
      masteryStars,
      mostActive
    }
  });
});

// -------------------------------------------------------------
// TEST SESSIONS DATABASE (HISTORICAL LOGS FOR DEEP ANALYSIS)
// -------------------------------------------------------------
const TEST_DATA_FILE = process.env.VERCEL ? '/tmp/riyadh_test_sessions.json' : join(__dirname, 'test_sessions.json');
let inMemoryTestsCache: any[] = [];

function loadTestSessions(): any[] {
  if (inMemoryTestsCache.length > 0) return inMemoryTestsCache;
  try {
    if (fs.existsSync(TEST_DATA_FILE)) {
      const data = fs.readFileSync(TEST_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryTestsCache = parsed;
        return inMemoryTestsCache;
      }
    } else if (process.env.VERCEL) {
      const rootTestFile = join(__dirname, 'test_sessions.json');
      if (fs.existsSync(rootTestFile)) {
        const data = fs.readFileSync(rootTestFile, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryTestsCache = parsed;
          return inMemoryTestsCache;
        }
      }
    }
  } catch (e) {
    console.error('Failed to read test_sessions.json:', e);
  }
  return inMemoryTestsCache;
}

function saveTestSessions(list: any[]) {
  inMemoryTestsCache = list;
  try {
    fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Filesystem read-only (e.g. Vercel), cached in memory:', e);
  }
}

// 8. Get test sessions database
app.get('/api/school/tests', (req: Request, res: Response) => {
  const tests = loadTestSessions();
  res.json({ tests });
});

// 9. Record a test session into the database (Protected against unauthorized modification)
app.post('/api/school/tests', (req: Request, res: Response) => {
  const { test } = req.body;
  if (!test || !test.id) {
    res.status(400).json({ error: 'بيانات الاختبار غير مكتملة' });
    return;
  }
  const current = loadTestSessions();
  const existingIdx = current.findIndex(t => t.id === test.id);
  if (existingIdx >= 0) {
    // Modifying existing test session requires Admin authorization
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    if (!isAuthorizedAdminToken(token)) {
      res.status(403).json({ error: 'غير مصرح: تعديل الاختبارات المسجلة سابقاً يتطلب صلاحية مسؤول النظام' });
      return;
    }
    current[existingIdx] = test;
  } else {
    // Validate minimal structure for new test
    if (!test.title || !test.gradeId || !Array.isArray(test.participants || test.activeStudents)) {
      res.status(400).json({ error: 'بيانات الاختبار غير مكتملة أو غير صالحة' });
      return;
    }
    current.unshift(test); // newest first
  }
  saveTestSessions(current);
  res.json({ success: true, count: current.length, tests: current });
});

// 10. Delete a test session (Protected: Admin Auth Required)
app.delete('/api/school/tests/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const current = loadTestSessions();
  const filtered = current.filter(t => t.id !== id);
  saveTestSessions(filtered);
  res.json({ success: true, count: filtered.length });
});

// 11. Clear test sessions (Protected: Admin Auth Required)
app.delete('/api/school/tests', requireAdminAuth, (req: Request, res: Response) => {
  saveTestSessions([]);
  res.json({ success: true, count: 0 });
});

// 12. Create complete database backup (Protected: Admin Auth Required)
app.get('/api/admin/backup', requireAdminAuth, (req: Request, res: Response) => {
  const students = loadSchoolStudents();
  const tests = loadTestSessions();
  const activeRooms = Object.values(rooms).map(r => ({
    id: r.id,
    title: r.title,
    createdAt: r.createdAt,
    status: r.status
  }));

  res.json({
    timestamp: Date.now(),
    date: new Date().toISOString(),
    school: 'مدارس رياض الإبداع',
    counts: {
      students: students.length,
      tests: tests.length,
      rooms: activeRooms.length
    },
    students,
    tests
  });
});

// 13. System Health & Storage Status (Protected: Admin Auth Required)
app.get('/api/admin/health', requireAdminAuth, (req: Request, res: Response) => {
  const students = loadSchoolStudents();
  const tests = loadTestSessions();
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    storage: {
      type: 'hybrid-file-memory',
      studentsCount: students.length,
      testsCount: tests.length,
      roomsCount: Object.keys(rooms).length
    },
    nodeEnv: process.env.NODE_ENV || 'development',
    isVercel: Boolean(process.env.VERCEL)
  });
});

// Serve web app only in standalone / local server (not inside Vercel serverless functions)
if (!process.env.VERCEL) {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res) => {
      const url = req.originalUrl;
      try {
        const indexPath = join(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        res.status(500).end((e as Error).message);
      }
    });
  }
}

// Determine port: In AI Studio and Cloud Run, Nginx binds 8080 and proxies to port 3000.
// Dev server must always bind to 3000 (never 8080) to avoid EADDRINUSE.
const args = process.argv.slice(2);
const portArgIndex = args.indexOf('--port');
const portFromArgs = portArgIndex !== -1 && args[portArgIndex + 1] ? parseInt(args[portArgIndex + 1], 10) : null;
const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
const port = portFromArgs || (envPort && envPort !== 8080 ? envPort : 3000);

if (!process.env.VERCEL) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;
