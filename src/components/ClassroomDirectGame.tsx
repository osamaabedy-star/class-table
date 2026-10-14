import React, { useState, useEffect, useMemo } from 'react';
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
  SkipForward
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
import { exportResultsToExcel } from '../utils/exportExcel';

interface Question {
  a: number;
  b: number;
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
}

interface ClassroomDirectGameProps {
  onBack: () => void;
  onOpenCertificate: (name: string, score: number, correct: number, total: number) => void;
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

  // Ranked participants list (re-sorted automatically after every question with percentage)
  const rankedActiveStudents = useMemo(() => {
    return [...activeStudents].map(s => {
      const pct = s.totalAnswered > 0 ? Math.round((s.correctAnswers / s.totalAnswered) * 100) : 0;
      return { ...s, percentage: pct };
    }).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return b.correctAnswers - a.correctAnswers;
    });
  }, [activeStudents]);

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

  const generateSingleQuestion = (): Question => {
    let valid = selectedTables.length > 0 ? selectedTables : [2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    // Adaptive difficulty: if enabled and student has good streak, pick more challenging tables
    const currentStd = activeStudents[currentStudentIndex];
    if (adaptiveDifficulty && currentStd && currentStd.correctAnswers >= 2) {
      const advanced = valid.filter(t => t >= 6);
      if (advanced.length > 0) valid = advanced;
    }

    const table = valid[Math.floor(Math.random() * valid.length)] || 2;
    const factor = Math.floor(Math.random() * 11) + 2;
    const isDiv = opMode === 'divi' || (opMode === 'mixed' && Math.random() > 0.5);

    if (isDiv) {
      const product = table * factor;
      const answer = factor;
      const opts = new Set<number>([answer]);
      const pool = [
        answer + 1,
        answer - 1,
        answer + 2,
        answer - 2,
        answer + 3,
        answer - 3,
        factor + 1,
        factor - 1,
        table
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
      return {
        a: product,
        b: table,
        operation: '÷',
        answer,
        options: Array.from(opts).sort(() => Math.random() - 0.5)
      };
    } else {
      const answer = table * factor;
      const opts = new Set<number>([answer]);
      const pool = [
        answer + table,
        answer - table,
        answer + 1,
        answer - 1,
        answer + 2,
        answer - 2,
        answer + 10,
        answer - 10,
        (table + 1) * factor,
        (table - 1) * factor,
        table * (factor + 1),
        table * (factor - 1)
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
      return {
        a: table,
        b: factor,
        operation: '×',
        answer,
        options: Array.from(opts).sort(() => Math.random() - 0.5)
      };
    }
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
        eliminated: false
      }));

    if (chosenList.length === 0) return;

    setActiveStudents(chosenList);
    setCurrentStudentIndex(0);
    setCurrentRound(1);
    setCurrentQ(generateSingleQuestion());
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

    if (isCorrect) {
      sounds.playCorrect();
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
      const pts = 1; // Exactly 1 point per correct answer
      setActiveStudents(prev =>
        prev.map((s, idx) =>
          idx === currentStudentIndex
            ? { ...s, score: s.score + pts, correctAnswers: s.correctAnswers + 1, totalAnswered: s.totalAnswered + 1 }
            : s
        )
      );
    } else {
      sounds.playWrong();
      setActiveStudents(prev =>
        prev.map((s, idx) =>
          idx === currentStudentIndex
            ? { 
                ...s, 
                totalAnswered: s.totalAnswered + 1,
                eliminated: competitionType === 'sudden_death' ? true : s.eliminated 
              }
            : s
        )
      );
    }

    setIntermissionTimer(2);
    setGameState('intermission');
  };

  // Intermission countdown (auto-advances to next student/question)
  useEffect(() => {
    if (gameState !== 'intermission') return;

    if (intermissionTimer > 0) {
      const t = setTimeout(() => {
        sounds.playTick(false);
        setIntermissionTimer(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearTimeout(t);
    } else {
      advanceNextTurn();
    }
  }, [intermissionTimer, gameState]);

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

      // Record to server for admin analytics & honor rolls
      recordGameParticipation(activeStudents.map(a => ({
        name: a.name,
        score: a.score,
        correctCount: a.correctAnswers,
        totalAnswered: a.totalAnswered,
        streak: a.correctAnswers
      }))).catch(() => {});

      // Record complete test session to test database for deep analysis
      const totalCorrect = activeStudents.reduce((acc, s) => acc + s.correctAnswers, 0);
      const totalAns = activeStudents.reduce((acc, s) => acc + s.totalAnswered, 0);
      const avgAccuracy = totalAns > 0 ? Math.round((totalCorrect / totalAns) * 100) : 0;
      const topStd = rankedActiveStudents[0];

      recordTestSessionToDatabase({
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
          eliminated: s.eliminated
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

  const handleExportExcel = () => {
    const rows = rankedActiveStudents.map((s, idx) => ({
      rank: idx + 1,
      name: s.name,
      gradeName: SCHOOL_GRADES.find(g => g.id === selectedGradeId)?.name || 'الصف المحدد',
      section: selectedSection === 'all' ? 'أ' : selectedSection,
      score: s.score,
      correctAnswers: s.correctAnswers,
      totalAnswered: s.totalAnswered,
      percentage: s.percentage,
      status: s.eliminated ? 'مستبعد' : s.percentage >= 80 ? 'بطل متقن' : 'مشارك',
      date: new Date().toLocaleDateString('ar-SA')
    }));
    exportResultsToExcel(rows, `نتائج_مسابقة_${selectedGradeId}_فصل_${selectedSection}`);
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
        {/* SETUP SCREEN */}
        {gameState === 'setup' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full space-y-3"
          >
            {/* Top Bar with quick actions */}
            <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-md">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm sm:text-base font-black text-white">
                  إعداد الاختبار ومسابقة السبورة
                </h2>
                <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">
                  • اختر الطلاب من القائمة يميناً وجهّز معايير الاختبار
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-black flex items-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع ولصق أسماء</span>
                </button>

                <button
                  onClick={() => setIsDatabaseModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-black flex items-center gap-1.5 transition-all"
                >
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span>سجل الاختبارات 💾</span>
                </button>
              </div>
            </div>

            {/* MAIN 2-COLUMN LAYOUT:
                RIGHT: Clean, simple-width student list (قائمة عرضها بسيط ناحية اليمين)
                LEFT: Full remaining space dedicated to test setup (وباقي المساحة لاعداد الاختبار) */}
            <div className="flex flex-col lg:flex-row gap-3.5 items-start">
              
              {/* 1. RIGHT SIDEBAR: SIMPLE, CLEAN STUDENT LIST */}
              <div className="w-full lg:w-72 xl:w-80 shrink-0 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-3.5 space-y-2.5 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black text-white">
                      قائمة الطلاب ({toHindi(visibleStudents.length)})
                    </h3>
                  </div>

                  <span className="text-[11px] font-mono font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    {toHindi(selectedStudentIds.size)} محدد
                  </span>
                </div>

                {/* Quick Selection Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={selectAllVisible}
                    className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-colors"
                  >
                    تحديد الكل
                  </button>
                  <button
                    onClick={clearVisibleSelection}
                    className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 text-[11px] font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={() => selectRandomVisible(6)}
                    className="flex-1 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>(٦)</span>
                  </button>
                  <button
                    onClick={() => { sounds.playTap(); setIsRouletteOpen(true); }}
                    disabled={visibleStudents.length === 0}
                    className="py-1 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold disabled:opacity-40 transition-colors"
                    title="عجلة الحظ"
                  >
                    🎡
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="بحث سريع بالاسم..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-7 pl-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
                  />
                </div>

                {/* Clean, minimalist student list */}
                <div className="space-y-1 max-h-[460px] overflow-y-auto p-1 bg-slate-950/70 rounded-xl border border-slate-800/80 custom-scrollbar">
                  {visibleStudents.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 font-bold">
                      لا يوجد طلاب مسجلون في هذا الصف
                    </div>
                  ) : (
                    visibleStudents.map(student => {
                      const isSelected = selectedStudentIds.has(student.id);
                      return (
                        <div
                          key={student.id}
                          onClick={() => toggleStudentSelection(student.id)}
                          className={`px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-all border text-right ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm font-black'
                              : 'bg-slate-900/60 border-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white'
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

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-500 font-mono">
                              فصل {student.section || 'أ'}
                            </span>
                            <button
                              onClick={(e) => handleDeleteStudent(student.id, e)}
                              className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add single student inline */}
                <div className="pt-1 flex gap-1.5 border-t border-slate-800">
                  <input
                    type="text"
                    placeholder="إضافة طالب سريعاً..."
                    value={singleStudentName}
                    onChange={e => setSingleStudentName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSingleStudent()}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
                  />
                  <button
                    onClick={handleAddSingleStudent}
                    disabled={!singleStudentName.trim()}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-black transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 2. MAIN AREA: TEST PREPARATION (وباقي المساحة لاعداد الاختبار) */}
              <div className="flex-1 w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                
                {/* 1. الصف والفصل */}
                <div className="space-y-2 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                      <span>١. الصف الدراسي والشعبة:</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold">
                      {SCHOOL_GRADES.find(g => g.id === selectedGradeId)?.name} • {selectedSection === 'all' ? 'جميع الفصول' : `فصل (${selectedSection})`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {SCHOOL_GRADES.map(grade => (
                      <button
                        key={grade.id}
                        onClick={() => { sounds.playTap(); setSelectedGradeId(grade.id); }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all border ${
                          selectedGradeId === grade.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {grade.name}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {['all', 'أ', 'ب', 'ج', 'د'].map(sec => (
                      <button
                        key={sec}
                        onClick={() => { sounds.playTap(); setSelectedSection(sec); }}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all border ${
                          selectedSection === sec
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm'
                            : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sec === 'all' ? 'جميع الفصول' : `فصل (${sec})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. جداول الضرب والقسمة المختبرة */}
                <div className="space-y-2 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400">
                      ٢. جداول الحساب المختبرة:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { sounds.playTap(); setSelectedTables([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); }}
                        className="text-[11px] text-amber-400 hover:underline font-bold"
                      >
                        تحديد الكل (٢-١٢)
                      </button>
                      <span className="text-slate-600">•</span>
                      <button
                        onClick={() => { sounds.playTap(); setSelectedTables([2, 3, 4, 5]); }}
                        className="text-[11px] text-indigo-400 hover:underline font-bold"
                      >
                        الأساسية (٢-٥)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <button
                        key={n}
                        onClick={() => { sounds.playTap(); toggleTable(n); }}
                        className={`h-10 rounded-xl font-black text-xs sm:text-sm border transition-all font-mono ${
                          selectedTables.includes(n)
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                            : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {toHindi(n)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. نوع العمليات الحسابية */}
                <div className="space-y-2 pb-3 border-b border-slate-800/80">
                  <span className="text-xs font-black text-amber-400 block">
                    ٣. نوع العمليات الحسابية:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'multi', label: 'الضرب فقط (×)' },
                      { id: 'divi', label: 'القسمة فقط (÷)' },
                      { id: 'mixed', label: 'مختلط (× و ÷)' }
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => { sounds.playTap(); setOpMode(m.id as any); }}
                        className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all border text-center ${
                          opMode === m.id
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                            : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. معايير ونظام الاختبار (الأسئلة، الوقت، نظام التنافس) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pb-2">
                  {/* نوع التنافس */}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 block">نظام المسابقة:</span>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => { sounds.playTap(); setCompetitionType('points'); }}
                        className={`py-1.5 rounded-lg text-xs font-black border transition-all ${
                          competitionType === 'points'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        نقاط 🏆
                      </button>
                      <button
                        onClick={() => { sounds.playTap(); setCompetitionType('sudden_death'); }}
                        className={`py-1.5 rounded-lg text-xs font-black border transition-all ${
                          competitionType === 'sudden_death'
                            ? 'bg-red-600 text-white border-red-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        خروج مغلوب ⚔️
                      </button>
                    </div>
                  </div>

                  {/* عدد الأسئلة */}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 block">الأسئلة لكل طالب:</span>
                    <div className="grid grid-cols-4 gap-1">
                      {[1, 2, 3, 5].map(cnt => (
                        <button
                          key={cnt}
                          onClick={() => { sounds.playTap(); setRoundsPerStudent(cnt); }}
                          className={`py-1.5 rounded-lg text-xs font-black font-mono border transition-all ${
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

                  {/* وقت الإجابة */}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 block">وقت السؤال:</span>
                    <div className="grid grid-cols-4 gap-1">
                      {[5, 10, 15, 20].map(sec => (
                        <button
                          key={sec}
                          onClick={() => { sounds.playTap(); setTimeLimit(sec); }}
                          className={`py-1.5 rounded-lg text-xs font-black font-mono border transition-all ${
                            timeLimit === sec
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {toHindi(sec)}ث
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 5. شريط تأكيد قاعدة البيانات وملخص الاختبار */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-amber-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-right">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-xs font-black text-white block">
                        قاعدة بيانات التحليل التلقائي مفعّلة 💾
                      </span>
                      <span className="text-[10px] text-slate-400">
                        سيتم تسجيل درجات ونسب إتقان جميع المتسابقين في قاعدة البيانات للتحليل والمقارنة
                      </span>
                    </div>
                  </div>

                  <div className="text-left font-mono shrink-0">
                    <span className="text-sm font-black text-amber-400">
                      {toHindi(selectedStudentIds.size)} طلاب جاهزون
                    </span>
                  </div>
                </div>

                {/* 6. زر البدء الرئيسي الكبير */}
                <button
                  onClick={startClassCompetition}
                  disabled={selectedStudentIds.size === 0}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-30 disabled:pointer-events-none text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>بدء الاختبار والمسابقة الآن ({toHindi(selectedStudentIds.size)} طلاب)</span>
                </button>
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

                {/* Real-time sorted participant list */}
                <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                  {rankedActiveStudents.map((s, idx) => {
                    const isCurrentTurn = currentStudent.id === s.id;
                    const pct = s.percentage;
                    return (
                      <motion.div
                        key={s.id}
                        layout
                        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                          isCurrentTurn
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
                              <span className="font-black text-xs text-white truncate max-w-[100px]">{s.name}</span>
                              {isCurrentTurn && (
                                <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1 py-0.2 rounded animate-pulse shrink-0">
                                  الآن 🎯
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 block font-mono">
                              {toHindi(s.correctAnswers)} / {toHindi(s.totalAnswered)} صحيحة
                            </span>
                          </div>
                        </div>

                        {/* Score & Percentage display */}
                        <div className="text-left shrink-0 pl-1">
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

              {/* Question Board with All 4 Options Visible (or Intermission) */}
              {gameState === 'intermission' ? (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`flex-1 p-5 rounded-2xl shadow-xl flex flex-col items-center justify-center text-center space-y-3 border-2 ${
                    lastCorrect
                      ? 'bg-slate-900 border-emerald-500/40'
                      : 'bg-red-950/60 border-red-500 animate-pulse'
                  }`}
                >
                  <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center shadow-md border-2">
                    {lastCorrect ? (
                      <div className="bg-emerald-500 text-slate-950 p-3 rounded-full">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                    ) : (
                      <div className="bg-red-500 text-white p-3 rounded-full">
                        <XCircle className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white">
                      {lastCorrect ? `أحسنت يا ${currentStudent.name}! إجابة صحيحة 🌟` : `إجابة خاطئة يا ${currentStudent.name}`}
                    </h3>
                    <p className="text-sm font-bold text-slate-300 mt-1">
                      الإجابة الصحيحة هي: <span className="text-emerald-400 font-mono font-black text-base">{toHindi(currentQ?.answer ?? '')}</span>
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      استعد يا <span className="text-amber-400 font-black">{nextStudent.name}</span>
                    </p>
                  </div>

                  <div className="py-1">
                    <span className="text-xs text-slate-400 block font-bold mb-0.5">الانتقال التلقائي خلال:</span>
                    <span className="text-4xl sm:text-5xl font-black font-mono text-amber-400 animate-pulse inline-block">
                      {toHindi(intermissionTimer)}
                    </span>
                  </div>

                  {/* Immediate Action Button */}
                  <button
                    onClick={() => {
                      sounds.playTap();
                      advanceNextTurn();
                    }}
                    className="mt-1 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all border border-amber-400"
                  >
                    <SkipForward className="w-4 h-4 fill-current" />
                    <span>الانتقال للسؤال التالي الآن ⏭️</span>
                  </button>
                </motion.div>
              ) : currentQ ? (
                <div className="flex-1 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between items-center text-center">
                  {/* Math Question */}
                  <div className="my-auto py-2 select-none font-mono">
                    <div className="text-5xl sm:text-6xl md:text-7xl font-black text-white tracking-widest flex items-center justify-center gap-3 sm:gap-5">
                      <span>{toHindi(currentQ.a)}</span>
                      <span className="text-amber-400">{currentQ.operation}</span>
                      <span>{toHindi(currentQ.b)}</span>
                      <span className="text-slate-600">=</span>
                      <span className="text-indigo-400">؟</span>
                    </div>
                  </div>

                  {/* All 4 Touch Options - Shown Side-by-Side */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full max-w-3xl mx-auto pt-1">
                    {currentQ.options.map((opt, i) => {
                      const isChosen = selectedOption === opt;
                      const isCorrect = opt === currentQ.answer;

                      let style = 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-white';
                      if (isAnswered) {
                        if (isCorrect) style = 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-500/40 animate-pulse';
                        else if (isChosen) style = 'bg-red-600 border-red-400 text-white';
                        else style = 'bg-slate-800/40 border-slate-800 text-slate-600 opacity-40';
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => handleOptionSelect(opt)}
                          disabled={isAnswered}
                          className={`py-3.5 sm:py-4 px-2 rounded-xl sm:rounded-2xl font-black text-2xl sm:text-3xl md:text-4xl border-2 transition-all shadow-md font-mono active:scale-95 flex items-center justify-center ${style}`}
                        >
                          {toHindi(opt)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* FINISHED SCREEN WITH WINNER-ONLY CERTIFICATE */}
        {gameState === 'finished' && (() => {
          const winner = rankedActiveStudents[0];
          return (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-2xl text-center space-y-4"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Trophy className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">النتائج الختامية لمسابقة الفصل 🏆</h2>
                <p className="text-xs text-slate-400 font-bold mt-1">شهادة التقدير تمنح حصرياً للطالب الفائز بالمركز الأول</p>
              </div>

              {/* 1st Place Winner Special Card */}
              {winner && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border-2 border-amber-400/60 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🥇</span>
                      <div className="text-right">
                        <span className="text-[11px] font-black text-amber-400 block uppercase">بطل المسابقة والمركز الأول:</span>
                        <span className="text-lg font-black text-white font-['El_Messiri',serif]">{winner.name}</span>
                      </div>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-xl font-black text-amber-400 block">{toHindi(winner.score)} درجات</span>
                      <span className="text-xs font-black text-emerald-400">نسبة الإتقان: {toHindi(winner.percentage)}٪</span>
                    </div>
                  </div>

                  {/* Certificate Button for the 1st Place Winner ONLY */}
                  <button
                    onClick={() => onOpenCertificate(winner.name, winner.score, winner.correctAnswers, winner.totalAnswered)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.02]"
                  >
                    <Award className="w-5 h-5 fill-current" />
                    <span>👑 طباعة شهادة التقدير للبطل الفائز بالمركز الأول</span>
                  </button>
                </div>
              )}

              {/* Other Ranks (Ranks 2 and below without certificate button) */}
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {rankedActiveStudents.slice(1).map((s, idx) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-xl border bg-slate-950/70 border-slate-800 text-slate-300 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg font-mono font-black text-xs flex items-center justify-center bg-slate-800">
                        {idx === 0 ? '🥈' : idx === 1 ? '🥉' : toHindi(idx + 2)}
                      </span>
                      <div className="text-right">
                        <span className="font-bold text-xs block text-white">{s.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {toHindi(s.correctAnswers)} صحيحة من {toHindi(s.totalAnswered)}
                        </span>
                      </div>
                    </div>

                    <div className="text-left font-mono">
                      <span className="text-sm font-black text-amber-400">{toHindi(s.score)} درجات</span>
                      <span className="text-[11px] font-bold text-emerald-400 mr-2">({toHindi(s.percentage)}٪)</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleExportExcel}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير النتائج إلى Excel 📊</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={startClassCompetition}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة المسابقة</span>
                  </button>
                  <button
                    onClick={() => setGameState('setup')}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                  >
                    <span>اختيار طلاب آخرين</span>
                  </button>
                </div>
              </div>
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
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl max-h-[88vh] flex flex-col justify-between space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
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
                      <span>تصدير Excel 📊</span>
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
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 mb-2"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>العودة لسجل الاختبارات</span>
                    </button>

                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-right">
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

                    {/* Participant table */}
                    <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-bold">
                          <tr>
                            <th className="py-2.5 px-3">الترتيب</th>
                            <th className="py-2.5 px-3">اسم الطالب</th>
                            <th className="py-2.5 px-3">الدرجة</th>
                            <th className="py-2.5 px-3">الإجابات الصحيحة</th>
                            <th className="py-2.5 px-3">نسبة الدقة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-bold">
                          {selectedTestDetail.participants.map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/40">
                              <td className="py-2.5 px-3 text-amber-400 font-mono">#{toHindi(p.rank)}</td>
                              <td className="py-2.5 px-3 text-white">{p.name}</td>
                              <td className="py-2.5 px-3 text-indigo-300 font-mono">{toHindi(p.score)}</td>
                              <td className="py-2.5 px-3 text-slate-300 font-mono">{toHindi(p.correctAnswers)} / {toHindi(p.totalAnswered)}</td>
                              <td className="py-2.5 px-3 text-emerald-400 font-mono">{toHindi(p.percentage)}٪</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
