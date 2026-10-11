/**
 * Teacher Live Game Dashboard Component
 * Riyadh Al-Ebdaa Schools
 * Ultra-interactive real-time monitoring screen for teachers during online competitions:
 * - Shows each student's score, rank, correct answers count, and wrong answers count
 * - Live question breakdown with options distribution & student picks
 * - Smartboard projection mode (hide picks to prevent classroom copying)
 * - Interactive classroom response matrix (Question vs Student grid)
 * - Clickable individual student answer inspector
 * - Teacher controls: Next Question skip, encouragement cheers, fullscreen, end room
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Timer,
  Eye,
  EyeOff,
  SkipForward,
  Table2,
  Users,
  Maximize2,
  Minimize2,
  LogOut,
  Flame,
  Sparkles,
  Search,
  X,
  Clock,
  Radio,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toHindi } from '../utils/format';
import { sounds } from '../utils/audio';
import { RiyadhEbdaaLogo } from './RiyadhEbdaaLogo';
import { getPublicUrl, copyToClipboard } from '../utils/publicUrl';

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

export interface Question {
  id: number;
  a: number;
  b: number;
  operation: '×' | '÷';
  answer: number;
  options: number[];
  text: string;
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
  students: Record<string, Student>;
  createdAt: number;
}

interface TeacherLiveGameDashboardProps {
  room: Room;
  roomId: string;
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
  activeRoomsCount: number;
  onOpenActiveRooms: () => void;
  onEndGame: () => void;
  showToast?: (msg: string) => void;
}

type ViewMode = 'cards' | 'matrix';
type FilterType = 'all' | 'answered' | 'thinking' | 'struggling';

export const TeacherLiveGameDashboard: React.FC<TeacherLiveGameDashboardProps> = ({
  room,
  roomId,
  isFullscreen,
  setIsFullscreen,
  activeRoomsCount,
  onOpenActiveRooms,
  onEndGame,
  showToast
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentForInspect, setSelectedStudentForInspect] = useState<Student | null>(null);
  const [hideStudentPicksOnBoard, setHideStudentPicksOnBoard] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const currentQ = room.questions[room.currentQuestionIndex];
  const totalQ = room.questions.length;
  const isIntermission = room.status === 'intermission';
  const now = Date.now();
  const intermissionSecs = Math.max(1, Math.ceil((room.intermissionEndsAt - now) / 1000));

  // All students sorted by score descending
  const sortedStudents = useMemo(() => {
    return Object.values(room.students || {}).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.correctCount - a.correctCount;
    });
  }, [room.students]);

  // Statistics for current question
  const currentQStats = useMemo(() => {
    if (!currentQ) return { answeredCount: 0, totalStudents: 0, correctCount: 0, wrongCount: 0, optionPicks: {} };
    const qIdx = room.currentQuestionIndex;
    let answered = 0;
    let correct = 0;
    let wrong = 0;
    const optionPicks: Record<number, string[]> = {};
    currentQ.options.forEach(opt => {
      optionPicks[opt] = [];
    });

    sortedStudents.forEach(s => {
      const ans = s.answers.find(a => a.questionIndex === qIdx);
      if (ans) {
        answered++;
        if (ans.isCorrect) correct++;
        else wrong++;
        if (!optionPicks[ans.selectedOption]) {
          optionPicks[ans.selectedOption] = [];
        }
        optionPicks[ans.selectedOption].push(s.name);
      }
    });

    return {
      answeredCount: answered,
      totalStudents: sortedStudents.length,
      correctCount: correct,
      wrongCount: wrong,
      optionPicks
    };
  }, [currentQ, room.currentQuestionIndex, sortedStudents]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    const qIdx = room.currentQuestionIndex;
    return sortedStudents.filter(s => {
      if (searchQuery && !s.name.includes(searchQuery)) return false;
      const ans = s.answers.find(a => a.questionIndex === qIdx);
      if (filter === 'answered') return !!ans;
      if (filter === 'thinking') return !ans;
      if (filter === 'struggling') {
        const wrongCount = s.answers.filter(a => !a.isCorrect).length;
        return wrongCount > 0;
      }
      return true;
    });
  }, [sortedStudents, filter, searchQuery, room.currentQuestionIndex]);

  // Teacher manual advance to next question
  const handleNextQuestion = async () => {
    if (isSkipping) return;
    setIsSkipping(true);
    sounds.playTap();
    try {
      const res = await fetch(`/api/rooms/${roomId}/next`, { method: 'POST' });
      if (res.ok) {
        if (showToast) showToast('تم الانتقال للسؤال التالي بنجاح');
      }
    } catch {
      // ignore
    } finally {
      setIsSkipping(false);
    }
  };

  // Cheer / Applause button for classroom excitement
  const handleTeacherCheer = () => {
    sounds.playCorrect();
    sounds.playFanfare();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    if (showToast) showToast('👏 تم إرسال تشجيع وتصفيق للطلاب!');
  };

  // Copy share link
  const handleCopyLink = async () => {
    const url = getPublicUrl(`?room=${roomId}`);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedLink(true);
      sounds.playTap();
      if (showToast) showToast('تم نسخ الرابط العام للغرفة');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className={`min-h-screen ${isFullscreen ? 'bg-black' : 'bg-slate-950'} text-white font-sans p-3 sm:p-5 flex flex-col justify-between dir-rtl select-none`}>
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP TEACHER COMMAND BAR                                    */}
      {/* ------------------------------------------------------------- */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 max-w-7xl mx-auto w-full">
        {/* Brand & Room Info */}
        <div className="flex items-center gap-3">
          <RiyadhEbdaaLogo size="xs" />
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-black text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                <span>بث شاشة المعلم المباشرة</span>
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                رمز الغرفة: <span className="text-amber-400 font-black">{roomId}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-black text-white">{room.title || 'المسابقة الرياضية'}</span>
              <span className="text-[11px] text-emerald-400 font-bold">
                • {toHindi(sortedStudents.length)} طلاب متصلين
              </span>
            </div>
          </div>
        </div>

        {/* Question Counter & Teacher Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* View Mode Toggle: Cards vs Matrix */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={() => { sounds.playTap(); setViewMode('cards'); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>بطاقات الطلاب</span>
            </button>
            <button
              onClick={() => { sounds.playTap(); setViewMode('matrix'); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                viewMode === 'matrix' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>مصفوفة الإجابات الكاملة</span>
            </button>
          </div>

          {/* Hide/Show student picks on Smartboard toggle */}
          <button
            onClick={() => {
              sounds.playTap();
              setHideStudentPicksOnBoard(prev => !prev);
              if (showToast) {
                showToast(!hideStudentPicksOnBoard ? 'تم إخفاء خيارات الطلاب (وضع العرض للسبورة)' : 'تم إظهار خيارات الطلاب للمعلم');
              }
            }}
            title={hideStudentPicksOnBoard ? 'إظهار خيارات الطلاب' : 'إخفاء خيارات الطلاب على الشاشة لمنع الغش'}
            className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors ${
              hideStudentPicksOnBoard
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            {hideStudentPicksOnBoard ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">{hideStudentPicksOnBoard ? 'خيارات الطلاب مخفية' : 'إخفاء الخيارات للسبورة'}</span>
          </button>

          {/* Teacher Cheer & Confetti */}
          <button
            onClick={handleTeacherCheer}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">تشجيع</span>
          </button>

          {/* Skip / Next Question */}
          <button
            onClick={handleNextQuestion}
            disabled={isSkipping}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>السؤال التالي</span>
          </button>

          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            title="نسخ رابط الانضمام"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>

          {/* Active rooms */}
          <button
            onClick={onOpenActiveRooms}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold"
          >
            الغرف ({toHindi(activeRoomsCount)})
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            title={isFullscreen ? 'تصغير' : 'ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* End Room */}
          <button
            onClick={onEndGame}
            className="px-2.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-black flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>إنهاء</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN TEACHER STAGE: QUESTION & OPTIONS BREAKDOWN          */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 my-3 max-w-7xl mx-auto w-full flex flex-col space-y-4">
        {/* Question Header & Live Answer Progress Pill */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-6 rounded-3xl shadow-xl relative overflow-hidden">
          {/* Question Number & Real-time Answering Gauge */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-indigo-300 bg-indigo-500/15 px-3 py-1 rounded-xl border border-indigo-500/20">
                السؤال {toHindi(room.currentQuestionIndex + 1)} من {toHindi(totalQ)}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {currentQ?.operation === '×' ? 'جدول الضرب' : 'عمليات القسمة'}
              </span>
            </div>

            {/* Answered counter indicator */}
            <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1 rounded-xl border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-black text-slate-200">
                أجاب {toHindi(currentQStats.answeredCount)} من {toHindi(currentQStats.totalStudents)} طلاب
              </span>
              <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden mr-1">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{
                    width: `${currentQStats.totalStudents > 0 ? (currentQStats.answeredCount / currentQStats.totalStudents) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Intermission Screen vs Question Screen */}
          {isIntermission ? (
            <div className="py-6 text-center space-y-3">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-block px-4 py-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-black"
              >
                ✓ تم احتساب إجابات جميع الطلاب! الإجابة الصحيحة هي: {toHindi(currentQ.answer)}
              </motion.div>

              <div className="text-xs text-slate-400 font-bold">
                السؤال القادم يبدأ تلقائياً خلال:
              </div>
              <div className="text-6xl font-black text-amber-400 font-mono tracking-widest animate-pulse">
                {toHindi(intermissionSecs)}
              </div>

              {/* Accuracy of current question */}
              <div className="flex items-center justify-center gap-4 text-xs font-black pt-2">
                <span className="text-emerald-400">
                  الإجابات الصحيحة: {toHindi(currentQStats.correctCount)} ({toHindi(currentQStats.totalStudents > 0 ? Math.round((currentQStats.correctCount / currentQStats.totalStudents) * 100) : 0)}٪)
                </span>
                <span className="text-red-400">
                  الإجابات الخاطئة: {toHindi(currentQStats.wrongCount)}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2 text-center space-y-4">
              {/* Math Equation */}
              <div className="py-1 select-none font-mono">
                <div className="text-5xl sm:text-6xl md:text-7xl font-black text-white tracking-widest flex items-center justify-center gap-3 sm:gap-5">
                  <span>{toHindi(currentQ.a)}</span>
                  <span className="text-amber-400">{currentQ.operation}</span>
                  <span>{toHindi(currentQ.b)}</span>
                  <span className="text-slate-600">=</span>
                  <span className="text-indigo-400">؟</span>
                </div>
              </div>

              {/* 4 Interactive Options Side-by-Side with Live Student Distribution */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-4xl mx-auto w-full pt-1">
                {currentQ.options.map((opt, i) => {
                  const studentPicks = currentQStats.optionPicks[opt] || [];
                  const isCorrectAnswer = opt === currentQ.answer;

                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-2xl border transition-all text-center flex flex-col justify-between min-h-[90px] ${
                        isIntermission
                          ? isCorrectAnswer
                            ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-500/20'
                            : 'bg-slate-900 border-slate-800 text-slate-500 opacity-60'
                          : studentPicks.length > 0
                          ? 'bg-slate-800 border-indigo-500/50 shadow-md'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Option Number */}
                      <div className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white">
                        {toHindi(opt)}
                      </div>

                      {/* Pick Count Badge */}
                      <div className="pt-2 flex items-center justify-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          studentPicks.length > 0
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-500'
                        }`}>
                          {toHindi(studentPicks.length)} {studentPicks.length === 1 ? 'طالب' : 'طلاب'}
                        </span>

                        {/* List of Student names who picked this (hidden if teacher activates smartboard hide mode) */}
                        {!hideStudentPicksOnBoard && studentPicks.length > 0 && (
                          <div className="w-full flex flex-wrap items-center justify-center gap-1 pt-1">
                            {studentPicks.map(name => (
                              <span
                                key={name}
                                className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-950/80 text-slate-300 border border-slate-800 truncate max-w-[90px]"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 3. TEACHER DASHBOARD VIEW: CARDS vs MATRIX                    */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'cards' ? (
          <div className="space-y-3">
            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-2xl border border-slate-800">
                <button
                  onClick={() => { sounds.playTap(); setFilter('all'); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                    filter === 'all' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  الكل ({toHindi(sortedStudents.length)})
                </button>
                <button
                  onClick={() => { sounds.playTap(); setFilter('answered'); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                    filter === 'answered' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  أجابوا السؤال ({toHindi(currentQStats.answeredCount)})
                </button>
                <button
                  onClick={() => { sounds.playTap(); setFilter('thinking'); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                    filter === 'thinking' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  يفكرون الآن ({toHindi(currentQStats.totalStudents - currentQStats.answeredCount)})
                </button>
                <button
                  onClick={() => { sounds.playTap(); setFilter('struggling'); }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                    filter === 'struggling' ? 'bg-red-500 text-white font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  لديهم أخطاء ⚠️
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-44 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="بحث عن طالب..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1 pr-8 pl-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Student Cards Grid (Compact, Highly Detailed) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {filteredStudents.map((s, idx) => {
                const qIdx = room.currentQuestionIndex;
                const currentAnswer = s.answers.find(a => a.questionIndex === qIdx);
                const wrongCount = s.answers.filter(a => !a.isCorrect).length;
                const totalAnswered = s.answers.length;
                const accuracy = totalAnswered > 0 ? Math.round((s.correctCount / totalAnswered) * 100) : 100;
                const rank = idx + 1;

                return (
                  <motion.div
                    key={s.name}
                    layout
                    whileHover={{ scale: 1.01 }}
                    onClick={() => { sounds.playTap(); setSelectedStudentForInspect(s); }}
                    className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 shadow-lg cursor-pointer transition-all flex flex-col justify-between space-y-2.5 relative group"
                  >
                    {/* Top row: Rank, Name, and Streak */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Rank Badge */}
                        <span className={`w-6 h-6 rounded-lg text-xs font-black font-mono flex items-center justify-center shrink-0 ${
                          rank === 1
                            ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                            : rank === 2
                            ? 'bg-slate-300 text-slate-950'
                            : rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {toHindi(rank)}
                        </span>

                        <span className="font-bold text-sm text-white truncate max-w-[130px]" title={s.name}>
                          {s.name}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="text-right">
                        <span className="text-base font-black text-amber-400 font-mono">
                          {toHindi(s.score)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold block -mt-1">نقطة</span>
                      </div>
                    </div>

                    {/* Middle row: Correct / Wrong / Accuracy Metrics */}
                    <div className="grid grid-cols-3 gap-1.5 py-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">صحيح</span>
                        <span className="text-xs font-black text-emerald-400 font-mono">
                          ✓ {toHindi(s.correctCount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">خطأ</span>
                        <span className="text-xs font-black text-red-400 font-mono">
                          ✗ {toHindi(wrongCount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">الدقة</span>
                        <span className="text-xs font-black text-indigo-300 font-mono">
                          {toHindi(accuracy)}٪
                        </span>
                      </div>
                    </div>

                    {/* Bottom row: Current Question Live Status */}
                    <div className="pt-0.5">
                      {currentAnswer ? (
                        <div className={`p-1.5 rounded-xl text-[11px] font-black flex items-center justify-between ${
                          currentAnswer.isCorrect
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-300 border border-red-500/30'
                        }`}>
                          <div className="flex items-center gap-1 truncate">
                            {currentAnswer.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                            <span>
                              {currentAnswer.isCorrect
                                ? `أصاب (+${toHindi(currentAnswer.pointsEarned)})`
                                : `أخطأ (اختار: ${toHindi(currentAnswer.selectedOption)})`}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {toHindi(currentAnswer.timeSpent.toFixed(1))}ث
                          </span>
                        </div>
                      ) : (
                        <div className="p-1.5 rounded-xl bg-slate-800/60 text-slate-400 border border-slate-800 text-[11px] font-bold flex items-center justify-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          <span>يفكّر في السؤال الآن...</span>
                        </div>
                      )}
                    </div>

                    {/* Streak indicator if active */}
                    {s.streak >= 2 && (
                      <div className="absolute top-1 left-1.5 flex items-center gap-0.5 text-[10px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                        <Flame className="w-2.5 h-2.5 fill-current" />
                        <span>{toHindi(s.streak)}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* 4. CLASSROOM RESPONSE MATRIX (STUDENT vs QUESTIONS GRID)      */
          /* ------------------------------------------------------------- */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl overflow-hidden space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-black text-white">
                  مصفوفة الإجابات التفاعلية لجميع الأسئلة
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-bold">
                اضغط على اسم أي طالب لمعاينة تحليله الفردي
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold">
                    <th className="py-2.5 px-3">الترتيب</th>
                    <th className="py-2.5 px-3">اسم الطالب</th>
                    <th className="py-2.5 px-3 text-center">النقاط</th>
                    {room.questions.map((q, qIndex) => (
                      <th key={q.id} className="py-2.5 px-2 text-center font-mono">
                        س{toHindi(qIndex + 1)}
                      </th>
                    ))}
                    <th className="py-2.5 px-2 text-center text-emerald-400 font-bold">صحيح</th>
                    <th className="py-2.5 px-2 text-center text-red-400 font-bold">خطأ</th>
                    <th className="py-2.5 px-2 text-center font-bold">الدقة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {sortedStudents.map((s, idx) => {
                    const wrongCount = s.answers.filter(a => !a.isCorrect).length;
                    const totalAnswered = s.answers.length;
                    const accuracy = totalAnswered > 0 ? Math.round((s.correctCount / totalAnswered) * 100) : 100;

                    return (
                      <tr
                        key={s.name}
                        onClick={() => { sounds.playTap(); setSelectedStudentForInspect(s); }}
                        className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <td className="py-2 px-3 font-bold text-slate-400">
                          {toHindi(idx + 1)}
                        </td>
                        <td className="py-2 px-3 font-sans font-black text-white">
                          {s.name}
                        </td>
                        <td className="py-2 px-3 text-center font-black text-amber-400 font-mono">
                          {toHindi(s.score)}
                        </td>

                        {/* Question by question cells */}
                        {room.questions.map((q, qIndex) => {
                          const ans = s.answers.find(a => a.questionIndex === qIndex);
                          const isCurrent = qIndex === room.currentQuestionIndex;

                          if (ans) {
                            return (
                              <td key={q.id} className="py-2 px-1 text-center">
                                <span
                                  title={`اختار: ${ans.selectedOption} | الزمن: ${ans.timeSpent}ث`}
                                  className={`inline-block w-6 h-6 rounded-md text-[11px] font-black leading-6 ${
                                    ans.isCorrect
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                                  }`}
                                >
                                  {ans.isCorrect ? '✓' : '✗'}
                                </span>
                              </td>
                            );
                          } else if (isCurrent) {
                            return (
                              <td key={q.id} className="py-2 px-1 text-center">
                                <span className="inline-block w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] leading-6 animate-pulse">
                                  ⏳
                                </span>
                              </td>
                            );
                          } else {
                            return (
                              <td key={q.id} className="py-2 px-1 text-center text-slate-700">
                                -
                              </td>
                            );
                          }
                        })}

                        <td className="py-2 px-2 text-center text-emerald-400 font-black">
                          {toHindi(s.correctCount)}
                        </td>
                        <td className="py-2 px-2 text-center text-red-400 font-black">
                          {toHindi(wrongCount)}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-indigo-300">
                          {toHindi(accuracy)}٪
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 5. STUDENT ANSWERS INSPECTOR MODAL                            */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedStudentForInspect && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 dir-rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col justify-between"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{selectedStudentForInspect.name}</h3>
                    <span className="text-xs text-amber-400 font-bold font-mono">
                      مجموع النقاط: {toHindi(selectedStudentForInspect.score)} نقطة
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStudentForInspect(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">الإجابات الصحيحة</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {toHindi(selectedStudentForInspect.correctCount)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">الإجابات الخاطئة</span>
                  <span className="text-base font-black text-red-400 font-mono">
                    {toHindi(selectedStudentForInspect.answers.filter(a => !a.isCorrect).length)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">نسبة الدقة</span>
                  <span className="text-base font-black text-indigo-400 font-mono">
                    {toHindi(
                      selectedStudentForInspect.answers.length > 0
                        ? Math.round(
                            (selectedStudentForInspect.correctCount / selectedStudentForInspect.answers.length) * 100
                          )
                        : 100
                    )}٪
                  </span>
                </div>
              </div>

              {/* Answers Log */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-72">
                <span className="text-xs font-bold text-slate-400 block pb-1">
                  سجل الأسئلة والإجابات بالتفصيل:
                </span>

                {room.questions.map((q, qIndex) => {
                  const ans = selectedStudentForInspect.answers.find(a => a.questionIndex === qIndex);

                  return (
                    <div
                      key={q.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        ans
                          ? ans.isCorrect
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-200'
                            : 'bg-red-500/10 border-red-500/30 text-slate-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-300 font-mono font-bold flex items-center justify-center text-[10px]">
                          {toHindi(qIndex + 1)}
                        </span>
                        <span className="font-mono font-black text-sm text-white">
                          {toHindi(q.a)} {q.operation} {toHindi(q.b)} = {toHindi(q.answer)}
                        </span>
                      </div>

                      {ans ? (
                        <div className="flex items-center gap-3">
                          <span className="font-bold">
                            اختياره: <span className="font-mono font-black">{toHindi(ans.selectedOption)}</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            ans.isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                          }`}>
                            {ans.isCorrect ? `✓ صح (+${toHindi(ans.pointsEarned)})` : '✗ خطأ'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {toHindi(ans.timeSpent.toFixed(1))}ث
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 font-bold text-[11px]">
                          لم يصل إليه بعد
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedStudentForInspect(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
