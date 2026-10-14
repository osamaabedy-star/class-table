/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Play, 
  Settings, 
  RefreshCcw, 
  Star,
  Timer,
  CheckCircle2,
  XCircle,
  LogOut,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  BookOpen,
  Award,
  Sparkles,
  ChevronLeft,
  Flame,
  ArrowRight,
  Copy,
  Check,
  Swords,
  Eye,
  Radio,
  Plus,
  Bot,
  GraduationCap,
  ShieldCheck,
  Share2
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { sounds } from './utils/audio';
import { toHindi } from './utils/format';
import { CertificateModal } from './components/CertificateModal';
import { ClassroomDirectGame } from './components/ClassroomDirectGame';
import { TableReviewModal } from './components/TableReviewModal';
import { ActiveRoomsModal } from './components/ActiveRoomsModal';
import { RiyadhEbdaaLogo } from './components/RiyadhEbdaaLogo';
import { AdminPortal } from './components/AdminPortal';
import { StudentPickerModal } from './components/StudentPickerModal';
import { TeacherLiveGameDashboard } from './components/TeacherLiveGameDashboard';
import { SoloPracticeGame } from './components/SoloPracticeGame';
import { HonorBoardModal } from './components/HonorBoardModal';
import { getPublicUrl, copyToClipboard, getCustomBaseUrl, setCustomBaseUrl } from './utils/publicUrl';
import { 
  SchoolStudent, 
  fetchSchoolStudentsFromServer, 
  recordGameParticipation 
} from './data/students';

// --- Types ---
interface Question {
  id: number;
  a: number;
  b: number;
  operation: '×' | '÷';
  answer: number;
  options: number[];
  text: string;
}

interface StudentAnswer {
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  timeSpent: number;
  pointsEarned: number;
}

interface Student {
  name: string;
  score: number;
  currentIndex: number;
  correctCount: number;
  streak: number;
  answers: StudentAnswer[];
  lastActive: number;
  completed: boolean;
}

interface Room {
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

// -------------------------------------------------------------
// STANDALONE COMPONENT: CREATE ROOM (COMPACT & REFINED)
// -------------------------------------------------------------
interface CreateRoomViewProps {
  initialType: 'duel' | 'group';
  onBack: () => void;
  onCreate: (config: any) => void;
}

const CreateRoomView: React.FC<CreateRoomViewProps> = ({ initialType, onBack, onCreate }) => {
  const [selectedTables, setSelectedTables] = useState<number[]>([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const [qCount, setQCount] = useState<number>(10);
  const [time, setTime] = useState<number>(10);
  const [mode, setMode] = useState<'multi' | 'divi' | 'mixed'>('multi');
  const [roomType, setRoomType] = useState<'duel' | 'group'>(initialType);
  const [title, setTitle] = useState<string>(initialType === 'duel' ? 'تحدي أونلاين ثنائي' : 'مسابقة الصف');

  const toggleTable = (n: number) => {
    setSelectedTables(prev => {
      if (prev.includes(n)) {
        if (prev.length <= 1) return prev;
        return prev.filter(item => item !== n);
      }
      return [...prev, n].sort((a, b) => a - b);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-3 sm:p-6 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl md:rounded-3xl shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              {roomType === 'duel' ? <Swords className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {roomType === 'duel' ? 'تحدي أونلاين (١ ضد ١)' : 'غرفة صفية جماعية'}
              </h2>
            </div>
          </div>
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold"
          >
            إلغاء
          </button>
        </div>

        <div className="space-y-3">
          {/* Room Title */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">اسم المسابقة / الغرفة:</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-indigo-500"
            />
          </div>

          {/* Operation Mode */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">العمليات الحسابية:</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'multi', label: 'الضرب فقط (×)' },
                { id: 'divi', label: 'القسمة فقط (÷)' },
                { id: 'mixed', label: 'مختلط (× و ÷)' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => { sounds.playTap(); setMode(item.id as any); }}
                  className={`py-2 rounded-lg text-xs font-black transition-all border ${
                    mode === item.id
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tables selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-300">جداول الضرب المحددة:</label>
              <div className="flex gap-1.5 text-[11px]">
                <button
                  onClick={() => setSelectedTables([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                  className="text-indigo-400 hover:underline font-bold"
                >
                  الكل
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={() => setSelectedTables([2, 3, 4, 5])}
                  className="text-indigo-400 hover:underline font-bold"
                >
                  ٢ إلى ٥
                </button>
              </div>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-11 gap-1">
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                <button
                  key={n}
                  onClick={() => { sounds.playTap(); toggleTable(n); }}
                  className={`h-8 rounded-lg font-black text-xs border transition-all font-mono ${
                    selectedTables.includes(n)
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-slate-800/60 text-slate-500 border-slate-700/50'
                  }`}
                >
                  {toHindi(n)}
                </button>
              ))}
            </div>
          </div>

          {/* Time and Question Count */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60">
              <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                <span>عدد الأسئلة:</span>
                <span className="text-indigo-400 font-black">{toHindi(qCount)}</span>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                step="5"
                value={qCount}
                onChange={e => setQCount(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5"
              />
            </div>

            <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/60">
              <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                <span>زمن السؤال:</span>
                <span className="text-amber-400 font-black">{toHindi(time)} ثوانٍ</span>
              </div>
              <input
                type="range"
                min="5"
                max="20"
                step="5"
                value={time}
                onChange={e => setTime(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={() => onCreate({
              tables: selectedTables,
              questionsCount: qCount,
              timePerQuestion: time,
              mode,
              roomType,
              title
            })}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 pt-1"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>إنشاء وبدء الغرفة</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// -------------------------------------------------------------
// STANDALONE COMPONENT: JOIN ROOM (COMPACT & REFINED)
// -------------------------------------------------------------
interface JoinRoomViewProps {
  initialCode: string;
  initialName: string;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
  onOpenPicker?: () => void;
  schoolStudents?: SchoolStudent[];
}

const JoinRoomView: React.FC<JoinRoomViewProps> = ({
  initialCode,
  initialName,
  onJoin,
  onBack,
  onOpenPicker,
  schoolStudents = []
}) => {
  const [code, setCode] = useState<string>(initialCode);
  const [name, setName] = useState<string>(initialName);
  const [roomInfo, setRoomInfo] = useState<{ title?: string; roomType?: string; status?: string } | null>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync if initialName or initialCode changes
  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (initialCode) setCode(initialCode);
  }, [initialCode]);

  // When room code is present (e.g. from QR scan ?room=ABCD), fetch room info to confirm it's valid
  useEffect(() => {
    const clean = code.trim().toUpperCase();
    if (clean.length >= 4) {
      setIsLoadingRoom(true);
      fetch(`/api/rooms/${clean}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data) {
            setRoomInfo({
              title: data.title,
              roomType: data.roomType,
              status: data.status
            });
          } else {
            setRoomInfo(null);
          }
        })
        .catch(() => setRoomInfo(null))
        .finally(() => setIsLoadingRoom(false));
    } else {
      setRoomInfo(null);
    }
  }, [code]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !code.trim() || isSubmitting) return;
    setIsSubmitting(true);
    onJoin(code, name);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-3 sm:p-4 flex items-center justify-center dir-rtl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-sm bg-slate-900/90 backdrop-blur-md border border-slate-800 p-5 sm:p-6 rounded-2xl md:rounded-3xl shadow-2xl space-y-4 relative z-10"
      >
        <div className="text-center space-y-1.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-lg font-black text-white">انضمام لمسابقة الأونلاين</h2>

          {/* Room verification pill if scanned from QR */}
          {code && (
            <div className="flex items-center justify-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-bold text-slate-300">الغرفة:</span>
              <span className="font-mono font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30 text-xs">
                {code}
              </span>
              {isLoadingRoom ? (
                <span className="text-[10px] text-slate-400 animate-pulse">جاري التحقق...</span>
              ) : roomInfo ? (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>غرفة نشطة ({roomInfo.title || 'مسابقة'})</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  مباشر
                </span>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-400 font-medium pt-1">
            اكتب اسمك واضغط "دخول المسابقة" للبدء فوراً دون أي تسجيل
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {/* Student Name Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-300">اسم الطالب / المتسابق:</label>
              {onOpenPicker && (
                <button
                  type="button"
                  onClick={onOpenPicker}
                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/20 transition-colors"
                >
                  <GraduationCap className="w-3 h-3" />
                  <span>اختيار من قائمة المدرسة</span>
                </button>
              )}
            </div>
            <input
              type="text"
              autoFocus
              placeholder="اكتب اسمك هنا (مثال: فيصل فهد)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500 text-right"
            />
          </div>

          {/* Room Code Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1.5">رمز الغرفة (٤ أحرف):</label>
            <input
              type="text"
              placeholder="7K9M"
              value={code.toUpperCase()}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xl font-black text-amber-400 text-center tracking-widest outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-mono"
            />
          </div>

          {/* Quick suggestions from school students if available */}
          {schoolStudents.length > 0 && !name && (
            <div className="pt-1">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">
                أو اختر سريعاً من طلاب الصف:
              </span>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto scrollbar-none p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                {schoolStudents.slice(0, 6).map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setName(st.name)}
                    className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-1 rounded-lg border border-slate-700/60 transition-colors truncate max-w-[100px]"
                  >
                    {st.name}
                  </button>
                ))}
                {schoolStudents.length > 6 && onOpenPicker && (
                  <button
                    type="button"
                    onClick={onOpenPicker}
                    className="text-[10px] font-bold text-amber-400 hover:text-amber-300 px-1.5 py-1"
                  >
                    + المزيد ({toHindi(schoolStudents.length)})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Join button */}
          <button
            type="submit"
            disabled={!name.trim() || !code.trim() || isSubmitting}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-sm shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 mt-2 active:scale-98"
          >
            <span>{isSubmitting ? 'جاري الدخول...' : 'دخول المسابقة فوراً'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full text-xs font-bold text-slate-400 hover:text-slate-200 text-center block pt-1.5 transition-colors"
          >
            العودة للرئيسية
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// -------------------------------------------------------------
// MAIN APP COMPONENT
// -------------------------------------------------------------
export default function App() {
  const [view, setView] = useState<'home' | 'create' | 'join' | 'lobby' | 'game' | 'leaderboard' | 'direct_board' | 'admin' | 'solo_practice'>('home');
  const [isHonorBoardOpen, setIsHonorBoardOpen] = useState<boolean>(false);
  const [createType, setCreateType] = useState<'duel' | 'group'>('duel');
  const [roomId, setRoomId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [isTeacher, setIsTeacher] = useState<boolean>(false);
  const [room, setRoom] = useState<Room | null>(null);

  // School students from server & picker modal
  const [schoolStudents, setSchoolStudents] = useState<SchoolStudent[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [pickerTarget, setPickerTarget] = useState<'home' | 'join'>('home');

  // Quick join state on the home page
  const [quickRoomCode, setQuickRoomCode] = useState<string>('');
  const [quickStudentName, setQuickStudentName] = useState<string>('');

  // Active rooms modal
  const [isActiveRoomsOpen, setIsActiveRoomsOpen] = useState<boolean>(false);
  const [activeRoomsCount, setActiveRoomsCount] = useState<number>(0);

  // Modals
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);
  const [certData, setCertData] = useState<{
    isOpen: boolean;
    studentName: string;
    score: number;
    correctCount: number;
    total: number;
    rank?: number;
  }>({
    isOpen: false,
    studentName: '',
    score: 0,
    correctCount: 0,
    total: 10
  });

  // Controls
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // In-App Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Student gameplay state
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState<boolean>(false);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number; correctAnswer?: number } | null>(null);

  const [customDeployUrl, setCustomDeployUrl] = useState<string>(getCustomBaseUrl());
  const [showUrlSettings, setShowUrlSettings] = useState<boolean>(false);

  // Synchronize audio
  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  // Read URL params (e.g. ?room=ABCD, #room=ABCD, or #ABCD)
  useEffect(() => {
    const handleUrlRoom = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        let roomParam = params.get('room');
        if (!roomParam && window.location.hash) {
          const hash = window.location.hash.replace(/^#\/?/, '');
          if (hash.startsWith('room=')) {
            roomParam = hash.replace('room=', '');
          } else if (/^[A-Za-z0-9]{4,8}$/.test(hash)) {
            roomParam = hash;
          } else {
            const hashParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : hash);
            roomParam = hashParams.get('room');
          }
        }
        if (roomParam) {
          const cleanCode = roomParam.trim().toUpperCase();
          setRoomId(cleanCode);
          setQuickRoomCode(cleanCode);
          setView('join');
        }
      } catch {
        // ignore
      }
    };
    handleUrlRoom();
    window.addEventListener('popstate', handleUrlRoom);
    window.addEventListener('hashchange', handleUrlRoom);
    return () => {
      window.removeEventListener('popstate', handleUrlRoom);
      window.removeEventListener('hashchange', handleUrlRoom);
    };
  }, []);

  // Fetch school students on mount & view change
  useEffect(() => {
    fetchSchoolStudentsFromServer().then(list => {
      if (list && list.length > 0) {
        setSchoolStudents(list);
      }
    });
  }, [view]);

  // Poll count of active rooms
  useEffect(() => {
    const checkActiveRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (res.ok) {
          const data = await res.json();
          setActiveRoomsCount((data.rooms || []).length);
        }
      } catch {
        // ignore
      }
    };
    checkActiveRooms();
    const t = setInterval(checkActiveRooms, 3000);
    return () => clearInterval(t);
  }, []);

  // Room polling (Role-aware to safeguard question answers)
  const fetchRoom = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const roleParam = isTeacher ? '?role=host' : '?role=student';
      const res = await fetch(`/api/rooms/${id}${roleParam}`);
      if (res.ok) {
        const data: Room = await res.json();
        setRoom(data);

        if (data.status === 'playing' || data.status === 'intermission') {
          if (view === 'lobby') {
            setView('game');
          }
        } else if (data.status === 'finished') {
          if (view === 'game') {
            setView('leaderboard');
            sounds.playFanfare();
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });

            // Record game to school records for admin analytics
            const studentResults = Object.values(data.students || {}).map(s => ({
              name: s.name,
              score: s.score,
              correctCount: s.correctCount,
              totalAnswered: s.answers?.length || 10,
              streak: s.streak
            }));
            recordGameParticipation(studentResults);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [view, isTeacher]);

  useEffect(() => {
    if (roomId && (view === 'lobby' || view === 'leaderboard' || view === 'game')) {
      fetchRoom(roomId);
      const interval = setInterval(() => fetchRoom(roomId), 1000);
      return () => clearInterval(interval);
    }
  }, [roomId, view, fetchRoom]);

  // Reset student answer status on question change
  useEffect(() => {
    if (room && view === 'game') {
      if (room.status === 'playing') {
        const currentQIdx = room.currentQuestionIndex;
        const currentStudent = room.students[playerName];
        const alreadyAnswered = currentStudent?.answers.some(a => a.questionIndex === currentQIdx);

        if (!alreadyAnswered) {
          setHasAnsweredCurrent(false);
          setSelectedOption(null);
          setAnswerResult(null);
          setTimeLeft(room.config.timePerQuestion);
        }
      }
    }
  }, [room?.currentQuestionIndex, room?.status, view, playerName]);

  // Client timer for active question
  useEffect(() => {
    if (view !== 'game' || hasAnsweredCurrent || !room || room.status !== 'playing') return;

    if (timeLeft > 0) {
      const t = setTimeout(() => {
        if (timeLeft <= 3) sounds.playTick(true);
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(t);
    } else {
      submitAnswer(-9999);
    }
  }, [timeLeft, view, hasAnsweredCurrent, room?.status]);

  // Create room
  const handleCreateRoom = async (configData: any) => {
    sounds.playTap();
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      const data = await res.json();
      if (res.ok && data.roomId && data.room) {
        setRoomId(data.roomId);
        setRoom(data.room);
        setIsTeacher(true);
        setView('lobby');
      } else {
        showToast(data?.error || 'حدث خطأ أثناء إنشاء الغرفة');
      }
    } catch (err) {
      console.error('Create room error:', err);
      showToast('حدث خطأ أثناء إنشاء الغرفة، يرجى المحاولة ثانية');
    }
  };

  // Join room
  const handleJoinRoom = async (code: string, name: string) => {
    sounds.playTap();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    if (!cleanCode || !cleanName) return;

    try {
      const res = await fetch(`/api/rooms/${cleanCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName })
      });
      if (res.ok) {
        const data = await res.json();
        setRoomId(cleanCode);
        setPlayerName(cleanName);
        setRoom(data.room);
        setIsTeacher(false);
        setView(data.room.status === 'playing' || data.room.status === 'intermission' ? 'game' : 'lobby');
      } else {
        const err = await res.json();
        showToast(err.error || 'رمز الغرفة غير صحيح');
      }
    } catch {
      showToast('تعذر الاتصال بالغرفة');
    }
  };

  const addSimulatedOpponent = async () => {
    if (!roomId) return;
    try {
      await fetch(`/api/rooms/${roomId}/add-test-student`, {
        method: 'POST'
      });
      fetchRoom(roomId);
    } catch {
      // ignore
    }
  };

  const submitAnswer = async (option: number) => {
    if (hasAnsweredCurrent || !room || room.status !== 'playing') return;
    setHasAnsweredCurrent(true);
    setSelectedOption(option);

    try {
      const res = await fetch(`/api/rooms/${roomId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playerName,
          questionIndex: room.currentQuestionIndex,
          selectedOption: option,
          timeRemaining: timeLeft
        })
      });

      const data = await res.json();
      if (data.isCorrect) {
        sounds.playCorrect();
        confetti({ particleCount: 30, spread: 45, origin: { y: 0.7 } });
        setAnswerResult({ isCorrect: true, points: data.pointsEarned, correctAnswer: data.correctAnswer });
      } else {
        sounds.playWrong();
        setAnswerResult({ isCorrect: false, points: 0, correctAnswer: data.correctAnswer });
      }
      fetchRoom(roomId);
    } catch {
      // ignore
    }
  };

  const copyRoomCode = async () => {
    const ok = await copyToClipboard(roomId);
    if (ok) {
      setCopiedCode(true);
      sounds.playTap();
      showToast(`تم نسخ رمز الغرفة: ${roomId}`);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyRoomLink = async () => {
    const url = getPublicUrl(`?room=${roomId}`);
    const ok = await copyToClipboard(url);
    if (ok) {
      sounds.playSuccess();
      showToast('تم نسخ الرابط المباشر للطلاب والأصدقاء (يعمل للجميع دون تسجيل دخول)');
    }
  };

  // -------------------------------------------------------------
  // VIEW: HOME (REFINED, COMPACT, 2 CORE PILLARS, RIYADH EBDAA LOGO)
  // -------------------------------------------------------------
  const renderHome = () => (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between relative overflow-hidden">
      {/* Background Motion Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 20, -20, 0], y: [0, -20, 20, 0], scale: [1, 1.05, 0.98, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 20, 0], y: [0, 20, -20, 0], scale: [1, 0.95, 1.05, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-32 left-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl"
        />
      </div>

      {/* Header: School Logo & Action Bar */}
      <header className="relative z-10 px-4 py-2.5 md:px-8 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RiyadhEbdaaLogo size="sm" />
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Portal Entry Button in the Top Bar */}
          <button
            onClick={() => { sounds.playTap(); setView('admin'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-black border border-amber-500/30 transition-colors shadow-sm"
            title="دخول بوابة الإدارة المدرسية وتحليل الفصول"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>بوابة الإدارة المدرسية</span>
          </button>

          {/* Honor Board Button */}
          <button
            onClick={() => { sounds.playTap(); setIsHonorBoardOpen(true); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-black border border-amber-500/30 transition-colors shadow-sm"
            title="لوحة الشرف وفرسان الرياضيات"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>لوحة الشرف 🏆</span>
          </button>

          {/* Active Rooms Badge */}
          <button
            onClick={() => { sounds.playTap(); setIsActiveRoomsOpen(true); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-800"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">الغرف النشطة</span>
            <span className="font-mono text-[11px] font-black bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded">
              {toHindi(activeRoomsCount)}
            </span>
          </button>

          <button
            onClick={() => setIsReviewOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>الجداول</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Hub: Clean, Balanced, 2 Professional Core Cards */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-3 sm:p-4 max-w-3xl mx-auto w-full my-auto space-y-4">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            مسابقة جدول الضرب والحساب الذهني
          </h1>
        </div>

        {/* 2 Core Cards (Symmetrical, Direct Action, Zero Redundancy) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full">
          {/* Card 1: Classroom Smart Board Mode */}
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 text-white shadow-xl text-right flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white">
                مسابقة السبورة الصفية
              </h3>
            </div>

            <button
              onClick={() => { sounds.playTap(); setView('direct_board'); }}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-colors"
            >
              <span>بدء مسابقة السبورة</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </motion.div>

          {/* Card 2: Online Multiplayer Challenge */}
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            className="p-4 rounded-2xl bg-slate-900 border border-indigo-500/30 text-white shadow-xl text-right flex flex-col justify-between space-y-2.5"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Swords className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white">
                التحدي الأونلاين
              </h3>
            </div>

            {/* Quick Join Inputs on Card */}
            <div className="space-y-1.5 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="اسم الطالب"
                    value={quickStudentName}
                    onChange={e => setQuickStudentName(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none focus:border-indigo-400 placeholder:text-slate-500"
                  />
                  {schoolStudents.length > 0 && (
                    <button
                      onClick={() => { setPickerTarget('home'); setIsPickerOpen(true); }}
                      className="absolute left-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-amber-400 hover:text-amber-300"
                      title="قائمة المدرسة"
                    >
                      <GraduationCap className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="رمز الغرفة"
                  maxLength={8}
                  value={quickRoomCode.toUpperCase()}
                  onChange={e => setQuickRoomCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-mono font-black text-amber-400 text-center uppercase tracking-wider outline-none focus:border-amber-400 placeholder:text-slate-500"
                />
              </div>

              <button
                onClick={() => handleJoinRoom(quickRoomCode, quickStudentName)}
                disabled={!quickRoomCode.trim() || !quickStudentName.trim()}
                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors"
              >
                <span>دخول الغرفة</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Create Room Buttons */}
            <div className="flex gap-1.5 pt-0.5 border-t border-slate-800/80">
              <button
                onClick={() => { sounds.playTap(); setCreateType('duel'); setView('create'); }}
                className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-colors"
              >
                تحدي (١ ضد ١)
              </button>
              <button
                onClick={() => { sounds.playTap(); setCreateType('group'); setView('create'); }}
                className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-colors"
              >
                غرفة جماعية
              </button>
            </div>
          </motion.div>
        </div>

        {/* Card 3: Solo Practice Blitz */}
        <motion.div
          whileHover={{ y: -1 }}
          className="w-full p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-right"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-amber-400" />
            </div>
            <h4 className="text-sm font-black text-white">
              التدريب الفردي السريع (Solo Blitz)
            </h4>
          </div>

          <button
            onClick={() => { sounds.playTap(); setView('solo_practice'); }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all shrink-0"
          >
            <span>بدء التدريب الفردي ⚡</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 py-2 text-center border-t border-slate-900 bg-slate-950/60">
        <span className="text-[10px] text-slate-500 font-bold">
          مدارس رياض الإبداع • منصة التميز والحساب الذهني
        </span>
      </footer>
    </div>
  );

  // -------------------------------------------------------------
  // VIEW: LOBBY
  // -------------------------------------------------------------
  const renderLobby = () => {
    const studentList = Object.values(room?.students || {});
    const joinUrl = getPublicUrl(`?room=${roomId}`);
    const isDuel = room?.roomType === 'duel';

    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans p-3 sm:p-6 flex flex-col justify-between dir-rtl">
        <header className="flex items-center justify-between pb-3 border-b border-slate-800 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setView('home')}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base font-black text-white">{room?.title || 'غرفة المسابقة'}</h2>
              <span className="text-[10px] text-emerald-400 font-bold">
                {isDuel ? 'تحدي ثنائي أونلاين' : 'مسابقة جماعية'} • مفتوح للجميع
              </span>
            </div>
          </div>

          <RiyadhEbdaaLogo size="xs" />
        </header>

        <main className="flex-1 my-4 max-w-xl mx-auto w-full space-y-4 text-center">
          {/* Room Code Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400">رمز الغرفة للدخول:</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                مباشر لأي هاتف أو جهاز
              </span>
            </div>

            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl sm:text-5xl font-black text-amber-400 tracking-widest font-mono">
                {roomId}
              </span>
              <button
                onClick={copyRoomCode}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="نسخ الرمز"
              >
                {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            <div className="py-1 flex flex-col items-center gap-1.5">
              <div className="p-2.5 bg-white rounded-xl inline-block shadow-md">
                <QRCodeCanvas value={joinUrl} size={125} />
              </div>
              <span className="text-[10px] text-slate-300 font-bold">
                امسح الباركود بكاميرا الجوال للدخول الفوري
              </span>
            </div>

            {/* Direct URL Display & Custom Domain Configuration */}
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-right space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span>رابط الانضمام المشفر في الباركود:</span>
                <button
                  type="button"
                  onClick={() => setShowUrlSettings(!showUrlSettings)}
                  className="text-amber-400 hover:text-amber-300 text-[10px] underline flex items-center gap-1"
                >
                  {showUrlSettings ? 'إخفاء الإعدادات' : 'تخصيص رابط الاستضافة (Vercel)'}
                </button>
              </div>

              {showUrlSettings && (
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-700/80 space-y-2 text-right">
                  <label className="text-[10px] text-slate-300 font-bold block">
                    إذا قمت برفع المشروع على Vercel أو دومين مدرستك، اكتب الرابط هنا:
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="https://riyadh-math.vercel.app"
                      value={customDeployUrl}
                      onChange={e => {
                        const val = e.target.value;
                        setCustomDeployUrl(val);
                        setCustomBaseUrl(val);
                      }}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono dir-ltr outline-none focus:border-amber-400 text-left"
                    />
                    {customDeployUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomDeployUrl('');
                          setCustomBaseUrl('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 text-[10px] font-bold"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400 leading-relaxed">
                    💡 عند النشر على Vercel، سيعمل هذا الرابط والباركود لجميع هواتف الطلاب دون أي تسجيل دخول.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-emerald-400 font-mono truncate select-all dir-ltr text-left flex-1">
                  {joinUrl}
                </span>
                <button
                  type="button"
                  onClick={copyRoomLink}
                  className="shrink-0 p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  title="نسخ الرابط"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Direct Share Link for Friends & Students */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={copyRoomLink}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>نسخ الرابط المباشر للطلاب والأصدقاء</span>
              </button>
            </div>

            {/* Duel Waiting Status */}
            {isDuel && (
              <div className="p-2.5 rounded-xl bg-indigo-900/30 border border-indigo-700/40 text-xs font-bold text-indigo-200">
                {studentList.length < 2 ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>في انتظار انضمام المتسابق الثاني للبدء التلقائي...</span>
                  </div>
                ) : (
                  <span className="text-emerald-400 font-black">اكتمل المتسابقان! جاري البدء...</span>
                )}
              </div>
            )}

            {isDuel && studentList.length === 1 && (
              <button
                onClick={addSimulatedOpponent}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 mx-auto transition-colors"
              >
                <Bot className="w-3.5 h-3.5 text-amber-400" />
                <span>إضافة طالب تجريبي</span>
              </button>
            )}

            {!isDuel && isTeacher && (
              <button
                onClick={async () => {
                  sounds.playTap();
                  await fetch(`/api/rooms/${roomId}/start`, { method: 'POST' });
                  setView('game');
                }}
                disabled={studentList.length === 0}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>بدء المسابقة الآن</span>
              </button>
            )}
          </div>

          {/* Contestants list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
              <span>المتسابقون ({toHindi(studentList.length)}):</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {studentList.map((s, idx) => (
                <div key={s.name} className="p-2 bg-slate-800 border border-slate-700 rounded-xl flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-600/30 text-indigo-400 font-bold text-[11px] flex items-center justify-center font-mono">
                    {toHindi(idx + 1)}
                  </span>
                  <span className="text-xs font-bold truncate">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW: GAMEPLAY (REFINED SCALE, 100% VISIBLE OPTIONS)
  // -------------------------------------------------------------
  const renderGame = () => {
    if (!room) return null;

    const currentQ = room.questions[room.currentQuestionIndex];
    const totalQ = room.questions.length;
    const studentList = Object.values(room.students);
    const isIntermission = room.status === 'intermission';
    const now = Date.now();
    const intermissionSecs = Math.max(1, Math.ceil((room.intermissionEndsAt - now) / 1000));

    // TEACHER / SPECTATOR LIVE MONITOR SCREEN
    if (isTeacher) {
      return (
        <TeacherLiveGameDashboard
          room={room}
          roomId={roomId}
          isFullscreen={isFullscreen}
          setIsFullscreen={setIsFullscreen}
          activeRoomsCount={activeRoomsCount}
          onOpenActiveRooms={() => setIsActiveRoomsOpen(true)}
          onEndGame={async () => {
            await fetch(`/api/rooms/${roomId}/end`, { method: 'POST' });
            setView('leaderboard');
          }}
          onRoomUpdate={setRoom}
          showToast={showToast}
        />
      );
    }

    // STUDENT PLAYER VIEW
    const currentStudent = room.students[playerName];
    const opponentStudent = studentList.find(s => s.name !== playerName) || null;

    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans p-2.5 sm:p-4 flex flex-col justify-between dir-rtl select-none">
        {/* Top Bar with Both Students & Live Scores */}
        <header className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 max-w-lg mx-auto w-full flex items-center justify-between shadow-lg">
          {/* Current Student (You) */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-xs shrink-0">
              أنت
            </div>
            <div>
              <span className="font-black text-sm block leading-tight truncate max-w-[110px]">{playerName}</span>
              <span className="text-xs font-mono font-black text-amber-400">{toHindi(currentStudent?.score || 0)} نقطة</span>
            </div>
          </div>

          {/* VS Divider & Question Badge */}
          <div className="text-center px-2 py-0.5 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] font-black text-indigo-400 block">VS</span>
            <span className="text-[9px] font-mono font-bold text-slate-400">س{toHindi(room.currentQuestionIndex + 1)}/{toHindi(totalQ)}</span>
          </div>

          {/* Opponent Student */}
          {opponentStudent ? (
            <div className="flex items-center gap-2 text-left dir-ltr">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-xs shrink-0">
                {opponentStudent.name.includes('تجريبي') ? <Bot className="w-4 h-4" /> : 'منافس'}
              </div>
              <div>
                <span className="font-black text-sm block leading-tight truncate max-w-[110px]">{opponentStudent.name}</span>
                <span className="text-xs font-mono font-black text-indigo-300">{toHindi(opponentStudent.score)} نقطة</span>
              </div>
            </div>
          ) : (
            <span className="text-[10px] text-slate-500 font-bold">بانتظار المنافس...</span>
          )}
        </header>

        {/* Content Area */}
        <main className="flex-1 flex flex-col items-center justify-center my-2 max-w-lg mx-auto w-full space-y-3">
          <div className="w-full bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-3xl shadow-xl text-center space-y-3">
            {/* Question Counter & Timer */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
              <span className="text-xs font-bold text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full">
                السؤال {toHindi(room.currentQuestionIndex + 1)} من {toHindi(totalQ)}
              </span>

              <div className={`flex items-center gap-1 font-black text-sm font-mono ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                <Timer className="w-3.5 h-3.5" />
                <span>{toHindi(timeLeft)} ث</span>
              </div>
            </div>

            {/* Math Equation */}
            <div className="py-2 select-none font-mono">
              <div className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-wider flex items-center justify-center gap-2.5">
                <span>{toHindi(currentQ.a)}</span>
                <span className="text-amber-400">{currentQ.operation}</span>
                <span>{toHindi(currentQ.b)}</span>
                <span className="text-slate-600">=</span>
                <span className="text-indigo-400">؟</span>
              </div>
            </div>

            {/* Answer Correction & 3-Second Countdown Display */}
            {hasAnsweredCurrent && (
              <div className="space-y-2 py-1">
                <div className={`p-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-sm ${
                  answerResult?.isCorrect
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {answerResult?.isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  <span>
                    {answerResult?.isCorrect
                      ? `أحسنت! إجابة صحيحة (+${toHindi(answerResult.points)} نقطة) 🌟`
                      : `إجابة خاطئة! الجواب الصحيح: ${toHindi(answerResult?.correctAnswer ?? '')}`}
                  </span>
                </div>

                {/* 3-Second Transition Countdown */}
                <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">الانتقال للسؤال التالي خلال:</span>
                  <span className="text-xl font-black text-amber-400 font-mono animate-pulse">
                    {toHindi(isIntermission ? intermissionSecs : 3)}
                  </span>
                </div>
              </div>
            )}

            {/* All 4 Options Visible Simultaneously */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full pt-1">
              {currentQ.options.map((opt, i) => {
                const isChosen = selectedOption === opt;
                const isActualCorrect = answerResult?.correctAnswer !== undefined && opt === answerResult.correctAnswer;
                let style = 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700';

                if (hasAnsweredCurrent) {
                  if (isChosen) {
                    style = answerResult?.isCorrect
                      ? 'bg-emerald-600 border-emerald-400 text-white ring-2 ring-emerald-400/50'
                      : 'bg-red-600 border-red-400 text-white ring-2 ring-red-400/50';
                  } else if (!answerResult?.isCorrect && isActualCorrect) {
                    style = 'bg-emerald-600/30 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40 animate-pulse';
                  } else {
                    style = 'bg-slate-800/40 border-slate-800 text-slate-500 opacity-40';
                  }
                }

                return (
                  <button
                    key={i}
                    onClick={() => submitAnswer(opt)}
                    disabled={hasAnsweredCurrent}
                    className={`py-3 px-2 rounded-xl font-black text-xl sm:text-2xl border transition-all shadow-sm font-mono active:scale-95 flex items-center justify-center ${style}`}
                  >
                    {toHindi(opt)}
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW: LEADERBOARD & RESULTS
  // -------------------------------------------------------------
  const renderLeaderboard = () => {
    const studentList = Object.values(room?.students || {}).sort((a, b) => b.score - a.score);

    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans p-3 sm:p-6 flex flex-col justify-between">
        <header className="flex items-center justify-between pb-3 border-b border-slate-800 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-lg font-black">النتائج النهائية للمسابقة</h2>
              <span className="text-[10px] text-slate-400 font-bold">تم احتساب النتائج تلقائياً</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RiyadhEbdaaLogo size="xs" />
            <button
              onClick={() => setView('home')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
            >
              الرئيسية
            </button>
          </div>
        </header>

        <main className="flex-1 my-4 max-w-2xl mx-auto w-full space-y-3">
          <div className="space-y-2">
            {studentList.map((s, idx) => {
              const totalQ = room?.config.questionsCount || 10;
              const pct = totalQ > 0 ? Math.round((s.score / totalQ) * 100) : 0;
              const isWinner = idx === 0;

              return (
                <div
                  key={s.name}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                    isWinner
                      ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400/30'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl font-mono font-black text-sm flex items-center justify-center bg-slate-800">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : toHindi(idx + 1)}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-sm text-white">{s.name}</span>
                        {isWinner && (
                          <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-md">
                            بطل المسابقة 👑
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold block font-mono">
                        {toHindi(s.correctCount)} صحيحة من {toHindi(totalQ)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left font-mono">
                      <span className="text-base font-black text-amber-400 block">{toHindi(s.score)} درجات</span>
                      <span className="text-xs font-black text-emerald-400">({toHindi(pct)}٪)</span>
                    </div>

                    {/* Certificate Button EXCLUSIVELY for 1st Place Winner */}
                    {isWinner ? (
                      <button
                        onClick={() => {
                          sounds.playTap();
                          setCertData({
                            isOpen: true,
                            studentName: s.name,
                            score: s.score,
                            correctCount: s.correctCount,
                            total: totalQ,
                            rank: 1
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all hover:scale-105"
                      >
                        <Award className="w-4 h-4 fill-current" />
                        <span>شهادة الفائز 🏆</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-500 px-2">
                        {idx === 1 ? 'المركز الثاني' : idx === 2 ? 'المركز الثالث' : `المركز ${toHindi(idx + 1)}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans antialiased">
      {view === 'home' && renderHome()}
      {view === 'create' && (
        <CreateRoomView
          initialType={createType}
          onBack={() => setView('home')}
          onCreate={handleCreateRoom}
        />
      )}
      {view === 'join' && (
        <JoinRoomView
          initialCode={roomId}
          initialName={playerName}
          onJoin={handleJoinRoom}
          onBack={() => setView('home')}
          schoolStudents={schoolStudents}
          onOpenPicker={() => {
            setPickerTarget('join');
            setIsPickerOpen(true);
          }}
        />
      )}
      {view === 'lobby' && renderLobby()}
      {view === 'game' && renderGame()}
      {view === 'leaderboard' && renderLeaderboard()}
      {view === 'direct_board' && (
        <ClassroomDirectGame
          onBack={() => setView('home')}
          onOpenCertificate={(name, score, correct, total) => {
            setCertData({
              isOpen: true,
              studentName: name,
              score,
              correctCount: correct,
              total
            });
          }}
        />
      )}
      {view === 'admin' && (
        <AdminPortal
          onBack={() => setView('home')}
          onOpenCertificate={(name, score, correct, total) => {
            setCertData({
              isOpen: true,
              studentName: name,
              score,
              correctCount: correct,
              total
            });
          }}
        />
      )}
      {view === 'solo_practice' && (
        <SoloPracticeGame
          onBack={() => setView('home')}
        />
      )}

      {/* Student Picker Modal for Selecting from School Roster */}
      <StudentPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        students={schoolStudents}
        onSelectStudent={(name) => {
          if (pickerTarget === 'home') {
            setQuickStudentName(name);
          } else {
            setPlayerName(name);
          }
        }}
      />

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 border border-indigo-400 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-2xl flex items-center gap-2 dir-rtl max-w-sm text-center"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Rooms Manager Modal */}
      <ActiveRoomsModal
        isOpen={isActiveRoomsOpen}
        onClose={() => setIsActiveRoomsOpen(false)}
        onSelectRoom={(rId, mode) => {
          setRoomId(rId);
          if (mode === 'teacher') {
            setIsTeacher(true);
            setView('game');
          } else {
            setView('join');
          }
        }}
        onCreateNewRoom={() => {
          setCreateType('group');
          setView('create');
        }}
      />

      {/* Global Modals */}
      <TableReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
      />

      <CertificateModal
        isOpen={certData.isOpen}
        onClose={() => setCertData(prev => ({ ...prev, isOpen: false }))}
        studentName={certData.studentName}
        score={certData.score}
        correctCount={certData.correctCount}
        totalQuestions={certData.total}
        teacherName="أ/ أسامة إبراهيم"
        title="تحدي جدول الضرب"
        rank={certData.rank}
      />

      {/* Honor Board Modal */}
      <HonorBoardModal
        isOpen={isHonorBoardOpen}
        onClose={() => setIsHonorBoardOpen(false)}
        students={schoolStudents}
      />
    </div>
  );
}
