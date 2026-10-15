/**
 * Teacher Live Game Dashboard Component
 * Riyadh Al-Ebdaa Schools
 * Ultra-interactive real-time monitoring screen for teachers during online competitions:
 * - Direct side-by-side display of both students and their live scores
 * - 3-second intermission countdown with immediate answer correction
 * - Full suite of professional teacher controls (Next, Prev, Repeat, Reveal Answer, Cheer)
 * - Prominent QR Code modal with instant 1-click "Return to Questions"
 * - Instant "Add Test Student" (named "تجريبي" only)
 * - Zero clutter and concise, professional layout
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Timer,
  Eye,
  EyeOff,
  SkipForward,
  SkipBack,
  RotateCcw,
  Lightbulb,
  Table2,
  Users,
  Maximize2,
  Minimize2,
  LogOut,
  Flame,
  Sparkles,
  Search,
  X,
  Radio,
  Share2,
  Copy,
  Check,
  QrCode,
  Bot,
  Swords,
  ChevronRight,
  ChevronLeft,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeCanvas } from 'qrcode.react';
import { toHindi } from '../utils/format';
import { sounds } from '../utils/audio';
import { RiyadhEbdaaLogo } from './RiyadhEbdaaLogo';
import { getPublicUrl, copyToClipboard } from '../utils/publicUrl';
import { getHostAuthHeaders } from '../utils/auth';

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
  roomType: 'duel' | 'group';
  status: 'lobby' | 'playing' | 'intermission' | 'finished';
  config: {
    tables: number[];
    questionsCount: number;
    timePerQuestion: number;
    mode: 'multi' | 'divi' | 'mixed';
  };
  questions: Array<{
    id: string | number;
    a: number;
    b: number;
    operation: '×' | '÷';
    answer: number;
    options: number[];
  }>;
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
  setIsFullscreen: (full: boolean) => void;
  activeRoomsCount: number;
  onOpenActiveRooms: () => void;
  onEndGame: () => void;
  onRoomUpdate?: (room: any) => void;
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
  onRoomUpdate,
  showToast
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentForInspect, setSelectedStudentForInspect] = useState<Student | null>(null);
  const [hideStudentPicksOnBoard, setHideStudentPicksOnBoard] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isAddingBot, setIsAddingBot] = useState(false);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowQrModal(false);
        setSelectedStudentForInspect(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentQ = room.questions[room.currentQuestionIndex];
  const totalQ = room.questions.length;
  const isIntermission = room.status === 'intermission';
  const now = Date.now();
  const intermissionSecs = Math.max(1, Math.ceil((room.intermissionEndsAt - now) / 1000));

  // Reset reveal answer toggle on new question
  useEffect(() => {
    setRevealAnswer(false);
  }, [room.currentQuestionIndex]);

  // All students sorted by score descending
  const sortedStudents = useMemo(() => {
    return Object.values(room.students || {}).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.correctCount - a.correctCount;
    });
  }, [room.students]);

  // Two primary students (for head-to-head match)
  const student1 = sortedStudents[0] || null;
  const student2 = sortedStudents[1] || null;

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

  // Next Question
  const handleNextQuestion = async () => {
    if (isSkipping) return;
    setIsSkipping(true);
    sounds.playTap();
    try {
      const res = await fetch(`/api/rooms/${roomId}/next`, {
        method: 'POST',
        headers: getHostAuthHeaders(roomId)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room && onRoomUpdate) {
          onRoomUpdate(data.room);
        }
        if (showToast) {
          showToast('تم الانتقال للسؤال التالي');
        }
      }
    } catch {
      // ignore
    } finally {
      setIsSkipping(false);
    }
  };

  // Previous Question
  const handlePrevQuestion = async () => {
    sounds.playTap();
    try {
      const res = await fetch(`/api/rooms/${roomId}/prev`, {
        method: 'POST',
        headers: getHostAuthHeaders(roomId)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room && onRoomUpdate) {
          onRoomUpdate(data.room);
        }
        if (showToast) {
          showToast('تم الرجوع للسؤال السابق');
        }
      }
    } catch {
      // ignore
    }
  };

  // Repeat current question
  const handleRepeatQuestion = async () => {
    sounds.playTap();
    try {
      const res = await fetch(`/api/rooms/${roomId}/repeat`, {
        method: 'POST',
        headers: getHostAuthHeaders(roomId)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room && onRoomUpdate) {
          onRoomUpdate(data.room);
        }
        if (showToast) {
          showToast('تمت إعادة تشغيل السؤال الحالي وتصفير الإجابات');
        }
      }
    } catch {
      // ignore
    }
  };

  // Add test student (Named "تجريبي" only)
  const handleAddTestStudent = async () => {
    if (isAddingBot) return;
    setIsAddingBot(true);
    sounds.playTap();
    try {
      const res = await fetch(`/api/rooms/${roomId}/add-test-student`, {
        method: 'POST',
        headers: getHostAuthHeaders(roomId)
      });
      if (res.ok && showToast) {
        showToast('تمت إضافة طالب تجريبي بنجاح');
      }
    } catch {
      // ignore
    } finally {
      setIsAddingBot(false);
    }
  };

  // Cheer & Confetti
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
      if (showToast) showToast('تم نسخ رابط الغرفة المباشر');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const getStudentAnswerForCurrentQ = (student: Student | null) => {
    if (!student) return null;
    return student.answers.find(a => a.questionIndex === room.currentQuestionIndex) || null;
  };

  return (
    <div className={`min-h-screen ${isFullscreen ? 'bg-black' : 'bg-slate-950'} text-white font-sans p-2 sm:p-4 flex flex-col justify-between dir-rtl select-none`}>
      {/* ------------------------------------------------------------- */}
      {/* 1. PROFESSIONAL TEACHER COMMAND BAR                            */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between gap-2.5 shadow-lg">
        {/* Brand & Room Info */}
        <div className="flex items-center gap-2.5">
          <RiyadhEbdaaLogo size="xs" />
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>شاشة المعلم المباشرة</span>
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-300 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                الغرفة: <span className="text-amber-400 font-black">{roomId}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-black text-white">{room.title || 'مسابقة جدول الضرب'}</span>
              <span className="text-[10px] text-emerald-400 font-bold">
                • {toHindi(sortedStudents.length)} طلاب
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Barcode Button */}
          <button
            onClick={() => {
              sounds.playTap();
              setShowQrModal(true);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-black flex items-center gap-1.5 transition-all shadow-sm"
            title="فتح باركود الغرفة للطلاب"
          >
            <QrCode className="w-4 h-4 text-amber-400" />
            <span>عرض الباركود</span>
          </button>

          {/* Add Test Student */}
          <button
            onClick={handleAddTestStudent}
            disabled={isAddingBot}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="إضافة طالب تجريبي بدون الذكي"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span>+ طالب تجريبي</span>
          </button>

          {/* Reveal Correct Answer Toggle */}
          <button
            onClick={() => {
              sounds.playTap();
              setRevealAnswer(prev => !prev);
              if (showToast) {
                showToast(!revealAnswer ? 'تم كشف الإجابة الصحيحة' : 'تم إخفاء الإجابة');
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
              revealAnswer
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-black'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title="كشف الإجابة الصحيحة على الشاشة"
          >
            <Lightbulb className={`w-3.5 h-3.5 ${revealAnswer ? 'text-emerald-400 fill-emerald-400' : 'text-slate-400'}`} />
            <span>{revealAnswer ? 'الإجابة مكشوفة' : 'كشف الإجابة'}</span>
          </button>

          {/* Hide Student Picks on Smartboard */}
          <button
            onClick={() => {
              sounds.playTap();
              setHideStudentPicksOnBoard(prev => !prev);
              if (showToast) {
                showToast(!hideStudentPicksOnBoard ? 'تم إخفاء اختيارات الطلاب لمنع الغش' : 'تم إظهار الاختيارات');
              }
            }}
            className={`p-1.5 rounded-xl border text-xs font-bold transition-all ${
              hideStudentPicksOnBoard
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title={hideStudentPicksOnBoard ? 'إظهار اختيارات الطلاب' : 'إخفاء الاختيارات لمنع الغش'}
          >
            {hideStudentPicksOnBoard ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {/* Repeat Current Question */}
          <button
            onClick={handleRepeatQuestion}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            title="إعادة السؤال الحالي وتصفير الإجابات"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Previous Question */}
          <button
            onClick={handlePrevQuestion}
            disabled={room.currentQuestionIndex === 0}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 border border-slate-800"
            title="السؤال السابق"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Next Question */}
          <button
            onClick={handleNextQuestion}
            disabled={isSkipping}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1 shadow-md shadow-indigo-600/20 transition-all"
            title="الانتقال للسؤال التالي"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>السؤال التالي</span>
          </button>

          {/* Teacher Cheer */}
          <button
            onClick={handleTeacherCheer}
            className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30"
            title="تشجيع وتصفيق احتفالي"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            title="نسخ رابط الانضمام"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
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
            title="إنهاء المسابقة"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>إنهاء</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. LIVE TWO-STUDENT HEAD-TO-HEAD MATCHUP & LIVE SCORES        */}
      {/* ------------------------------------------------------------- */}
      <section className="my-2 max-w-7xl mx-auto w-full">
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black text-white">المواجهة المباشرة بين الطلاب والدرجات المحدثة</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Cards vs Matrix View toggle */}
              <button
                onClick={() => setViewMode(viewMode === 'cards' ? 'matrix' : 'cards')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
              >
                {viewMode === 'cards' ? <Table2 className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                <span>{viewMode === 'cards' ? 'عرض مصفوفة الإجابات' : 'عرض بطاقات المتسابقين'}</span>
              </button>
            </div>
          </div>

          {/* Side-by-Side Dual Student Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
            {/* Student 1 Card */}
            {student1 ? (
              <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-slate-950 to-slate-900 border border-amber-500/30 shadow-md relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-sm">
                      {student1.name === 'تجريبي' ? <Bot className="w-5 h-5 text-indigo-400" /> : <Trophy className="w-5 h-5 text-amber-400" />}
                    </div>
                    <div>
                      <span className="font-black text-base text-white block">{student1.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        صحيح: {toHindi(student1.correctCount)} | خطأ: {toHindi(student1.answers.filter(a => !a.isCorrect).length)}
                      </span>
                    </div>
                  </div>

                  {/* Big Live Score with Percentage */}
                  <div className="text-left font-mono">
                    <span className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight block">
                      {toHindi(student1.score)} درجات
                    </span>
                    <span className="text-xs font-black text-emerald-400 block -mt-0.5">
                      ({toHindi(totalQ > 0 ? Math.round((student1.score / totalQ) * 100) : 0)}٪)
                    </span>
                  </div>
                </div>

                {/* Live Answer Status for Current Question */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                  {(() => {
                    const ans = getStudentAnswerForCurrentQ(student1);
                    if (ans) {
                      return (
                        <div className={`p-2 rounded-xl text-xs font-black flex items-center justify-between ${
                          ans.isCorrect
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-300 border border-red-500/30'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            {ans.isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                            <span>
                              {ans.isCorrect
                                ? `أجاب إجابة صحيحة (+${toHindi(ans.pointsEarned)} نقطة)`
                                : `أجاب إجابة خاطئة (اختار: ${toHindi(ans.selectedOption)})`}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {toHindi(ans.timeSpent.toFixed(1))}ث
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="p-2 rounded-xl bg-slate-950/80 text-amber-400 border border-amber-500/20 text-xs font-bold flex items-center justify-center gap-1.5">
                        <Timer className="w-4 h-4 animate-spin text-amber-400" />
                        <span>يفكّر في الإجابة الآن...</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
                في انتظار انضمام الطالب الأول...
              </div>
            )}

            {/* Student 2 Card */}
            {student2 ? (
              <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-slate-950 to-slate-900 border border-indigo-500/30 shadow-md relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black text-sm">
                      {student2.name === 'تجريبي' ? <Bot className="w-5 h-5 text-indigo-400" /> : <Trophy className="w-5 h-5 text-indigo-400" />}
                    </div>
                    <div>
                      <span className="font-black text-base text-white block">{student2.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        صحيح: {toHindi(student2.correctCount)} | خطأ: {toHindi(student2.answers.filter(a => !a.isCorrect).length)}
                      </span>
                    </div>
                  </div>

                  {/* Big Live Score with Percentage */}
                  <div className="text-left font-mono">
                    <span className="text-2xl sm:text-3xl font-black text-indigo-300 tracking-tight block">
                      {toHindi(student2.score)} درجات
                    </span>
                    <span className="text-xs font-black text-emerald-400 block -mt-0.5">
                      ({toHindi(totalQ > 0 ? Math.round((student2.score / totalQ) * 100) : 0)}٪)
                    </span>
                  </div>
                </div>

                {/* Live Answer Status for Current Question */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                  {(() => {
                    const ans = getStudentAnswerForCurrentQ(student2);
                    if (ans) {
                      return (
                        <div className={`p-2 rounded-xl text-xs font-black flex items-center justify-between ${
                          ans.isCorrect
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-300 border border-red-500/30'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            {ans.isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                            <span>
                              {ans.isCorrect
                                ? `أجاب إجابة صحيحة (+${toHindi(ans.pointsEarned)} نقطة)`
                                : `أجاب إجابة خاطئة (اختار: ${toHindi(ans.selectedOption)})`}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {toHindi(ans.timeSpent.toFixed(1))}ث
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="p-2 rounded-xl bg-slate-950/80 text-amber-400 border border-amber-500/20 text-xs font-bold flex items-center justify-center gap-1.5">
                        <Timer className="w-4 h-4 animate-spin text-amber-400" />
                        <span>يفكّر في الإجابة الآن...</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-dashed border-indigo-500/30 flex flex-col items-center justify-center gap-2 text-center">
                <span className="text-xs text-slate-400 font-bold">لا يوجد منافس ثانٍ حالياً</span>
                <button
                  onClick={handleAddTestStudent}
                  disabled={isAddingBot}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>إضافة طالب تجريبي لبدء المنافسة فوراً</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN QUESTION ARENA & OPTIONS DISTRIBUTION                */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 my-2 max-w-7xl mx-auto w-full flex flex-col space-y-3">
        <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-xl text-center space-y-3 relative overflow-hidden">
          {/* Header of Question */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-black text-indigo-300 bg-indigo-500/15 px-3 py-1 rounded-xl border border-indigo-500/20">
                السؤال {toHindi(room.currentQuestionIndex + 1)} من {toHindi(totalQ)}
              </span>
              <span className="text-slate-400 font-bold">
                {currentQ?.operation === '×' ? 'جدول الضرب' : 'عمليات القسمة'}
              </span>
            </div>

            {/* Answered progress */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-black text-slate-300">
                أجاب {toHindi(currentQStats.answeredCount)} من {toHindi(currentQStats.totalStudents)}
              </span>
            </div>
          </div>

          {/* Intermission Screen vs Active Question */}
          {isIntermission ? (
            <div className="py-4 space-y-3">
              <div className="inline-block px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-base font-black">
                ✓ اكتملت إجابات السؤال! الإجابة الصحيحة: {toHindi(currentQ.answer)}
              </div>

              <div className="text-xs text-slate-400 font-bold">
                الانتقال للسؤال التالي تلقائياً خلال:
              </div>
              <div className="text-6xl font-black text-amber-400 font-mono tracking-widest animate-pulse">
                {toHindi(intermissionSecs)}
              </div>

              <div>
                <button
                  onClick={handleNextQuestion}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>الانتقال فوراً الآن</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-1 space-y-4">
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

              {/* 4 Options Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-4xl mx-auto w-full pt-1">
                {currentQ.options.map((opt, i) => {
                  const studentPicks = currentQStats.optionPicks[opt] || [];
                  const isCorrectAnswer = opt === currentQ.answer;
                  const isRevealed = revealAnswer;

                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-2xl border transition-all text-center flex flex-col justify-between space-y-2 ${
                        isRevealed && isCorrectAnswer
                          ? 'bg-emerald-600/30 border-emerald-400 ring-2 ring-emerald-500/40'
                          : 'bg-slate-950/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                        <span>خيار ({toHindi(i + 1)})</span>
                        {isRevealed && isCorrectAnswer && (
                          <span className="text-emerald-400 font-black flex items-center gap-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>الصحيح</span>
                          </span>
                        )}
                      </div>

                      {/* Number Display */}
                      <span className={`text-3xl sm:text-4xl font-black font-mono tracking-wider ${
                        isRevealed && isCorrectAnswer ? 'text-emerald-300' : 'text-white'
                      }`}>
                        {toHindi(opt)}
                      </span>

                      {/* Student picks distribution */}
                      <div className="min-h-[22px] flex items-center justify-center">
                        {!hideStudentPicksOnBoard && studentPicks.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap justify-center">
                            {studentPicks.map(name => (
                              <span
                                key={name}
                                className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold truncate max-w-[80px]"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : studentPicks.length > 0 ? (
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md">
                            {toHindi(studentPicks.length)} اختيارات
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">-</span>
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
        {/* 4. CLASSROOM RESPONSE MATRIX (WHEN TOGGLED)                  */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'matrix' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-xl overflow-hidden space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-black text-white">مصفوفة الإجابات التفاعلية</h3>
              </div>
              <button
                onClick={() => setViewMode('cards')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
              >
                العودة للبطاقات
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold">
                    <th className="py-2 px-3">الاسم</th>
                    <th className="py-2 px-3 text-center">الدرجة والنسبة</th>
                    {room.questions.map((q, qIndex) => (
                      <th key={q.id} className="py-2 px-1 text-center font-mono">
                        س{toHindi(qIndex + 1)}
                      </th>
                    ))}
                    <th className="py-2 px-2 text-center text-emerald-400">صحيح</th>
                    <th className="py-2 px-2 text-center text-red-400">خطأ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {sortedStudents.map(s => {
                    const wrongCount = s.answers.filter(a => !a.isCorrect).length;
                    const pct = totalQ > 0 ? Math.round((s.score / totalQ) * 100) : 0;
                    return (
                      <tr
                        key={s.name}
                        onClick={() => setSelectedStudentForInspect(s)}
                        className="hover:bg-slate-800/60 cursor-pointer"
                      >
                        <td className="py-2 px-3 font-sans font-black text-white">
                          {s.name}
                        </td>
                        <td className="py-2 px-3 text-center font-black text-amber-400">
                          {toHindi(s.score)} درجات ({toHindi(pct)}٪)
                        </td>
                        {room.questions.map((q, qIndex) => {
                          const ans = s.answers.find(a => a.questionIndex === qIndex);
                          if (ans) {
                            return (
                              <td key={q.id} className="py-2 px-1 text-center">
                                <span className={`inline-block w-5 h-5 rounded text-[10px] font-black leading-5 ${
                                  ans.isCorrect
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-red-500/20 text-red-300'
                                }`}>
                                  {ans.isCorrect ? '✓' : '✗'}
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={q.id} className="py-2 px-1 text-center text-slate-700">
                              -
                            </td>
                          );
                        })}
                        <td className="py-2 px-2 text-center text-emerald-400 font-black">
                          {toHindi(s.correctCount)}
                        </td>
                        <td className="py-2 px-2 text-center text-red-400 font-black">
                          {toHindi(wrongCount)}
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
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedStudentForInspect(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-black text-xs">
                    {selectedStudentForInspect.name[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{selectedStudentForInspect.name}</h3>
                    <span className="text-xs text-amber-400 font-mono font-bold">
                      النقاط الإجمالية: {toHindi(selectedStudentForInspect.score)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudentForInspect(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Answers Breakdown */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {room.questions.map((q, idx) => {
                  const ans = selectedStudentForInspect.answers.find(a => a.questionIndex === idx);
                  return (
                    <div
                      key={q.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        ans
                          ? ans.isCorrect
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/10 border-red-500/20 text-red-300'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-slate-400">س{toHindi(idx + 1)}:</span>
                        <span>{toHindi(q.a)} {q.operation} {toHindi(q.b)} = {toHindi(q.answer)}</span>
                      </div>
                      {ans ? (
                        <div className="flex items-center gap-2 font-mono">
                          <span>اختار: {toHindi(ans.selectedOption)}</span>
                          <span>({toHindi(ans.timeSpent.toFixed(1))}ث)</span>
                        </div>
                      ) : (
                        <span>لم يجب بعد</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setSelectedStudentForInspect(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* 6. PROMINENT BARCODE MODAL WITH EASY "RETURN TO QUESTIONS"    */}
        {/* ------------------------------------------------------------- */}
        {showQrModal && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
            onClick={() => setShowQrModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl text-center space-y-4"
            >
              {/* Top Header with BIG RETURN BUTTON */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <RiyadhEbdaaLogo size="xs" />
                <button
                  onClick={() => setShowQrModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-black flex items-center gap-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>العودة للأسئلة</span>
                </button>
              </div>

              <div>
                <h3 className="text-xl font-black text-white">باركود انضمام الطلاب</h3>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  امسح الباركود بكاميرا الجوال للدخول الفوري للمسابقة
                </p>
              </div>

              {/* Room Code */}
              <div className="py-1">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">رمز الغرفة:</span>
                <span className="text-4xl font-black text-amber-400 font-mono tracking-widest bg-slate-950 px-6 py-2 rounded-2xl border border-slate-800 inline-block shadow-inner">
                  {roomId}
                </span>
              </div>

              {/* Big High-Res QR Code */}
              <div className="p-3 bg-white rounded-2xl inline-block shadow-xl">
                <QRCodeCanvas value={getPublicUrl(`?room=${roomId}`)} size={210} />
              </div>

              {/* Link Box & Direct Vercel Actions */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] text-emerald-400 font-mono block truncate select-all dir-ltr">
                  {getPublicUrl(`?room=${roomId}`)}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? 'تم نسخ الرابط!' : 'نسخ الرابط'}</span>
                  </button>
                  <a
                    href={`https://class-table-res.vercel.app/?room=${roomId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح عبر موقع فيرسل</span>
                  </a>
                </div>
              </div>

              {/* Prominent Bottom Return Button */}
              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4 stroke-[3]" />
                <span>العودة الفورية لشاشة الأسئلة والمسابقة</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
