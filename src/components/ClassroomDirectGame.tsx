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
  FileSpreadsheet
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
import { RiyadhEbdaaLogo } from './RiyadhEbdaaLogo';

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
    const valid = selectedTables.length > 0 ? selectedTables : [2, 3, 4, 5, 6, 7, 8, 9, 10];
    const table = valid[Math.floor(Math.random() * valid.length)];
    const factor = Math.floor(Math.random() * 11) + 2;
    const isDiv = opMode === 'divi' || (opMode === 'mixed' && Math.random() > 0.5);

    if (isDiv) {
      const product = table * factor;
      const answer = factor;
      const opts = new Set<number>([answer]);
      while (opts.size < 4) {
        const delta = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1);
        const wrong = answer + delta;
        if (wrong > 0 && wrong !== answer) opts.add(wrong);
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
      while (opts.size < 4) {
        const delta = (Math.random() > 0.5 ? table : 1) * (Math.random() > 0.5 ? 1 : -1);
        const wrong = answer + delta;
        if (wrong > 0 && wrong !== answer) opts.add(wrong);
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
        totalAnswered: 0
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

    if (isCorrect) {
      sounds.playCorrect();
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
      const pts = 10 + Math.max(0, Math.round((timeLeft / timeLimit) * 5));
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
            ? { ...s, totalAnswered: s.totalAnswered + 1 }
            : s
        )
      );
    }

    setGameState('intermission');
    setIntermissionTimer(3);
  };

  // 3-second intermission countdown
  useEffect(() => {
    if (gameState !== 'intermission') return;

    if (intermissionTimer > 0) {
      const t = setTimeout(() => {
        sounds.playTick(false);
        setIntermissionTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(t);
    } else {
      advanceNextTurn();
    }
  }, [intermissionTimer, gameState]);

  const advanceNextTurn = () => {
    const nextIdx = currentStudentIndex + 1;
    if (nextIdx < activeStudents.length) {
      setCurrentStudentIndex(nextIdx);
      setCurrentQ(generateSingleQuestion());
      setTimeLeft(timeLimit);
      setIsAnswered(false);
      setSelectedOption(null);
      setGameState('playing');
    } else {
      if (currentRound < roundsPerStudent) {
        setCurrentRound(prev => prev + 1);
        setCurrentStudentIndex(0);
        setCurrentQ(generateSingleQuestion());
        setTimeLeft(timeLimit);
        setIsAnswered(false);
        setSelectedOption(null);
        setGameState('playing');
      } else {
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
        })));

        sounds.playFanfare();
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        setGameState('finished');
      }
    }
  };

  const currentStudent = activeStudents[currentStudentIndex];
  const nextStudent = activeStudents[(currentStudentIndex + 1) % (activeStudents.length || 1)];

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

        <button
          onClick={() => setSoundOn(!soundOn)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          {soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
        </button>
      </header>

      {/* Main Container */}
      <main className={`flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full ${
        gameState === 'playing' ? 'p-1.5 overflow-hidden' : 'p-3 md:p-5'
      }`}>
        {/* SETUP SCREEN */}
        {gameState === 'setup' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl space-y-3.5"
          >
            {/* Top Bar with Upload Button */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm sm:text-base font-black text-white">
                  قائمة طلاب الصف
                </h2>
                <span className="text-xs text-amber-400 font-mono font-black bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  {toHindi(selectedStudentIds.size)} محدد
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع / لصق أسماء الطلاب</span>
                </button>

                {studentsList.length > 0 && (
                  <button
                    onClick={handleClearAllStudents}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs transition-colors"
                    title="مسح جميع الطلاب"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 1. Grade Selection Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {SCHOOL_GRADES.map(grade => (
                <button
                  key={grade.id}
                  onClick={() => { sounds.playTap(); setSelectedGradeId(grade.id); }}
                  className={`py-1.5 px-2.5 rounded-xl text-xs font-black transition-all border ${
                    selectedGradeId === grade.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {grade.name}
                </button>
              ))}
            </div>

            {/* 2. Section Tabs & Selection Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1">
                {['all', 'أ', 'ب', 'ج'].map(sec => (
                  <button
                    key={sec}
                    onClick={() => { sounds.playTap(); setSelectedSection(sec); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                      selectedSection === sec
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sec === 'all' ? 'جميع الفصول' : `فصل (${sec})`}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={selectAllVisible}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700"
                >
                  تحديد الكل
                </button>
                <button
                  onClick={clearVisibleSelection}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold border border-slate-700"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => selectRandomVisible(6)}
                  className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-bold border border-indigo-500/30 flex items-center gap-1"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>عشوائي (٦)</span>
                </button>
              </div>
            </div>

            {/* 3. Search and Quick Add Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="بحث عن اسم طالب..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-8 pl-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="إضافة اسم طالب جديد..."
                  value={singleStudentName}
                  onChange={e => setSingleStudentName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSingleStudent()}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleAddSingleStudent}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-slate-700 flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>

            {/* 4. Student Cards Grid (Compact & Simple with Level, Last Active, Participations) */}
            <div className="space-y-1">
              {visibleStudents.length === 0 ? (
                <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-2">
                  <p className="text-xs text-slate-400 font-bold">
                    لا توجد أسماء مسجلة في هذا الصف حتى الآن
                  </p>
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>لصق أو رفع أسماء الصف الآن</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-56 overflow-y-auto p-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  {visibleStudents.map(student => {
                    const isSelected = selectedStudentIds.has(student.id);

                    return (
                      <button
                        key={student.id}
                        onClick={() => toggleStudentSelection(student.id)}
                        className={`p-2 rounded-xl text-right flex flex-col justify-between transition-all border ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-400/90 text-white shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {/* Name and Checkmark */}
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className={`text-xs font-bold truncate ${isSelected ? 'text-amber-300 font-black' : 'text-slate-200'}`}>
                            {student.name}
                          </span>
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                            isSelected ? 'bg-amber-500 border-amber-400 text-slate-950' : 'border-slate-700 bg-slate-800'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>

                        {/* Micro Metadata: Level, Participations, Last Active */}
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-mono font-medium pt-1 border-t border-slate-800/80 mt-1 w-full">
                          <span className="text-amber-400 font-bold shrink-0">
                            ⭐ {toHindi(student.level || 1)}
                          </span>
                          <span>•</span>
                          <span className="shrink-0">
                            {toHindi(student.participationCount || 0)} مشاركات
                          </span>
                          <span>•</span>
                          <span className="truncate text-slate-400">
                            {student.lastActiveDate || 'جديد'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Multiplication Tables Selection */}
            <div className="space-y-1 pt-0.5">
              <span className="text-[11px] font-bold text-slate-300 block">جداول الضرب:</span>
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1">
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => { sounds.playTap(); toggleTable(n); }}
                    className={`h-8 rounded-lg font-black text-xs border transition-all font-mono ${
                      selectedTables.includes(n)
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-slate-800/60 text-slate-500 border-slate-700/50 hover:bg-slate-800'
                    }`}
                  >
                    {toHindi(n)}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Settings Bar */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="bg-slate-800/40 p-2 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold text-[11px]">أسئلة لكل طالب:</span>
                <span className="text-amber-400 font-black font-mono">{toHindi(roundsPerStudent)}</span>
              </div>
              <div className="bg-slate-800/40 p-2 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold text-[11px]">وقت السؤال:</span>
                <span className="text-amber-400 font-black font-mono">{toHindi(timeLimit)} ث</span>
              </div>
            </div>

            {/* Launch Button */}
            <button
              onClick={startClassCompetition}
              disabled={selectedStudentIds.size === 0}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>بدء مسابقة السبورة ({toHindi(selectedStudentIds.size)} طلاب)</span>
            </button>
          </motion.div>
        )}

        {/* ACTIVE PLAYING SCREEN (SMART BOARD - 100% VIEWPORT VISIBLE) */}
        {gameState === 'playing' && currentQ && currentStudent && (
          <div className="w-full max-w-4xl flex-1 flex flex-col justify-between py-1 space-y-2">
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
                  <span className="text-[9px] font-black block opacity-75 leading-none">النقاط:</span>
                  <span className="text-xs sm:text-sm font-black leading-tight text-slate-950">
                    {toHindi(currentStudent.score)}
                  </span>
                </div>

                <div className={`flex items-center gap-1 font-black text-sm sm:text-base font-mono px-2 py-0.5 rounded-lg bg-slate-950 ${
                  timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-amber-400'
                }`}>
                  <Timer className="w-3.5 h-3.5" />
                  <span>{toHindi(timeLeft)} ث</span>
                </div>
              </div>
            </motion.div>

            {/* Question Board with All 4 Options Visible */}
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
          </div>
        )}

        {/* 3-SECOND AUTOMATIC INTERMISSION */}
        {gameState === 'intermission' && currentStudent && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center shadow-md border-2">
              {lastCorrect ? (
                <div className="bg-emerald-500 text-slate-950 p-2.5 rounded-full">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
              ) : (
                <div className="bg-red-500 text-white p-2.5 rounded-full">
                  <XCircle className="w-7 h-7" />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-black text-white">
                {lastCorrect ? `أحسنت يا ${currentStudent.name}! 🌟` : `إجابة خاطئة يا ${currentStudent.name}`}
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">
                استعد يا <span className="text-amber-400 font-black">{nextStudent.name}</span>
              </p>
            </div>

            <div className="py-1">
              <span className="text-4xl font-black font-mono text-amber-400 animate-ping inline-block">
                {toHindi(intermissionTimer)}
              </span>
            </div>
          </motion.div>
        )}

        {/* FINISHED SCREEN */}
        {gameState === 'finished' && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl text-center space-y-3"
          >
            <div className="w-12 h-12 mx-auto rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
              <Trophy className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">نتائج مسابقة الفصل 🏆</h2>
            </div>

            {/* Ranks list */}
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {[...activeStudents].sort((a, b) => b.score - a.score).map((s, idx) => (
                <div
                  key={s.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between ${
                    idx === 0
                      ? 'bg-amber-500/15 border-amber-400 text-amber-300 shadow-sm'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg font-mono font-black text-xs flex items-center justify-center bg-slate-800">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : toHindi(idx + 1)}
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-xs block text-white">{s.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {toHindi(s.correctAnswers)} صحيحة من {toHindi(s.totalAnswered)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-amber-400 font-mono">{toHindi(s.score)}</span>
                    <button
                      onClick={() => onOpenCertificate(s.name, s.score, s.correctAnswers, s.totalAnswered)}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-400/30 text-xs font-bold flex items-center gap-1"
                    >
                      <Award className="w-3 h-3" />
                      <span>شهادة</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={startClassCompetition}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة المسابقة</span>
              </button>
              <button
                onClick={() => setGameState('setup')}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                <span>اختيار طلاب آخرين</span>
              </button>
            </div>
          </motion.div>
        )}
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
                  الصق أسماء الطلاب هنا (اسم في كل سطر من ملف إكسل أو وورد):
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
                  <span>حفظ وإضافة الطلاب للقائمة</span>
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
    </div>
  );
};
