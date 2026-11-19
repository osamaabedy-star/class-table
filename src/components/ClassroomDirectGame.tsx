import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Timer, 
  Users, 
  ArrowRight, 
  RotateCcw, 
  Award, 
  CheckCircle2, 
  XCircle, 
  Volume2, 
  VolumeX, 
  Play, 
  UserPlus, 
  Trash2,
  Check,
  Search,
  Shuffle,
  GraduationCap,
  Upload,
  X,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  Flame,
  Sparkles,
  Swords,
  Database,
  FileDown,
  SkipForward,
  Coffee,
  Pause,
  PlayCircle,
  Plus,
  Minus,
  TrendingUp,
  Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/audio';
import { toHindi } from '../utils/format';
import { 
  SCHOOL_GRADES, 
  SchoolStudent, 
  loadSavedStudents, 
  saveStudentsList,
  parsePastedStudentNames,
  recordGameParticipation,
  fetchSchoolStudentsFromServer 
} from '../data/students';
import { 
  recordTestSessionToDatabase, 
  fetchTestSessionsFromServer, 
  TestSessionRecord, 
  exportTestDatabaseToExcel 
} from '../data/testDatabase';
import { RiyadhEbdaaLogo } from './RiyadhEbdaaLogo';
import { RouletteWheelModal } from './RouletteWheelModal';
import { analyzeCompetitionResults, QuestionAttemptLog } from '../utils/competitionAnalytics';
import { SmartCompetitionReport } from './SmartCompetitionReport';

interface Question {
  a: number;
  b: number;
  table: number;
  operation: '×' | '÷';
  answer: number;
  options: number[];
}

interface StudentParticipant {
  id: string;
  name: string;
  score: number;
  correctAnswers: number;
  totalAnswered: number;
  eliminated?: boolean;
  totalTimeSpent?: number;
  questionLogs?: QuestionAttemptLog[];
}

interface ClassroomDirectGameProps {
  onBack: () => void;
  onOpenCertificate: (name: string, score: number, correct: number, total: number, rank?: number) => void;
}

export const ClassroomDirectGame: React.FC<ClassroomDirectGameProps> = ({
  onBack,
  onOpenCertificate
}) => {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'intermission' | 'finished'>('setup');
  const [selectedTables, setSelectedTables] = useState<number[]>([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const [opMode, setOpMode] = useState<'multi' | 'divi' | 'mixed'>('multi');
  const [timeLimit, setTimeLimit] = useState<number>(10);
  const [soundOn, setSoundOn] = useState<boolean>(true);

  // New Modes: Sudden Death, Adaptive Difficulty, Projector Mode, Roulette
  const [competitionType, setCompetitionType] = useState<'points' | 'sudden_death'>('points');
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState<boolean>(false);
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(false);
  const [isRouletteOpen, setIsRouletteOpen] = useState<boolean>(false);

  // Student list loaded from persistent storage (zero defaults)
  const [studentsList, setStudentsList] = useState<SchoolStudent[]>(() => loadSavedStudents());

  // Fetch updated student roster from server on mount
  useEffect(() => {
    fetchSchoolStudentsFromServer().then(list => {
      if (list && list.length > 0) {
        setStudentsList(list);
      }
    });
  }, []);

  // Grade & Section filtering
  const [selectedGradeId, setSelectedGradeId] = useState<string>('grade3');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected students mapping
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Test Database States (for subsequent analysis)
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState<boolean>(false);
  const [savedTestsList, setSavedTestsList] = useState<TestSessionRecord[]>([]);
  const [selectedTestDetail, setSelectedTestDetail] = useState<TestSessionRecord | null>(null);

  const loadTests = () => {
    fetchTestSessionsFromServer().then(tests => {
      if (tests) setSavedTestsList(tests);
    });
  };

  useEffect(() => {
    loadTests();
  }, [isDatabaseModalOpen]);

  // Upload/Paste Roster Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadText, setUploadText] = useState<string>('');
  const [uploadGradeId, setUploadGradeId] = useState<string>('grade3');
  const [uploadSection, setUploadSection] = useState<string>('أ');

  // Single student quick add input
  const [singleStudentName, setSingleStudentName] = useState<string>('');

  // Active student participants for the current game
  const [activeStudents, setActiveStudents] = useState<StudentParticipant[]>([]);

  // Active game indices
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number>(0);
  const [roundsPerStudent, setRoundsPerStudent] = useState<number>(2);
  const [currentRound, setCurrentRound] = useState<number>(1);

  // Active question & 3-second intermission
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [lastCorrect, setLastCorrect] = useState<boolean>(false);
  const [intermissionTimer, setIntermissionTimer] = useState<number>(3);

  // Break & Question Pool tracking (لا تتكرر الأسئلة إلا إذا استُنفدت كل الاحتمالات + استراحة كل 10 أسئلة)
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [questionPoolIndex, setQuestionPoolIndex] = useState<number>(0);
  const [totalQuestionsAnsweredCount, setTotalQuestionsAnsweredCount] = useState<number>(0);
  const [isBreakPending, setIsBreakPending] = useState<boolean>(false);
  const [isBreakActive, setIsBreakActive] = useState<boolean>(false);
  const [breakInterval, setBreakInterval] = useState<number>(10);

  // Live animations & rank overtake celebration state
  const [rankDeltas, setRankDeltas] = useState<Record<string, number>>({});
  const [justScoredId, setJustScoredId] = useState<string | null>(null);
  const [overtakeEvent, setOvertakeEvent] = useState<{
    studentName: string;
    newRank: number;
    delta: number;
    isNewLeader: boolean;
    overtakenName?: string;
  } | null>(null);
  const overtakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sounds.enabled = soundOn;
  }, [soundOn]);

  // Persist students on list update
  useEffect(() => {
    saveStudentsList(studentsList);
  }, [studentsList]);

  // Filter students based on grade, section, and search
  const visibleStudents = useMemo(() => {
    return studentsList.filter(s => {
      if (s.gradeId !== selectedGradeId) return false;
      if (selectedSection !== 'all' && s.section !== selectedSection) return false;
      if (searchQuery.trim() && !s.name.includes(searchQuery.trim())) return false;
      return true;
    });
  }, [studentsList, selectedGradeId, selectedSection, searchQuery]);

  // Helper to sort participants deterministically with percentage & speed tiebreaker
  const sortParticipants = (list: StudentParticipant[]) => {
    return [...list].map(s => {
      const pct = s.totalAnswered > 0 ? Math.round((s.correctAnswers / s.totalAnswered) * 100) : 0;
      return { ...s, percentage: pct };
    }).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.totalTimeSpent ?? 9999;
      const bTime = b.totalTimeSpent ?? 9999;
      if (Math.abs(aTime - bTime) > 0.05) return aTime - bTime;
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return b.correctAnswers - a.correctAnswers;
    });
  };

  // Ranked participants list (re-sorted automatically after every question with percentage & time tiebreaker)
  const rankedActiveStudents = useMemo(() => {
    return sortParticipants(activeStudents);
  }, [activeStudents]);

  // Smart competition analysis for end-of-game report
  const competitionSmartAnalysis = useMemo(() => {
    return analyzeCompetitionResults(rankedActiveStudents, selectedTables, opMode);
  }, [rankedActiveStudents, selectedTables, opMode]);

  // Remaining questions after the current active question finishes
  const remainingAfterCurrentQuestion = useMemo(() => {
    if (activeStudents.length === 0) return 0;
    const standingCount = activeStudents.filter(s => !s.eliminated).length;
    const remainingInRound = activeStudents.slice(currentStudentIndex + 1).filter(s => !s.eliminated).length;
    const remainingFutureRounds = Math.max(0, roundsPerStudent - currentRound);
    return remainingInRound + remainingFutureRounds * standingCount;
  }, [activeStudents, currentStudentIndex, currentRound, roundsPerStudent]);

  // Auto-select students when switching grade if none selected yet
  useEffect(() => {
    if (selectedStudentIds.size === 0 && visibleStudents.length > 0) {
      const initial = visibleStudents.slice(0, 6).map(s => s.id);
      setSelectedStudentIds(new Set(initial));
    }
  }, [selectedGradeId, visibleStudents]);

  const toggleStudentSelection = (id: string) => {
    sounds.playTap();
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    sounds.playTap();
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      visibleStudents.forEach(s => next.add(s.id));
      return next;
    });
  };

  const clearVisibleSelection = () => {
    sounds.playTap();
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      visibleStudents.forEach(s => next.delete(s.id));
      return next;
    });
  };

  const selectRandomVisible = (count: number = 6) => {
    sounds.playTap();
    const shuffled = [...visibleStudents].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, Math.min(count, visibleStudents.length));
    setSelectedStudentIds(new Set(picked.map(s => s.id)));
  };

  // Add single student
  const handleAddSingleStudent = () => {
    const trimmed = singleStudentName.trim();
    if (!trimmed) return;
    sounds.playTap();
    const newStudent: SchoolStudent = {
      id: `std-${Date.now()}`,
      name: trimmed,
      gradeId: selectedGradeId,
      gradeName: SCHOOL_GRADES.find(g => g.id === selectedGradeId)?.name || 'الصف',
      section: selectedSection === 'all' ? 'أ' : selectedSection,
      level: 1,
      participationCount: 0,
      lastActiveDate: 'جديد',
      totalScore: 0,
      correctCount: 0,
      totalAnswered: 0,
      bestStreak: 0
    };
    setStudentsList(prev => [...prev, newStudent]);
    setSelectedStudentIds(prev => new Set(prev).add(newStudent.id));
    setSingleStudentName('');
  };

  // Batch import pasted student names
  const handleImportStudents = () => {
    const trimmed = uploadText.trim();
    if (!trimmed) return;
    sounds.playTap();
    const imported = parsePastedStudentNames(trimmed, uploadGradeId, uploadSection);
    if (imported.length > 0) {
      setStudentsList(prev => [...prev, ...imported]);
      setSelectedGradeId(uploadGradeId);
      setSelectedSection(uploadSection);
      setSelectedStudentIds(prev => {
        const next = new Set(prev);
        imported.forEach(s => next.add(s.id));
        return next;
      });
      setUploadText('');
      setIsUploadModalOpen(false);
    }
  };

  // Delete all students
  const handleClearAllStudents = () => {
    if (window.confirm('هل تريد مسح جميع أسماء الطلاب المسجلة؟')) {
      sounds.playTap();
      setStudentsList([]);
      setSelectedStudentIds(new Set());
    }
  };

  // Delete individual student
  const handleDeleteStudent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playTap();
    setStudentsList(prev => prev.filter(s => s.id !== id));
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleTable = (num: number) => {
    setSelectedTables(prev => {
      if (prev.includes(num)) {
        if (prev.length <= 1) return prev;
        return prev.filter(n => n !== num);
      }
      return [...prev, num].sort((a, b) => a - b);
    });
  };

  // إنشاء بنك الأسئلة الشامل دون تكرار لأي جدول أو مسألة
  const buildComprehensiveQuestionPool = (): Question[] => {
    const valid = selectedTables.length > 0 ? selectedTables : [2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rawCandidates: Array<{ a: number; b: number; table: number; operation: '×' | '÷'; answer: number }> = [];

    for (const table of valid) {
      for (let factor = 1; factor <= 12; factor++) {
        if (opMode === 'multi' || opMode === 'mixed') {
          rawCandidates.push({
            a: table,
            b: factor,
            table,
            operation: '×',
            answer: table * factor
          });
        }
        if (opMode === 'divi' || opMode === 'mixed') {
          const product = table * factor;
          rawCandidates.push({
            a: product,
            b: table,
            table,
            operation: '÷',
            answer: factor
          });
        }
      }
    }

    // خلط الأسئلة عشوائياً (Fisher-Yates)
    const shuffled = [...rawCandidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.map(c => {
      const answer = c.answer;
      const opts = new Set<number>([answer]);

      if (c.operation === '÷') {
        const pool = [
          answer + 1, answer - 1, answer + 2, answer - 2,
          answer + 3, answer - 3, c.b + 1, c.b - 1, c.b
        ].filter(x => x > 0 && x !== answer);
        pool.sort(() => Math.random() - 0.5);
        for (const p of pool) {
          opts.add(p);
          if (opts.size >= 4) break;
        }
        let fallback = answer > 3 ? answer - 2 : 1;
        while (opts.size < 4) {
          if (fallback > 0 && fallback !== answer) opts.add(fallback);
          fallback++;
        }
      } else {
        const table = c.a;
        const factor = c.b;
        const pool = [
          answer + table, answer - table, answer + 1, answer - 1,
          answer + 2, answer - 2, answer + 10, answer - 10,
          (table + 1) * factor, (table - 1) * factor,
          table * (factor + 1), table * (factor - 1)
        ].filter(x => x > 0 && x !== answer);
        pool.sort(() => Math.random() - 0.5);
        for (const p of pool) {
          opts.add(p);
          if (opts.size >= 4) break;
        }
        let fallback = answer > 5 ? answer - 4 : 1;
        while (opts.size < 4) {
          if (fallback > 0 && fallback !== answer) opts.add(fallback);
          fallback++;
        }
      }

      return {
        a: c.a,
        b: c.b,
        table: c.table,
        operation: c.operation,
        answer: c.answer,
        options: Array.from(opts).sort(() => Math.random() - 0.5)
      };
    });
  };

  const getNextQuestionFromPool = (currentPool: Question[], currentIndex: number): { q: Question; nextPool: Question[]; nextIndex: number } => {
    let pool = currentPool;
    let idx = currentIndex;

    // إذا انتهت كل الأسئلة في بنك الأسئلة بالكامل، نعيد خلط وإنشاء بنك جديد حتى لا تتكرر إلا عند استنفاد الكل
    if (pool.length === 0 || idx >= pool.length) {
      pool = buildComprehensiveQuestionPool();
      idx = 0;
    }

    const q = pool[idx];
    return {
      q,
      nextPool: pool,
      nextIndex: idx + 1
    };
  };

  const generateSingleQuestion = (): Question => {
    const res = getNextQuestionFromPool(questionPool, questionPoolIndex);
    setQuestionPool(res.nextPool);
    setQuestionPoolIndex(res.nextIndex);
    return res.q;
  };

  const startClassCompetition = () => {
    sounds.playTap();
    const chosenList = studentsList
      .filter(s => selectedStudentIds.has(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        score: 0,
        correctAnswers: 0,
        totalAnswered: 0,
        totalTimeSpent: 0,
        eliminated: false,
        questionLogs: []
      }));

    if (chosenList.length === 0) return;

    // تهيئة بنك الأسئلة الشامل دون تكرار
    const initialPool = buildComprehensiveQuestionPool();
    const firstQ = initialPool[0];

    setQuestionPool(initialPool);
    setQuestionPoolIndex(1);
    setTotalQuestionsAnsweredCount(0);
    setIsBreakPending(false);
    setIsBreakActive(false);
    setRankDeltas({});
    setJustScoredId(null);
    setOvertakeEvent(null);

    setActiveStudents(chosenList);
    setCurrentStudentIndex(0);
    setCurrentRound(1);
    setCurrentQ(firstQ);
    setTimeLeft(timeLimit);
    setIsAnswered(false);
    setSelectedOption(null);
    setGameState('playing');
  };

  // Question Timer
  useEffect(() => {
    if (gameState !== 'playing' || isAnswered) return;

    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        if (timeLeft <= 4) sounds.playTick(true);
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      handleOptionSelect(-9999);
    }
  }, [timeLeft, gameState, isAnswered]);

  const handleOptionSelect = (option: number) => {
    if (isAnswered || !currentQ) return;
    setIsAnswered(true);
    setSelectedOption(option);

    const isCorrect = option === currentQ.answer;
    setLastCorrect(isCorrect);
    sounds.playPraiseVoice(isCorrect);

    // Calculate exact time taken for this answer
    const timeSpent = Math.max(0.1, Number((timeLimit - Math.max(0, timeLeft)).toFixed(1)));
    const actingStudent = activeStudents[currentStudentIndex];

    // Snapshot ranks BEFORE updating score to detect real-time overtakes
    const prevSorted = sortParticipants(activeStudents);
    const prevRankMap = new Map<string, number>();
    prevSorted.forEach((st, i) => prevRankMap.set(st.id, i));

    const attemptLog: QuestionAttemptLog = {
      table: currentQ.table,
      operation: currentQ.operation,
      questionText: `${toHindi(currentQ.a)} ${currentQ.operation} ${toHindi(currentQ.b)}`,
      correctAnswer: currentQ.answer,
      selectedOption: option === -9999 ? null : option,
      isCorrect,
      timeSpent
    };

    const updatedStudents = activeStudents.map((s, idx) => {
      if (idx !== currentStudentIndex) return s;
      const nextLogs = [...(s.questionLogs || []), attemptLog];
      if (isCorrect) {
        return {
          ...s,
          score: s.score + 1,
          correctAnswers: s.correctAnswers + 1,
          totalAnswered: s.totalAnswered + 1,
          totalTimeSpent: Number(((s.totalTimeSpent || 0) + timeSpent).toFixed(1)),
          questionLogs: nextLogs
        };
      }
      return {
        ...s,
        totalAnswered: s.totalAnswered + 1,
        totalTimeSpent: Number(((s.totalTimeSpent || 0) + timeSpent).toFixed(1)),
        eliminated: competitionType === 'sudden_death' ? true : s.eliminated,
        questionLogs: nextLogs
      };
    });

    setActiveStudents(updatedStudents);

    if (isCorrect && actingStudent) {
      sounds.playCorrect();
      setJustScoredId(actingStudent.id);

      const nextSorted = sortParticipants(updatedStudents);
      const prevRank = prevRankMap.get(actingStudent.id);
      const newRank = nextSorted.findIndex(st => st.id === actingStudent.id);

      if (prevRank !== undefined && newRank !== -1 && newRank < prevRank) {
        const delta = prevRank - newRank;
        const overtakenStudent = prevSorted[newRank];
        const isNewLeader = newRank === 0;

        setRankDeltas({ [actingStudent.id]: delta });
        setOvertakeEvent({
          studentName: actingStudent.name,
          newRank,
          delta,
          isNewLeader,
          overtakenName: overtakenStudent && overtakenStudent.id !== actingStudent.id ? overtakenStudent.name : undefined
        });

        if (overtakeTimeoutRef.current) clearTimeout(overtakeTimeoutRef.current);
        overtakeTimeoutRef.current = setTimeout(() => {
          setRankDeltas({});
          setOvertakeEvent(null);
          setJustScoredId(null);
        }, 4200);

        // Extra celebratory confetti burst on overtaking competitors!
        confetti({
          particleCount: isNewLeader ? 85 : 55,
          spread: isNewLeader ? 90 : 65,
          origin: { y: 0.55 },
          colors: ['#fbbf24', '#34d399', '#38bdf8', '#f59e0b']
        });
      } else {
        setOvertakeEvent(null);
        setRankDeltas({});
        if (overtakeTimeoutRef.current) clearTimeout(overtakeTimeoutRef.current);
        overtakeTimeoutRef.current = setTimeout(() => {
          setJustScoredId(null);
        }, 2800);

        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#34d399', '#fbbf24', '#a7f3d0']
        });
      }
    } else {
      sounds.playWrong();
      setJustScoredId(null);
      setOvertakeEvent(null);
    }

    const nextCount = totalQuestionsAnsweredCount + 1;
    setTotalQuestionsAnsweredCount(nextCount);

    // حساب عدد الأسئلة المتبقية بدقة بعد هذا السؤال (يجب أن يتبقى >= 5 أسئلة على الأقل لظهور الاستراحة)
    const standingAfter = updatedStudents.filter(s => !s.eliminated);
    const remainingInRound = updatedStudents.slice(currentStudentIndex + 1).filter(s => !s.eliminated).length;
    const remainingFutureRounds = Math.max(0, roundsPerStudent - currentRound);
    const remainingQuestionsAfterThis =
      competitionType === 'sudden_death' && standingAfter.length <= 1 && updatedStudents.length > 1
        ? 0
        : remainingInRound + remainingFutureRounds * standingAfter.length;

    const canTakeBreak = remainingQuestionsAfterThis >= 5;
    const shouldBreak = canTakeBreak && (isBreakPending || (breakInterval > 0 && nextCount % breakInterval === 0));

    if (shouldBreak) {
      setIsBreakPending(false);
      setIsBreakActive(true);
      setIntermissionTimer(2);
      setGameState('intermission');
    } else {
      if (!canTakeBreak) setIsBreakPending(false);
      setIntermissionTimer(2);
      setGameState('intermission');
    }
  };

  // Intermission countdown (auto-advances to next student/question or enters break)
  useEffect(() => {
    if (gameState !== 'intermission') return;

    if (intermissionTimer > 0) {
      const t = setTimeout(() => {
        sounds.playTick(false);
        setIntermissionTimer(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearTimeout(t);
    } else {
      // إذا كانت الاستراحة مفعلة، ننتقل لشاشة الاستراحة ونوقف المؤقت حتى يضغط المعلم استئناف
      if (isBreakActive) {
        // يبقى في حالة الاستراحة حتى يضغط المعلم زر المتابعة
      } else {
        advanceNextTurn();
      }
    }
  }, [intermissionTimer, gameState, isBreakActive]);

  const resumeFromBreak = () => {
    sounds.playTap();
    setIsBreakActive(false);
    advanceNextTurn();
  };

  const finishGame = () => {
    try {
      // Update stats for all participating students in localStorage
      setStudentsList(prev => {
        const participantMap = new Map(activeStudents.map(a => [a.id, a]));
        return prev.map(std => {
          const match = participantMap.get(std.id);
          if (match) {
            const newCount = (std.participationCount || 0) + 1;
            const newLevel = Math.min(5, Math.max(1, Math.floor(match.correctAnswers) + 1));
            return {
              ...std,
              participationCount: newCount,
              lastActiveDate: 'اليوم',
              level: newLevel
            };
          }
          return std;
        });
      });

      // Generate a unique idempotent round ID for this test session
      const directRoundId = `direct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // Record to server for admin analytics & honor rolls with roundId
      recordGameParticipation(activeStudents.map(a => ({
        name: a.name,
        score: a.score,
        correctCount: a.correctAnswers,
        totalAnswered: a.totalAnswered,
        streak: a.correctAnswers
      })), directRoundId).catch(() => {});

      // Record complete test session to test database for deep analysis
      const totalCorrect = activeStudents.reduce((acc, s) => acc + s.correctAnswers, 0);
      const totalAns = activeStudents.reduce((acc, s) => acc + s.totalAnswered, 0);
      const avgAccuracy = totalAns > 0 ? Math.round((totalCorrect / totalAns) * 100) : 0;
      const topStd = rankedActiveStudents[0];

      recordTestSessionToDatabase({
        id: directRoundId,
        title: `اختبار ${SCHOOL_GRADES.find(g => g.id === selectedGradeId)?.name || 'الصف'} (${selectedSection === 'all' ? 'جميع الشعب' : `شعبة ${selectedSection}`})`,
        gradeId: selectedGradeId,
        gradeName: SCHOOL_GRADES.find(g => g.id === selectedGradeId)?.name || 'الصف الدراسي',
        section: selectedSection === 'all' ? 'جميع الشعب' : selectedSection,
        tables: [...selectedTables],
        opMode,
        timeLimit,
        roundsPerStudent,
        competitionType,
        totalParticipants: activeStudents.length,
        averageAccuracy: avgAccuracy,
        topStudentName: topStd?.name || '—',
        topStudentScore: topStd?.score || 0,
        participants: rankedActiveStudents.map((s, idx) => ({
          id: s.id,
          name: s.name,
          score: s.score,
          correctAnswers: s.correctAnswers,
          totalAnswered: s.totalAnswered,
          percentage: s.percentage,
          rank: idx + 1,
          eliminated: s.eliminated,
          timeSpent: Number((s.totalTimeSpent || 0).toFixed(1)),
          questionLogs: s.questionLogs || []
        }))
      });
    } catch (e) {
      console.warn('Finish game error:', e);
    }

    try {
      sounds.playFanfare();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    } catch {
      // ignore
    }
    setGameState('finished');
  };

  const advanceNextTurn = () => {
    try {
      if (activeStudents.length === 0) {
        finishGame();
        return;
      }

      // If Sudden Death mode, check if 1 or 0 standing students remain
      if (competitionType === 'sudden_death') {
        const remainingStanding = activeStudents.filter(s => !s.eliminated);
        if (remainingStanding.length <= 1 && activeStudents.length > 1) {
          finishGame();
          return;
        }
      }

      // Find next non-eliminated student in active round
      let nextIdx = currentStudentIndex + 1;
      while (nextIdx < activeStudents.length && activeStudents[nextIdx]?.eliminated) {
        nextIdx++;
      }

      if (nextIdx < activeStudents.length) {
        setCurrentStudentIndex(nextIdx);
        setCurrentQ(generateSingleQuestion());
        setTimeLeft(timeLimit);
        setIsAnswered(false);
        setSelectedOption(null);
        setGameState('playing');
      } else {
        // Next round
        if (currentRound < roundsPerStudent) {
          let firstActive = 0;
          while (firstActive < activeStudents.length && activeStudents[firstActive]?.eliminated) {
            firstActive++;
          }
          if (firstActive >= activeStudents.length) {
            finishGame();
            return;
          }
          setCurrentRound(prev => prev + 1);
          setCurrentStudentIndex(firstActive);
          setCurrentQ(generateSingleQuestion());
          setTimeLeft(timeLimit);
          setIsAnswered(false);
          setSelectedOption(null);
          setGameState('playing');
        } else {
          finishGame();
        }
      }
    } catch (err) {
      console.error('Error in advanceNextTurn:', err);
      // Failsafe: force next question
      setCurrentQ(generateSingleQuestion());
      setTimeLeft(timeLimit);
      setIsAnswered(false);
      setSelectedOption(null);
      setGameState('playing');
    }
  };

  const currentStudent = activeStudents[currentStudentIndex] || {
    id: 'placeholder',
    name: 'الطالب',
    score: 0,
    correctAnswers: 0,
    totalAnswered: 0,
    percentage: 0,
    eliminated: false
  };
  const nextStudent = activeStudents[(currentStudentIndex + 1) % (activeStudents.length || 1)] || currentStudent;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between selection:bg-amber-500">
      {/* Top Header */}
      <header className={`border-b border-slate-800 bg-slate-950/90 backdrop-blur-md flex items-center justify-between ${
        gameState === 'playing' ? 'py-1.5 px-3 md:px-5' : 'py-2 px-3 md:px-6'
      }`}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-xs font-bold"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>الرئيسية</span>
          </button>
          
          <RiyadhEbdaaLogo size="sm" />
        </div>

        <div className="text-center">
          <span className="text-xs md:text-sm font-black text-amber-400">
            مسابقة السبورة الصفية
          </span>
        </div>

        <div className="flex items-center gap-2">
          {gameState === 'setup' && (
            <button
              onClick={() => { sounds.playTap(); setIsDatabaseModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-black border border-amber-500/30 transition-all shadow-sm"
              title="عرض قاعدة بيانات الاختبارات السابقة والتحليلات"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>قاعدة البيانات 💾</span>
            </button>
          )}

          {(gameState === 'playing' || gameState === 'intermission') && (
            <button
              onClick={() => setIsProjectorMode(!isProjectorMode)}
              className={`px-2.5 py-1 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 shadow-sm ${
                isProjectorMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title="تكبير الشاشة للبروجكتر والعرض الكامل"
            >
              {isProjectorMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isProjectorMode ? 'إلغاء البروجكتر' : 'وضع البروجكتر 📽️'}</span>
            </button>
          )}

          <button
            onClick={() => setSoundOn(!soundOn)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className={`flex-1 flex flex-col items-center justify-center max-w-6xl mx-auto w-full ${
        gameState === 'playing' ? 'p-1.5 overflow-hidden' : 'p-3 md:p-5'
      }`}>
        {/* SETUP SCREEN: ELEGANT, UNCLUTTERED, PROFESSIONAL LAYOUT */}
        {gameState === 'setup' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="report-hide-on-print w-full space-y-3.5"
          >
            {/* Minimalist Header Bar */}
            <div className="bg-slate-900/80 border border-slate-800/80 px-4 py-2 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-white">
                    إعداد مسابقة السبورة الصفية
                  </h2>
                  <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                    حدد الطلاب من القائمة الجانبية واختر معايير الجداول
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/25 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع ولصق أسماء</span>
                </button>
              </div>
            </div>

            {/* MAIN 2-COLUMN LAYOUT:
                RIGHT: Slim, neat student sidebar (260px)
                LEFT: Structured test configuration panels */}
            <div className="flex flex-col lg:flex-row gap-3.5 items-start">
              
              {/* 1. RIGHT SIDEBAR: COMPACT, NEAT STUDENT ROSTER */}
              <div className="w-full lg:w-64 xl:w-72 shrink-0 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 space-y-2 shadow-lg">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <h3 className="text-xs font-black text-white">
                      قائمة الطلاب ({toHindi(visibleStudents.length)})
                    </h3>
                  </div>

                  <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {toHindi(selectedStudentIds.size)} محدد
                  </span>
                </div>

                {/* Quick Selection Buttons */}
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={selectAllVisible}
                    className="py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition-colors"
                  >
                    تحديد الكل
                  </button>
                  <button
                    onClick={clearVisibleSelection}
                    className="py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-[10px] font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={() => selectRandomVisible(4)}
                    className="py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-[10px] font-bold flex items-center justify-center gap-0.5 transition-colors border border-indigo-500/20"
                    title="اختيار عشوائي لـ 4 طلاب"
                  >
                    <Shuffle className="w-2.5 h-2.5" />
                    <span>عشوائي</span>
                  </button>
                  <button
                    onClick={() => { sounds.playTap(); setIsRouletteOpen(true); }}
                    disabled={visibleStudents.length === 0}
                    className="py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-bold disabled:opacity-40 transition-colors border border-amber-500/20 flex items-center justify-center gap-0.5"
                    title="عجلة الحظ التفاعلية"
                  >
                    <span>🎡 قرعة</span>
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="بحث سريع بالاسم..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-7 pl-2 py-1 text-xs text-white outline-none focus:border-amber-400 placeholder:text-slate-500 transition-colors"
                  />
                </div>

                {/* Clean, compact scrollable student items */}
                <div className="space-y-1 max-h-[360px] overflow-y-auto p-1 bg-slate-950/60 rounded-xl border border-slate-800/60 custom-scrollbar">
                  {visibleStudents.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500 font-medium">
                      لا يوجد طلاب مسجلون في هذا الصف
                    </div>
                  ) : (
                    visibleStudents.map(student => {
                      const isSelected = selectedStudentIds.has(student.id);
                      return (
                        <div
                          key={student.id}
                          onClick={() => toggleStudentSelection(student.id)}
                          className={`px-2 py-1.5 rounded-lg cursor-pointer flex items-center justify-between gap-1.5 transition-all border text-right ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 font-black shadow-xs'
                              : 'bg-slate-900/50 border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                              isSelected ? 'bg-amber-500 border-amber-400 text-slate-950' : 'border-slate-700 bg-slate-800'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span className="text-xs truncate">{student.name}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] text-slate-500 font-mono">
                              فصل {student.section || 'أ'}
                            </span>
                            <button
                              onClick={(e) => handleDeleteStudent(student.id, e)}
                              className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quick Add Inline */}
                <div className="pt-1 flex gap-1 border-t border-slate-800/80">
                  <input
                    type="text"
                    placeholder="إضافة طالب سريعاً..."
                    value={singleStudentName}
                    onChange={e => setSingleStudentName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSingleStudent()}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
                  />
                  <button
                    onClick={handleAddSingleStudent}
                    disabled={!singleStudentName.trim()}
                    className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-black transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 2. MAIN CONFIGURATION AREA: CLEAN 3-STEP ORGANIZED CARDS */}
              <div className="flex-1 w-full space-y-3">
                
                {/* البطاقة ١: الصف الدراسي والشعبة */}
                <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 shadow-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/70">
                    <span className="text-xs font-black text-amber-400">
                      ١. اختيار الصف الدراسي والشعبة
                    </span>
                    <span className="text-[11px] text-slate-300 font-bold bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">
                      {SCHOOL_GRADES.find(g => g.id === selectedGradeId)?.name} • {selectedSection === 'all' ? 'جميع الفصول' : `فصل (${selectedSection})`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* الصفوف */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 block">الصف الدراسي:</span>
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80">
                        {SCHOOL_GRADES.map(grade => (
                          <button
                            key={grade.id}
                            type="button"
                            onClick={() => { sounds.playTap(); setSelectedGradeId(grade.id); }}
                            className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all ${
                              selectedGradeId === grade.id
                                ? 'bg-amber-500 text-slate-950 shadow-xs'
                                : 'text-slate-300 hover:bg-slate-800/80'
                            }`}
                          >
                            {grade.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* الشعب */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 block">الشعبة / الفصل:</span>
                      <div className="grid grid-cols-5 gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80 h-fit">
                        {['all', 'أ', 'ب', 'ج', 'د'].map(sec => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => { sounds.playTap(); setSelectedSection(sec); }}
                            className={`py-2 rounded-lg text-[11px] font-black transition-all ${
                              selectedSection === sec
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                            }`}
                          >
                            {sec === 'all' ? 'الكل' : sec}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* البطاقة ٢: الجداول المختبرة ونوع العملية */}
                <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 shadow-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/70">
                    <span className="text-xs font-black text-amber-400">
                      ٢. جداول الحساب ونوع العمليات
                    </span>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => { sounds.playTap(); setSelectedTables([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); }}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        الكل (٢-١٢)
                      </button>
                      <span className="text-slate-700">•</span>
                      <button
                        type="button"
                        onClick={() => { sounds.playTap(); setSelectedTables([2, 3, 4, 5]); }}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        الأساسية (٢-٥)
                      </button>
                      <span className="text-slate-700">•</span>
                      <button
                        type="button"
                        onClick={() => { sounds.playTap(); setSelectedTables([6, 7, 8, 9, 10]); }}
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        المتقدمة (٦-١٠)
                      </button>
                    </div>
                  </div>

                  {/* الجداول ٢ - ١٢ */}
                  <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { sounds.playTap(); toggleTable(n); }}
                        className={`h-9 rounded-xl font-black text-xs sm:text-sm border transition-all font-mono ${
                          selectedTables.includes(n)
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                            : 'bg-slate-950/80 text-slate-400 border-slate-800/80 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {toHindi(n)}
                      </button>
                    ))}
                  </div>

                  {/* نوع العمليات الحسابية في شريط موحد */}
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80">
                    {[
                      { id: 'multi', label: 'الضرب فقط (×)' },
                      { id: 'divi', label: 'القسمة فقط (÷)' },
                      { id: 'mixed', label: 'مختلط (× و ÷)' }
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { sounds.playTap(); setOpMode(m.id as 'multi' | 'divi' | 'mixed'); }}
                        className={`py-2 px-2 rounded-lg text-xs font-black transition-all text-center ${
                          opMode === m.id
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* البطاقة ٣: معايير الاختبار (عدد الأسئلة، الوقت، النظام، الاستراحة) */}
                <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 shadow-lg space-y-3">
                  <div className="pb-2 border-b border-slate-800/70">
                    <span className="text-xs font-black text-amber-400">
                      ٣. إعدادات الأسئلة والزمن ونظام المسابقة
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* عدد الأسئلة لكل طالب (منزلق + خانة حرة + ٤ اختصارات نظيفة) */}
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
                      <div className="flex justify-between items-center text-xs font-black">
                        <span className="text-slate-300">عدد الأسئلة لكل طالب:</span>
                        <span className="text-amber-400 font-mono text-sm bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                          {toHindi(roundsPerStudent)} أسئلة
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => { sounds.playTap(); setRoundsPerStudent(Math.max(1, roundsPerStudent - 1)); }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                          title="إنقاص سؤال"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={roundsPerStudent}
                          onChange={e => setRoundsPerStudent(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                          className="flex-1 bg-transparent text-center font-mono font-black text-base text-amber-300 outline-none"
                          title="اكتب أي عدد حتى ٢٠٠ سؤال"
                        />
                        <button
                          type="button"
                          onClick={() => { sounds.playTap(); setRoundsPerStudent(Math.min(200, roundsPerStudent + 1)); }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                          title="زيادة سؤال"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={Math.min(100, roundsPerStudent)}
                        onChange={e => setRoundsPerStudent(Number(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />

                      <div className="grid grid-cols-4 gap-1">
                        {[5, 10, 25, 50].map(cnt => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => { sounds.playTap(); setRoundsPerStudent(cnt); }}
                            className={`py-1 rounded-lg text-[11px] font-black font-mono border transition-all ${
                              roundsPerStudent === cnt
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {toHindi(cnt)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* وقت الإجابة لكل سؤال (منزلق + خانة حرة + ٤ اختصارات نظيفة) */}
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
                      <div className="flex justify-between items-center text-xs font-black">
                        <span className="text-slate-300">وقت السؤال (بالثواني):</span>
                        <span className="text-amber-400 font-mono text-sm bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                          {toHindi(timeLimit)} ثانية
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => { sounds.playTap(); setTimeLimit(Math.max(2, timeLimit - 1)); }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                          title="إنقاص ثانية"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="2"
                          max="300"
                          value={timeLimit}
                          onChange={e => setTimeLimit(Math.max(2, Math.min(300, Number(e.target.value) || 2)))}
                          className="flex-1 bg-transparent text-center font-mono font-black text-base text-amber-300 outline-none"
                          title="اكتب الوقت بالثواني"
                        />
                        <button
                          type="button"
                          onClick={() => { sounds.playTap(); setTimeLimit(Math.min(300, timeLimit + 1)); }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                          title="زيادة ثانية"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="range"
                        min="3"
                        max="60"
                        value={Math.min(60, timeLimit)}
                        onChange={e => setTimeLimit(Number(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />

                      <div className="grid grid-cols-4 gap-1">
                        {[5, 10, 15, 30].map(sec => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => { sounds.playTap(); setTimeLimit(sec); }}
                            className={`py-1 rounded-lg text-[11px] font-black font-mono border transition-all ${
                              timeLimit === sec
                                ? 'bg-indigo-600 text-white border-indigo-400'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {toHindi(sec)}ث
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* نظام المنافسة */}
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                      <span className="text-[11px] font-black text-slate-300 block">نظام التنافس:</span>
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => { sounds.playTap(); setCompetitionType('points'); }}
                          className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                            competitionType === 'points'
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          نقاط وجولات 🏆
                        </button>
                        <button
                          type="button"
                          onClick={() => { sounds.playTap(); setCompetitionType('sudden_death'); }}
                          className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                            competitionType === 'sudden_death'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          خروج مغلوب ⚔️
                        </button>
                      </div>
                    </div>

                    {/* جدولة الاستراحة بقائمة أنيقة ومريحة */}
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                      <label className="text-[11px] font-black text-slate-300 flex items-center gap-1">
                        <Coffee className="w-3.5 h-3.5 text-amber-400" />
                        <span>نظام الاستراحة أثناء المسابقة:</span>
                      </label>
                      <select
                        value={breakInterval}
                        onChange={e => { sounds.playTap(); setBreakInterval(Number(e.target.value)); }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-amber-300 outline-none focus:border-amber-400 cursor-pointer"
                      >
                        <option value={10}>تلقائية كل ١٠ أسئلة (مع زر يدوي)</option>
                        <option value={15}>تلقائية كل ١٥ سؤالاً (مع زر يدوي)</option>
                        <option value={20}>تلقائية كل ٢٠ سؤالاً (مع زر يدوي)</option>
                        <option value={0}>يدوية فقط من الزر العلوي</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* شريط الملخص وزر البدء */}
                <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                  <div className="text-xs font-bold text-slate-300 flex flex-wrap items-center gap-2">
                    <span className="text-amber-400 font-black">ملخص الإعداد:</span>
                    <span>{toHindi(selectedStudentIds.size)} طلاب</span>
                    <span className="text-slate-600">•</span>
                    <span>{toHindi(roundsPerStudent)} أسئلة للطالب</span>
                    <span className="text-slate-600">•</span>
                    <span>{toHindi(timeLimit)}ث للسؤال</span>
                  </div>

                  <button
                    onClick={startClassCompetition}
                    disabled={selectedStudentIds.size === 0}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-30 disabled:pointer-events-none text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>بدء المسابقة والاختبار الآن</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ACTIVE PLAYING & INTERMISSION SCREEN (SMART BOARD WITH LIVE REAL-TIME RANKED SIDEBAR) */}
        {(gameState === 'playing' || gameState === 'intermission') && currentStudent && (
          <div className="w-full max-w-7xl flex-1 flex flex-col lg:flex-row gap-3 py-1 items-stretch">
            {/* 1. SIDEBAR: PARTICIPATING STUDENTS WITH REAL-TIME AUTO-SORTED RANKS */}
            <div className="w-full lg:w-72 xl:w-80 bg-slate-900/95 border border-slate-800 rounded-2xl p-3 shadow-xl flex flex-col justify-between shrink-0 order-2 lg:order-1">
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black text-white">ترتيب الطلاب المباشر</h3>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {toHindi(activeStudents.length)} مشارك
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 font-bold pb-2">
                  يتم تحديث الترتيب والنسبة المئوية تلقائياً بعد كل سؤال:
                </div>

                {/* Live Rank Overtake Celebration Banner */}
                <AnimatePresence>
                  {overtakeEvent && (
                    <motion.div
                      initial={{ opacity: 0, y: -12, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: [1, 1.03, 1] }}
                      exit={{ opacity: 0, y: -10, scale: 0.92 }}
                      transition={{ duration: 0.35 }}
                      className={`mb-2.5 p-2.5 rounded-xl border-2 shadow-lg flex items-center gap-2 ${
                        overtakeEvent.isNewLeader
                          ? 'bg-gradient-to-l from-amber-500/25 via-yellow-500/15 to-amber-500/25 border-amber-400 text-amber-200 shadow-amber-500/20'
                          : 'bg-gradient-to-l from-emerald-500/25 via-cyan-500/15 to-emerald-500/25 border-emerald-400 text-emerald-200 shadow-emerald-500/20'
                      }`}
                    >
                      <motion.div
                        animate={{ rotate: [0, -12, 12, 0], scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.6, repeat: 2 }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          overtakeEvent.isNewLeader ? 'bg-amber-400 text-slate-950' : 'bg-emerald-400 text-slate-950'
                        }`}
                      >
                        {overtakeEvent.isNewLeader ? <Crown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      </motion.div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-white truncate">
                          {overtakeEvent.isNewLeader
                            ? `👑 ${overtakeEvent.studentName} يتصدّر اللوحة!`
                            : `🚀 تقدم رائع! ${overtakeEvent.studentName}`}
                        </div>
                        <div className="text-[10px] font-bold opacity-90 truncate">
                          {overtakeEvent.overtakenName
                            ? `تجاوز ${overtakeEvent.overtakenName} إلى المركز ${toHindi(overtakeEvent.newRank + 1)}`
                            : `صعد للمركز ${toHindi(overtakeEvent.newRank + 1)} (+${toHindi(overtakeEvent.delta)})`}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Real-time sorted participant list */}
                <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                  {rankedActiveStudents.map((s, idx) => {
                    const isCurrentTurn = currentStudent.id === s.id;
                    const pct = s.percentage;
                    const climbedDelta = rankDeltas[s.id] || 0;
                    const justScored = justScoredId === s.id;
                    return (
                      <motion.div
                        key={s.id}
                        layout
                        animate={
                          climbedDelta > 0
                            ? { scale: [1, 1.05, 1] }
                            : justScored
                            ? { scale: [1, 1.03, 1] }
                            : { scale: 1 }
                        }
                        transition={{
                          layout: { type: 'spring', stiffness: 420, damping: 24 },
                          scale: { duration: 0.45 }
                        }}
                        className={`relative p-2 rounded-xl border flex items-center justify-between transition-colors ${
                          climbedDelta > 0
                            ? 'bg-gradient-to-l from-emerald-500/25 via-amber-500/15 to-slate-900 border-emerald-400 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/70'
                            : isCurrentTurn
                            ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg ring-1 ring-amber-400/50'
                            : idx === 0
                            ? 'bg-slate-950 border-amber-500/30 text-amber-300'
                            : 'bg-slate-950/70 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className={`w-6 h-6 rounded-lg text-xs font-black font-mono flex items-center justify-center shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950 shadow-sm'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-950'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : toHindi(idx + 1)}
                          </span>
                          <div className="truncate">
                            <div className="flex items-center gap-1">
                              <span className="font-black text-xs text-white truncate max-w-[95px]">{s.name}</span>
                              {climbedDelta > 0 && (
                                <motion.span
                                  initial={{ scale: 0, y: 6 }}
                                  animate={{ scale: 1, y: 0 }}
                                  className="text-[9px] font-black bg-emerald-400 text-slate-950 px-1.5 py-0.2 rounded-full shadow flex items-center gap-0.5 shrink-0"
                                >
                                  ▲ +{toHindi(climbedDelta)}
                                </motion.span>
                              )}
                              {isCurrentTurn && (
                                <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1 py-0.2 rounded animate-pulse shrink-0">
                                  الآن 🎯
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 block font-mono">
                              {toHindi(s.correctAnswers)} / {toHindi(s.totalAnswered)} صحيحة • ⏱ {toHindi((s.totalTimeSpent || 0).toFixed(1))}ث
                            </span>
                          </div>
                        </div>

                        {/* Score & Percentage display */}
                        <div className="text-left shrink-0 pl-1 relative">
                          {justScored && (
                            <motion.span
                              initial={{ opacity: 0, y: 8, scale: 0.7 }}
                              animate={{ opacity: [0, 1, 1, 0], y: [8, -10, -16, -22], scale: [0.8, 1.15, 1, 0.9] }}
                              transition={{ duration: 1.4 }}
                              className="absolute -top-3 left-0 text-[10px] font-black bg-emerald-400 text-slate-950 px-1.5 rounded-full shadow pointer-events-none"
                            >
                              +١ ✨
                            </motion.span>
                          )}
                          <div className="flex items-center gap-1 justify-end font-mono">
                            <span className="text-xs font-black text-amber-400">{toHindi(s.score)} درجات</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-emerald-400 block -mt-0.5">
                            ({toHindi(pct)}٪)
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. MAIN SMARTBOARD ARENA */}
            <div className="flex-1 flex flex-col justify-between space-y-2 order-1 lg:order-2">
              {/* Student Turn Banner */}
              <motion.div
                initial={{ scale: 0.98 }}
                animate={{ scale: 1 }}
                className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-slate-950 shadow-md flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-950 text-amber-400 font-mono font-black text-xs flex items-center justify-center">
                    {toHindi(currentStudentIndex + 1)}
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider block opacity-75 leading-none">
                      دور الطالب:
                    </span>
                    <span className="text-sm sm:text-base font-black block font-['El_Messiri',serif] leading-tight">
                      {currentStudent.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="text-center font-mono bg-slate-950/15 px-2 py-0.5 rounded-lg">
                    <span className="text-[9px] font-black block opacity-75 leading-none">الجولة:</span>
                    <span className="text-xs font-black leading-tight">
                      {toHindi(currentRound)} / {toHindi(roundsPerStudent)}
                    </span>
                  </div>

                  <div className="text-center font-mono bg-slate-950/15 px-2 py-0.5 rounded-lg">
                    <span className="text-[9px] font-black block opacity-75 leading-none">الدرجة:</span>
                    <span className="text-xs sm:text-sm font-black leading-tight text-slate-950">
                      {toHindi(currentStudent.score)} درجات ({toHindi(currentStudent.totalAnswered > 0 ? Math.round((currentStudent.correctAnswers / currentStudent.totalAnswered) * 100) : 0)}٪)
                    </span>
                  </div>

                  <div className={`flex items-center gap-1 font-black text-sm sm:text-base font-mono px-2 py-0.5 rounded-lg bg-slate-950 ${
                    timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-amber-400'
                  }`}>
                    <Timer className="w-3.5 h-3.5" />
                    <span>{toHindi(timeLeft)} ث</span>
                  </div>

                  {/* Break button only shown when >= 10 answered AND >= 5 questions remain */}
                  {totalQuestionsAnsweredCount >= 10 && remainingAfterCurrentQuestion >= 5 && (
                    <button
                      onClick={() => {
                        sounds.playTap();
                        setIsBreakPending(prev => !prev);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                        isBreakPending
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md animate-pulse ring-2 ring-amber-300'
                          : 'bg-slate-950/80 hover:bg-slate-950 text-amber-300 hover:text-white border-amber-500/50'
                      }`}
                      title="تفعيل استراحة في المسابقة بعد إجابة السؤال الحالي"
                    >
                      <Coffee className="w-3.5 h-3.5" />
                      <span>{isBreakPending ? 'استراحة قادمة ⏳' : 'استراحة ☕'}</span>
                    </button>
                  )}

                  {/* Immediate Next Question / Skip Button */}
                  <button
                    onClick={() => {
                      sounds.playTap();
                      advanceNextTurn();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-950 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-black transition-all active:scale-95 cursor-pointer shadow-sm"
                    title="الانتقال للسؤال التالي مباشرة دون انتظار"
                  >
                    <SkipForward className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline">السؤال التالي</span>
                    <span className="sm:hidden">التالي</span>
                  </button>
                </div>
              </motion.div>

              {/* Central Screen: Break Screen OR Intermission OR Active Math Question */}
              {isBreakActive && intermissionTimer === 0 ? (
                /* LARGE BREAK SCREEN (Without showing question) */
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex-1 bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border-2 border-amber-500/50 p-6 sm:p-10 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center space-y-6 my-auto"
                >
                  <div className="relative">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 shadow-2xl shadow-amber-500/20">
                      <Coffee className="w-14 h-14 sm:w-16 sm:h-16 animate-pulse" />
                    </div>
                    <span className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full shadow-lg">
                      وقت الراحة ☕
                    </span>
                  </div>

                  <div className="space-y-3 max-w-xl">
                    <h2 className="text-4xl sm:text-6xl font-black text-amber-400 font-['El_Messiri',serif] tracking-wide drop-shadow-md">
                      استراحة ☕
                    </h2>
                    <p className="text-base sm:text-xl text-slate-200 font-bold leading-relaxed">
                      أخذ قسط من الراحة وتنشيط الأذهان وتجديد النشاط والحماس
                    </p>
                    
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <div className="bg-slate-950/90 border border-amber-500/40 px-4 py-2 rounded-xl text-amber-300 font-mono text-sm font-black shadow-inner">
                        🎯 تم إنجاز: {toHindi(totalQuestionsAnsweredCount)} سؤالاً
                      </div>
                      <div className="bg-slate-950/90 border border-amber-500/40 px-4 py-2 rounded-xl text-emerald-400 font-mono text-sm font-black shadow-inner">
                        👑 متصدر الجولة: {rankedActiveStudents[0]?.name || '—'} ({toHindi(rankedActiveStudents[0]?.score || 0)} ن)
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 w-full max-w-sm">
                    <button
                      onClick={resumeFromBreak}
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 active:scale-95 text-slate-950 font-black text-lg sm:text-xl flex items-center justify-center gap-3 shadow-xl shadow-amber-500/30 cursor-pointer transition-all border-2 border-amber-300 hover:shadow-2xl"
                    >
                      <PlayCircle className="w-7 h-7 fill-slate-950 text-amber-400" />
                      <span>استئناف ومتابعة المسابقة ▶️</span>
                    </button>
                  </div>
                </motion.div>
              ) : gameState === 'intermission' ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`relative overflow-hidden flex-1 p-5 rounded-2xl shadow-2xl flex flex-col items-center justify-center text-center space-y-3 border-2 ${
                    lastCorrect
                      ? 'bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-950 border-emerald-400/60 shadow-emerald-500/20'
                      : 'bg-red-950/60 border-red-500 animate-pulse'
                  }`}
                >
                  {/* Animated celebration background burst on correct answer */}
                  {lastCorrect && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0.7 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{ duration: 1.1, ease: 'easeOut' }}
                      className="absolute w-40 h-40 rounded-full bg-emerald-400/25 pointer-events-none"
                    />
                  )}

                  <div className="relative flex items-center justify-center">
                    {lastCorrect && (
                      <motion.div
                        animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="absolute inset-0 rounded-full bg-emerald-400/30"
                      />
                    )}
                    {lastCorrect ? (
                      <motion.div
                        initial={{ scale: 0.4, rotate: -30 }}
                        animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }}
                        transition={{ duration: 0.6 }}
                        className="relative bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 p-3.5 rounded-full shadow-xl shadow-emerald-500/40 border-2 border-emerald-200"
                      >
                        <CheckCircle2 className="w-9 h-9" />
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ x: -8 }}
                        animate={{ x: [0, -6, 6, -4, 4, 0] }}
                        transition={{ duration: 0.4 }}
                        className="bg-red-500 text-white p-3 rounded-full shadow-lg"
                      >
                        <XCircle className="w-8 h-8" />
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-1.5 relative z-10">
                    {lastCorrect && (
                      <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-3 py-0.5 rounded-full text-xs font-black"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                        <span>+١ درجة رائعة!</span>
                      </motion.div>
                    )}

                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      {lastCorrect ? `أحسنت يا ${currentStudent.name}! إجابة صحيحة 🌟` : `إجابة خاطئة يا ${currentStudent.name}`}
                    </h3>

                    {/* Overtake highlight right inside the center arena */}
                    {lastCorrect && overtakeEvent && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: [1, 1.06, 1], opacity: 1 }}
                        transition={{ duration: 0.45 }}
                        className={`mx-auto w-fit px-4 py-1.5 rounded-xl border-2 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg ${
                          overtakeEvent.isNewLeader
                            ? 'bg-amber-400 text-slate-950 border-yellow-200 shadow-amber-500/30'
                            : 'bg-cyan-400 text-slate-950 border-cyan-200 shadow-cyan-500/30'
                        }`}
                      >
                        {overtakeEvent.isNewLeader ? <Crown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                        <span>
                          {overtakeEvent.isNewLeader
                            ? `انقضّ على الصدارة! المركز الأول 👑`
                            : `تجاوز ${overtakeEvent.overtakenName || 'منافسه'} وصعد للمركز ${toHindi(overtakeEvent.newRank + 1)} 🚀`}
                        </span>
                      </motion.div>
                    )}

                    <p className="text-sm font-bold text-slate-300 mt-1">
                      الإجابة الصحيحة هي: <span className="text-emerald-400 font-mono font-black text-base">{toHindi(currentQ?.answer ?? '')}</span>
                    </p>
                    {isBreakActive ? (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 text-xs font-black px-3 py-1 rounded-full border border-amber-500/40 animate-pulse">
                        <Coffee className="w-3.5 h-3.5" />
                        <span>شاشة الاستراحة ستبدأ حالاً ☕</span>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-xs mt-1">
                        استعد يا <span className="text-amber-400 font-black">{nextStudent.name}</span>
                      </p>
                    )}
                  </div>

                  <div className="py-1">
                    <span className="text-xs text-slate-400 block font-bold mb-0.5">الانتقال خلال:</span>
                    <span className="text-4xl sm:text-5xl font-black font-mono text-amber-400 animate-pulse inline-block">
                      {toHindi(intermissionTimer)}
                    </span>
                  </div>

                  {/* Immediate Action Button */}
                  <button
                    onClick={() => {
                      sounds.playTap();
                      if (isBreakActive) {
                        setIntermissionTimer(0);
                      } else {
                        advanceNextTurn();
                      }
                    }}
                    className="mt-1 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all border border-amber-400"
                  >
                    <SkipForward className="w-4 h-4 fill-current" />
                    <span>{isBreakActive ? 'دخول الاستراحة الآن ☕' : 'الانتقال للسؤال التالي الآن ⏭️'}</span>
                  </button>
                </motion.div>
              ) : currentQ ? (
                <div className="flex-1 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between items-center text-center">
                  {/* Math Question */}
                  <motion.div
                    key={`${currentQ.a}_${currentQ.operation}_${currentQ.b}_${totalQuestionsAnsweredCount}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                    className="my-auto py-2 select-none font-mono"
                  >
                    <div className="text-5xl sm:text-6xl md:text-7xl font-black text-white tracking-widest flex items-center justify-center gap-3 sm:gap-5">
                      <span>{toHindi(currentQ.a)}</span>
                      <span className="text-amber-400">{currentQ.operation}</span>
                      <span>{toHindi(currentQ.b)}</span>
                      <span className="text-slate-600">=</span>
                      <span className="text-indigo-400">؟</span>
                    </div>
                  </motion.div>

                  {/* All 4 Touch Options - Shown Side-by-Side */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full max-w-3xl mx-auto pt-1">
                    {currentQ.options.map((opt, i) => {
                      const isChosen = selectedOption === opt;
                      const isCorrect = opt === currentQ.answer;

                      let style = 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-white';
                      let badge = null;
                      if (isAnswered) {
                        if (isCorrect) {
                          style = 'bg-emerald-600 border-emerald-300 text-white shadow-xl shadow-emerald-500/50 ring-4 ring-emerald-400';
                          badge = (
                            <motion.span
                              initial={{ scale: 0, y: 6 }}
                              animate={{ scale: 1, y: 0 }}
                              className="absolute -top-3.5 bg-emerald-400 text-slate-950 font-black text-[10px] sm:text-xs px-2 py-0.5 rounded-full shadow-md flex items-center gap-0.5"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>الإجابة الصحيحة ✓</span>
                            </motion.span>
                          );
                        } else if (isChosen) {
                          style = 'bg-rose-600 border-rose-400 text-white ring-4 ring-rose-400/80';
                          badge = (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-3.5 bg-rose-400 text-slate-950 font-black text-[10px] sm:text-xs px-2 py-0.5 rounded-full shadow-md flex items-center gap-0.5"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>خطأ ✕</span>
                            </motion.span>
                          );
                        } else {
                          style = 'bg-slate-800/30 border-slate-800/60 text-slate-600 opacity-30';
                        }
                      }

                      return (
                        <motion.button
                          key={i}
                          onClick={() => handleOptionSelect(opt)}
                          disabled={isAnswered}
                          animate={
                            isAnswered && isCorrect
                              ? { scale: [1, 1.09, 1.04] }
                              : isAnswered && isChosen && !isCorrect
                              ? { x: [0, -6, 6, -4, 4, 0] }
                              : { scale: 1 }
                          }
                          transition={{ duration: 0.4 }}
                          className={`relative py-4 sm:py-5 px-2 rounded-xl sm:rounded-2xl font-black text-2xl sm:text-3xl md:text-4xl border-2 transition-colors shadow-md font-mono active:scale-95 flex flex-col items-center justify-center ${style}`}
                        >
                          {isAnswered && isCorrect && isChosen && (
                            <motion.span
                              initial={{ opacity: 1, y: 0, scale: 0.8 }}
                              animate={{ opacity: 0, y: -34, scale: 1.3 }}
                              transition={{ duration: 0.9 }}
                              className="absolute -top-6 text-sm sm:text-base font-black text-amber-300 pointer-events-none drop-shadow"
                            >
                              +١ 🌟
                            </motion.span>
                          )}
                          {badge}
                          <span>{toHindi(opt)}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* FINISHED SCREEN WITH SMART REPORT & >90% CERTIFICATES */}
        {gameState === 'finished' && (() => {
          const winner = rankedActiveStudents[0];
          const currentGradeName = SCHOOL_GRADES.find(g => g.id === selectedGradeId)?.name || 'الصف الدراسي';
          const currentSectionLabel = selectedSection === 'all' ? 'جميع الشعب' : `فصل (${selectedSection})`;
          return (
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-5xl space-y-4 py-2"
            >
              {/* بطاقة التتويج والنتيجة السريعة (لا تُطبع مع التقرير الرسمي) */}
              <div className="report-hide-on-print bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-2xl text-center space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-right">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                      <Trophy className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-2xl font-black text-white">
                        النتائج الختامية لمسابقة الفصل 🏆
                      </h2>
                      <p className="text-xs text-slate-400 font-bold">
                        تُمنح شهادة التفوق تلقائياً لكل طالب اجتاز أكثر من ٩٠٪
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={startClassCompetition}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>إعادة المسابقة</span>
                    </button>
                    <button
                      onClick={() => setGameState('setup')}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                    >
                      <span>اختيار طلاب آخرين</span>
                    </button>
                  </div>
                </div>

                {/* بطاقة بطل المركز الأول */}
                {winner && (() => {
                  const winnerExactPct = winner.totalAnswered > 0 ? (winner.correctAnswers / winner.totalAnswered) * 100 : 0;
                  const qualifies = winnerExactPct > 90;
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border-2 border-amber-400/60 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-3xl">🥇</span>
                        <div>
                          <span className="text-[11px] font-black text-amber-400 block">
                            بطل المسابقة والمركز الأول:
                          </span>
                          <span className="text-lg sm:text-xl font-black text-white font-['El_Messiri',serif]">
                            {winner.name}
                          </span>
                          {rankedActiveStudents.length > 1 && rankedActiveStudents[0].score === rankedActiveStudents[1].score && rankedActiveStudents[0].score > 0 && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black bg-cyan-400 text-slate-950 px-2 py-0.5 rounded-md shadow-sm block w-fit">
                              ⚡ حسم الفوز بأسبقية السرعة ({toHindi((winner.totalTimeSpent || 0).toFixed(1))}ث مقابل {toHindi((rankedActiveStudents[1]?.totalTimeSpent || 0).toFixed(1))}ث)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-left font-mono">
                          <span className="text-lg font-black text-amber-400 block">{toHindi(winner.score)} درجات</span>
                          <span className="text-xs font-black text-emerald-400 block">النسبة العامة: {toHindi(winner.percentage)}٪</span>
                        </div>

                        {qualifies ? (
                          <button
                            onClick={() => onOpenCertificate(winner.name, winner.score, winner.correctAnswers, winner.totalAnswered, 1)}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.02] cursor-pointer"
                          >
                            <Award className="w-4 h-4 fill-current" />
                            <span>👑 شهادة البطل (اجتاز ٩٠٪)</span>
                          </button>
                        ) : (
                          <div className="py-2 px-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-bold text-slate-300">
                            الشهادة لمن يتجاوز ٩٠٪ ({toHindi(winner.percentage)}٪)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* التقرير التحليلي الذكي الشامل (اسم الطالب + نسبة كل جدول + النسبة العامة + الشهادة للمجتازين) */}
              <SmartCompetitionReport
                title={`تقرير التحليل الذكي — مسابقة ${currentGradeName}`}
                subtitle={currentSectionLabel}
                analysis={competitionSmartAnalysis}
                opMode={opMode}
                onOpenCertificate={onOpenCertificate}
                exportFileName={`التقرير_الذكي_${selectedGradeId}_فصل_${selectedSection}`}
              />
            </motion.div>
          );
        })()}
      </main>

      {/* MODAL: UPLOAD / PASTE STUDENTS ROSTER */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-black text-white">
                    رفع ولصق أسماء طلاب الصف
                  </h3>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">الصف:</label>
                  <select
                    value={uploadGradeId}
                    onChange={e => setUploadGradeId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    {SCHOOL_GRADES.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">الفصل:</label>
                  <select
                    value={uploadSection}
                    onChange={e => setUploadSection(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="أ">فصل (أ)</option>
                    <option value="ب">فصل (ب)</option>
                    <option value="ج">فصل (ج)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  أسماء الطلاب (اسم في كل سطر):
                </label>
                <textarea
                  rows={6}
                  placeholder={`ريان فهد القحطاني\nسلمان تركي المطيري\nعبدالمحسن عمر العتيبي\nخالد محمد الشمري...`}
                  value={uploadText}
                  onChange={e => setUploadText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs font-bold text-white outline-none focus:border-amber-400 font-mono leading-relaxed"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleImportStudents}
                  disabled={!uploadText.trim()}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-md shadow-amber-500/20"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>حفظ الأسماء</span>
                </button>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TEST SESSIONS DATABASE MODAL */}
      <AnimatePresence>
        {isDatabaseModalOpen && (
          <div className="report-modal-backdrop fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="report-modal-dialog w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col justify-between space-y-4"
            >
              {/* Header */}
              <div className="report-hide-on-print flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      قاعدة بيانات الاختبارات والمسابقات
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold">
                      سجل موثق لجميع الاختبارات المنجزة لغرض التحليل ومتابعة إتقان الطلاب
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {savedTestsList.length > 0 && (
                    <button
                      onClick={() => exportTestDatabaseToExcel(savedTestsList)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>تصدير إكسل 📊</span>
                    </button>
                  )}
                  <button
                    onClick={() => { setIsDatabaseModalOpen(false); setSelectedTestDetail(null); }}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {selectedTestDetail ? (
                  /* Detail View of a specific test */
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedTestDetail(null)}
                      className="report-hide-on-print text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 mb-2"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>العودة لسجل الاختبارات</span>
                    </button>

                    <div className="report-hide-on-print bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-right">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                        <div>
                          <h4 className="text-sm font-black text-white">{selectedTestDetail.title}</h4>
                          <span className="text-[11px] text-slate-400 font-mono">{selectedTestDetail.dateFormatted}</span>
                        </div>
                        <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          متوسط الدقة: {toHindi(selectedTestDetail.averageAccuracy)}٪
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                        <div className="bg-slate-900 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block">الجداول المختبرة</span>
                          <span className="font-bold text-white">{selectedTestDetail.tables.map(t => toHindi(t)).join('، ')}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block">نوع العملية</span>
                          <span className="font-bold text-white">
                            {selectedTestDetail.opMode === 'multi' ? 'ضرب' : selectedTestDetail.opMode === 'divi' ? 'قسمة' : 'مختلط'}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block">فارس الاختبار</span>
                          <span className="font-bold text-amber-400">{selectedTestDetail.topStudentName}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-400 block">المشاركون</span>
                          <span className="font-bold text-indigo-400">{toHindi(selectedTestDetail.totalParticipants)} طالب</span>
                        </div>
                      </div>
                    </div>

                    {/* Smart Analytical Report for Saved Test Session */}
                    <SmartCompetitionReport
                      title={selectedTestDetail.title}
                      subtitle={`شعبة: ${selectedTestDetail.section} • ${selectedTestDetail.dateFormatted}`}
                      analysis={analyzeCompetitionResults(
                        selectedTestDetail.participants.map(p => ({
                          id: p.id,
                          name: p.name,
                          score: p.score,
                          correctAnswers: p.correctAnswers,
                          totalAnswered: p.totalAnswered,
                          totalTimeSpent: p.timeSpent,
                          eliminated: p.eliminated,
                          questionLogs: p.questionLogs
                        })),
                        selectedTestDetail.tables,
                        selectedTestDetail.opMode
                      )}
                      opMode={selectedTestDetail.opMode}
                      onOpenCertificate={onOpenCertificate}
                      exportFileName={`تقرير_${selectedTestDetail.gradeId}_${selectedTestDetail.id}`}
                    />
                  </div>
                ) : savedTestsList.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <Database className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-sm text-slate-400 font-bold">لا توجد اختبارات مسجلة بعد في قاعدة البيانات</p>
                    <p className="text-xs text-slate-500">
                      عند إجراء أي اختبار سبورة تفاعلي، سيتم حفظ نتائجه تلقائياً هنا للتحليل الدقيق
                    </p>
                  </div>
                ) : (
                  /* List of all test sessions */
                  <div className="space-y-2">
                    {savedTestsList.map(test => (
                      <div
                        key={test.id}
                        className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-black text-white">{test.title}</span>
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                              فارس: {test.topStudentName}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                            <span>📅 {test.dateFormatted}</span>
                            <span>•</span>
                            <span>👥 {toHindi(test.totalParticipants)} طلاب</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-bold">نسبة الدقة: {toHindi(test.averageAccuracy)}٪</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setSelectedTestDetail(test)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-colors"
                          >
                            عرض التفاصيل
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500 font-bold">
                <span>إجمالي الاختبارات المحفوظة: {toHindi(savedTestsList.length)}</span>
                <button
                  onClick={() => setIsDatabaseModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ROULETTE WHEEL MODAL */}
      <RouletteWheelModal
        isOpen={isRouletteOpen}
        onClose={() => setIsRouletteOpen(false)}
        students={visibleStudents}
        onPickStudents={(chosenList) => {
          setSelectedStudentIds(prev => {
            const next = new Set(prev);
            chosenList.forEach(s => next.add(s.id));
            return next;
          });
        }}
      />
    </div>
  );
};
