import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import type { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// Enable CORS for all origins so external devices, phones, and friends can access without restriction
app.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

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
}

const rooms: Record<string, Room> = {};

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

  const selectedCandidates = shuffle(candidates).slice(0, count);

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
      }
    }
    return;
  }

  // If playing, check if all active students have answered current question
  if (room.status === 'playing') {
    const studentList = Object.values(room.students);
    if (studentList.length > 0) {
      const allAnswered = studentList.every(s =>
        s.answers.some(a => a.questionIndex === room.currentQuestionIndex)
      );

      // Or if question timer expired (e.g. timePerQuestion + 2s buffer)
      const timeoutExpired = (now - room.questionStartedAt) > ((room.config.timePerQuestion + 2) * 1000);

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
    createdAt: Date.now()
  };

  res.json({ roomId, room: rooms[roomId] });
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

// 2. Get room details (with auto-advancing check)
app.get('/api/rooms/:roomId', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  updateRoomState(room);
  res.json(room);
});

// 3. Join room
app.post('/api/rooms/:roomId/join', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { name } = req.body;
  const room = rooms[roomId.toUpperCase()];

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

  res.json({ success: true, room });
});

// 4. Start room manually (for teacher or host)
app.post('/api/rooms/:roomId/start', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  room.status = 'playing';
  room.currentQuestionIndex = 0;
  room.questionStartedAt = Date.now();
  res.json({ success: true, room });
});

// 5. Submit answer (instant score calculation & 3s intermission trigger)
app.post('/api/rooms/:roomId/answer', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { name, questionIndex, selectedOption, timeRemaining } = req.body;
  const room = rooms[roomId.toUpperCase()];

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
    const base = 10;
    const speedRatio = Math.max(0, Math.min(1, (timeRemaining || 0) / room.config.timePerQuestion));
    const speedBonus = Math.round(speedRatio * 5);
    const streakBonus = Math.min(student.streak * 2, 6);
    pointsEarned = base + speedBonus + streakBonus;
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

// 6. Reset or end room
app.post('/api/rooms/:roomId/end', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = rooms[roomId.toUpperCase()];
  if (room) {
    room.status = 'finished';
  }
  res.json({ success: true, room });
});

// 7. Advance / Skip to next question immediately by teacher
app.post('/api/rooms/:roomId/next', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  const now = Date.now();
  if (room.currentQuestionIndex + 1 < room.questions.length) {
    room.currentQuestionIndex += 1;
    room.status = 'playing';
    room.questionStartedAt = now;
  } else {
    room.status = 'finished';
  }
  res.json({ success: true, room });
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

const SCHOOL_DATA_FILE = join(__dirname, 'school_students.json');

function loadSchoolStudents(): SchoolStudent[] {
  try {
    if (fs.existsSync(SCHOOL_DATA_FILE)) {
      const data = fs.readFileSync(SCHOOL_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to read school_students.json:', e);
  }
  return [];
}

function saveSchoolStudents(list: SchoolStudent[]) {
  try {
    fs.writeFileSync(SCHOOL_DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save school_students.json:', e);
  }
}

// 1. Get school students
app.get('/api/school/students', (req: Request, res: Response) => {
  const students = loadSchoolStudents();
  res.json({ students });
});

// 2. Batch upload / replace students
app.post('/api/school/students/batch', (req: Request, res: Response) => {
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

// 3. Add or update single student
app.post('/api/school/students', (req: Request, res: Response) => {
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

// 4. Delete student
app.delete('/api/school/students/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const current = loadSchoolStudents();
  const filtered = current.filter(s => s.id !== id);
  saveSchoolStudents(filtered);
  res.json({ success: true, count: filtered.length });
});

// 5. Clear all students
app.delete('/api/school/students', (req: Request, res: Response) => {
  saveSchoolStudents([]);
  res.json({ success: true, count: 0 });
});

// 6. Record game participation results into school roster
app.post('/api/school/record-game', (req: Request, res: Response) => {
  const { results } = req.body;
  if (!Array.isArray(results)) {
    res.status(400).json({ error: 'نتائج غير صالحة' });
    return;
  }
  const current = loadSchoolStudents();
  let updatedCount = 0;

  for (const item of results) {
    const student = current.find(s => s.name.trim() === (item.name || '').trim());
    if (student) {
      student.totalScore = (student.totalScore || 0) + (item.score || 0);
      student.correctCount = (student.correctCount || 0) + (item.correctCount || 0);
      student.totalAnswered = (student.totalAnswered || 0) + (item.totalAnswered || 0);
      student.participationCount = (student.participationCount || 0) + 1;
      student.bestStreak = Math.max(student.bestStreak || 0, item.streak || 0);
      student.lastActiveDate = 'اليوم';

      // Update level based on score
      if (student.totalScore > 1000) student.level = 5;
      else if (student.totalScore > 600) student.level = 4;
      else if (student.totalScore > 300) student.level = 3;
      else if (student.totalScore > 100) student.level = 2;
      else student.level = 1;

      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    saveSchoolStudents(current);
  }
  res.json({ success: true, updatedCount });
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

// Serve web app
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
