/**
 * التدريب الفردي السريع للحساب الذهني
 * يتيح للطالب اختيار عدد الأسئلة والجداول والعمليات والتدرب بتركيز عالٍ
 * مدارس رياض الإبداع الأهلية
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Timer,
  Trophy,
  Sparkles,
  RotateCcw,
  ArrowRight,
  Volume2,
  VolumeX,
  Flame,
  CheckCircle2,
  XCircle,
  Play,
  Award,
  Plus,
  Minus,
  Hash
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/audio';
import { toHindi } from '../utils/format';
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

interface SoloPracticeGameProps {
  onBack: () => void;
  onOpenCertificate?: (name: string, score: number, correct: number, total: number, rank?: number) => void;
}

export const SoloPracticeGame: React.FC<SoloPracticeGameProps> = ({ onBack, onOpenCertificate }) => {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'finished'>('setup');
  const [studentName, setStudentName] = useState<string>('بطل الإبداع');
  const [selectedTables, setSelectedTables] = useState<number[]>([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const [opMode, setOpMode] = useState<'multi' | 'divi' | 'mixed'>('multi');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timePerQuestion, setTimePerQuestion] = useState<number>(15); // 0 = بدون مؤقت
  const [soundOn, setSoundOn] = useState<boolean>(true);

  // حالة التحدي النشط
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [score, setScore] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [attemptLogs, setAttemptLogs] = useState<QuestionAttemptLog[]>([]);

  // أعلى رقم شخصي محفوظ محلياً
  const [personalBest, setPersonalBest] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('solo_practice_best') || '0', 10);
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    sounds.enabled = soundOn;
  }, [soundOn]);

  const toggleTable = (num: number) => {
    setSelectedTables(prev => {
      if (prev.includes(num)) {
        if (prev.length <= 1) return prev;
        return prev.filter(n => n !== num);
      }
      return [...prev, num].sort((a, b) => a - b);
    });
  };

  // بناء بنك أسئلة شامل غير متكرر حسب الجداول والعمليات وعدد الأسئلة المطلوب
  const buildQuestionList = (count: number): Question[] => {
    const valid = selectedTables.length > 0 ? selectedTables : [2, 3, 4, 5, 6, 7, 8, 9, 10];
    const basePool: Array<{ a: number; b: number; table: number; operation: '×' | '÷'; answer: number }> = [];

    for (const table of valid) {
      for (let factor = 1; factor <= 12; factor++) {
        if (opMode === 'multi' || opMode === 'mixed') {
          basePool.push({
            a: table,
            b: factor,
            table,
            operation: '×',
            answer: table * factor
          });
        }
        if (opMode === 'divi' || opMode === 'mixed') {
          basePool.push({
            a: table * factor,
            b: table,
            table,
            operation: '÷',
            answer: factor
          });
        }
      }
    }

    const shuffle = <T,>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const selected: Array<{ a: number; b: number; table: number; operation: '×' | '÷'; answer: number }> = [];
    while (selected.length < count) {
      const batch = shuffle(basePool);
      for (const item of batch) {
        selected.push(item);
        if (selected.length >= count) break;
      }
    }

    return selected.map(c => {
      const answer = c.answer;
      const opts = new Set<number>([answer]);

      if (c.operation === '÷') {
        const candidates = [
          answer + 1, answer - 1, answer + 2, answer - 2,
          answer + 3, answer - 3, c.b + 1, c.b - 1, c.b
        ].filter(x => x > 0 && x !== answer);
        candidates.sort(() => Math.random() - 0.5);
        for (const p of candidates) {
          opts.add(p);
          if (opts.size >= 4) break;
        }
      } else {
        const table = c.a;
        const factor = c.b;
        const candidates = [
          answer + table, answer - table, answer + 1, answer - 1,
          answer + 2, answer - 2, (table + 1) * factor, (table - 1) * factor,
          table * (factor + 1), table * (factor - 1)
        ].filter(x => x > 0 && x !== answer);
        candidates.sort(() => Math.random() - 0.5);
        for (const p of candidates) {
          opts.add(p);
          if (opts.size >= 4) break;
        }
      }

      let fallback = answer > 4 ? answer - 3 : 1;
      while (opts.size < 4) {
        if (fallback > 0 && fallback !== answer) opts.add(fallback);
        fallback++;
      }

      return {
        a: c.a,
        b: c.b,
        table: c.table,
        operation: c.operation,
        answer,
        options: Array.from(opts).sort(() => Math.random() - 0.5)
      };
    });
  };

  const startGame = () => {
    sounds.playTap();
    const safeCount = Math.max(1, Math.min(200, questionCount || 10));
    const pool = buildQuestionList(safeCount);
    setQuestionPool(pool);
    setCurrentIndex(0);
    setScore(0);
    setCorrectCount(0);
    setWrongCount(0);
    setCurrentStreak(0);
    setBestStreak(0);
    setTotalTimeSpent(0);
    setAttemptLogs([]);
    setTimeLeft(timePerQuestion);
    setIsAnswered(false);
    setSelectedOption(null);
    setGameState('playing');
  };

  const finishGame = (finalScore: number) => {
    sounds.playFanfare();
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    if (finalScore > personalBest) {
      setPersonalBest(finalScore);
      try {
        localStorage.setItem('solo_practice_best', finalScore.toString());
      } catch {
        // تجاهل خطأ التخزين المحلي
      }
    }
    setGameState('finished');
  };

  // مؤقت السؤال الحالي (في حال لم يكن الوقت مفتوحاً)
  useEffect(() => {
    if (gameState !== 'playing' || isAnswered || timePerQuestion <= 0) return;

    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        if (timeLeft <= 4) sounds.playTick(true);
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      handleSelectOption(-9999);
    }
  }, [timeLeft, gameState, isAnswered, timePerQuestion]);

  const currentQ = questionPool[currentIndex] || null;

  const handleSelectOption = (opt: number) => {
    if (isAnswered || !currentQ || gameState !== 'playing') return;
    setIsAnswered(true);
    setSelectedOption(opt);

    const isCorrect = opt === currentQ.answer;
    const spent = timePerQuestion > 0 ? Math.max(0.2, timePerQuestion - timeLeft) : 1;
    setTotalTimeSpent(prev => Number((prev + spent).toFixed(1)));

    const attemptLog: QuestionAttemptLog = {
      table: currentQ.table,
      operation: currentQ.operation,
      questionText: `${toHindi(currentQ.a)} ${currentQ.operation} ${toHindi(currentQ.b)}`,
      correctAnswer: currentQ.answer,
      selectedOption: opt === -9999 ? null : opt,
      isCorrect,
      timeSpent: spent
    };
    setAttemptLogs(prev => [...prev, attemptLog]);

    let updatedScore = score;
    if (isCorrect) {
      sounds.playCorrect();
      sounds.playPraiseVoice(true);
      updatedScore = score + 1;
      setScore(updatedScore);
      setCorrectCount(prev => prev + 1);
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      confetti({
        particleCount: newStreak >= 3 && newStreak % 3 === 0 ? 42 : 18,
        spread: newStreak >= 3 ? 65 : 48,
        startVelocity: 26,
        origin: { y: 0.65 },
        colors: ['#10b981', '#fbbf24', '#38bdf8', '#f59e0b'],
        disableForReducedMotion: true
      });
    } else {
      sounds.playWrong();
      setWrongCount(prev => prev + 1);
      setCurrentStreak(0);
    }

    // إظهار التغذية الراجعة (سريعة للصحيح وأوضح للخطأ لرؤية الإجابة الصحيحة)
    const delayMs = isCorrect ? 650 : 1250;
    setTimeout(() => {
      if (currentIndex + 1 < questionPool.length) {
        setCurrentIndex(prev => prev + 1);
        setTimeLeft(timePerQuestion);
        setIsAnswered(false);
        setSelectedOption(null);
      } else {
        finishGame(updatedScore);
      }
    }, delayMs);
  };

  const totalAnsweredQuestions = questionPool.length || questionCount;
  const exactAccuracyPct = totalAnsweredQuestions > 0 ? (correctCount / totalAnsweredQuestions) * 100 : 0;
  const roundedAccuracyPct = Math.round(exactAccuracyPct);
  const qualifiesForCertificate = exactAccuracyPct > 90;

  const soloSmartAnalysis = useMemo(() => {
    return analyzeCompetitionResults(
      [
        {
          id: 'solo-student',
          name: studentName.trim() || 'بطل الإبداع',
          score,
          correctAnswers: correctCount,
          totalAnswered: totalAnsweredQuestions,
          totalTimeSpent,
          questionLogs: attemptLogs
        }
      ],
      selectedTables,
      opMode
    );
  }, [studentName, score, correctCount, totalAnsweredQuestions, totalTimeSpent, attemptLogs, selectedTables, opMode]);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between dir-rtl">
      {/* الشريط العلوي */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md py-2.5 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>الرئيسية</span>
          </button>
          <h2 className="text-sm sm:text-base font-black text-white font-['El_Messiri',serif]">
            التدريب الفردي السريع
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono font-bold bg-amber-400/10 px-2.5 py-1 rounded-xl border border-amber-400/20">
            <Trophy className="w-3.5 h-3.5" />
            <span>أعلى رصيد: {toHindi(personalBest)}</span>
          </div>
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title={soundOn ? 'كتم الصوت' : 'تفعيل الصوت'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-6 mx-auto w-full my-auto ${
        gameState === 'finished' ? 'max-w-5xl' : 'max-w-3xl'
      }`}>
        {/* شاشة إعداد التدريب */}
        {gameState === 'setup' && (
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full bg-slate-900/95 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-2xl space-y-5"
          >
            {/* العنوان */}
            <div className="text-center space-y-1 pb-2 border-b border-slate-800/80">
              <h1 className="text-xl sm:text-2xl font-black text-white font-['El_Messiri',serif]">
                إعداد التدريب الفردي
              </h1>
              <p className="text-xs text-slate-400 font-bold">
                اختر الجداول وعدد الأسئلة والوقت المناسب ثم ابدأ التحدي دون تكرار للأسئلة
              </p>
            </div>

            {/* الخطوة ١: اسم المتدرب */}
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-2">
              <label className="text-xs font-black text-amber-400 block">
                ١. اسم الطالب المتدرب:
              </label>
              <input
                type="text"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="اكتب اسمك هنا..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            {/* الخطوة ٢: الجداول والعملية */}
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-amber-400">
                  ٢. الجداول ونوع العملية:
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

              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { sounds.playTap(); toggleTable(n); }}
                    className={`h-9 rounded-xl font-black text-xs sm:text-sm border transition-all font-mono ${
                      selectedTables.includes(n)
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {toHindi(n)}
                  </button>
                ))}
              </div>

              {/* اختيار نوع العملية */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'multi', label: 'الضرب فقط (×)' },
                  { id: 'divi', label: 'القسمة فقط (÷)' },
                  { id: 'mixed', label: 'مختلط (× و ÷)' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { sounds.playTap(); setOpMode(m.id as 'multi' | 'divi' | 'mixed'); }}
                    className={`py-2 rounded-xl text-xs font-black border transition-all ${
                      opMode === m.id
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* الخطوة ٣: عدد الأسئلة والوقت بتنظيم نظيف ومريح */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* عدد الأسئلة */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    <span>٣. عدد الأسئلة:</span>
                  </span>
                  <span className="text-xs font-mono font-black bg-amber-500/15 text-amber-300 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                    {toHindi(questionCount)} سؤالاً
                  </span>
                </div>

                {/* شريط تحكم موحد (ناقص / خانة رقم / زائد) */}
                <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => { sounds.playTap(); setQuestionCount(prev => Math.max(1, prev - 1)); }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                    title="إنقاص سؤال"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={questionCount}
                    onChange={e => setQuestionCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                    className="flex-1 bg-transparent text-center font-mono font-black text-base text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => { sounds.playTap(); setQuestionCount(prev => Math.min(200, prev + 1)); }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                    title="زيادة سؤال"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* منزلق سلس لاختيار الأعداد الكبيرة بلمسة واحدة */}
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={Math.min(100, questionCount)}
                  onChange={e => setQuestionCount(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />

                {/* اختصارات سريعة */}
                <div className="grid grid-cols-5 gap-1">
                  {[5, 10, 20, 30, 50].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => { sounds.playTap(); setQuestionCount(cnt); }}
                      className={`py-1 rounded-lg text-[11px] font-black font-mono border transition-all ${
                        questionCount === cnt
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {toHindi(cnt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* وقت السؤال */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5" />
                    <span>٤. وقت كل سؤال:</span>
                  </span>
                  <span className="text-xs font-mono font-black bg-indigo-500/15 text-indigo-300 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
                    {timePerQuestion > 0 ? `${toHindi(timePerQuestion)} ثانية` : 'بدون مؤقت'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {[
                    { sec: 5, label: '٥ ثوانٍ' },
                    { sec: 10, label: '١٠ ثوانٍ' },
                    { sec: 15, label: '١٥ ثانية' },
                    { sec: 20, label: '٢٠ ثانية' },
                    { sec: 30, label: '٣٠ ثانية' },
                    { sec: 0, label: 'وقت مفتوح' }
                  ].map(opt => (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => { sounds.playTap(); setTimePerQuestion(opt.sec); }}
                      className={`py-2.5 rounded-xl text-xs font-black border transition-all ${
                        timePerQuestion === opt.sec
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-slate-400 font-medium leading-relaxed pt-1">
                  تُمنح شهادة التفوق تلقائياً في نهاية التدريب لمن يحقق أكثر من ٩٠٪ في الإجابات الصحيحة.
                </p>
              </div>
            </div>

            {/* زر البدء */}
            <button
              onClick={startGame}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-base shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>ابدأ التدريب الفردي الآن ({toHindi(questionCount)} سؤالاً)</span>
            </button>
          </motion.div>
        )}

        {/* شاشة اللعب النشطة */}
        {gameState === 'playing' && currentQ && (
          <div className="w-full space-y-4">
            {/* شريط التقدم والمعلومات */}
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-xl text-xs font-mono font-black">
                    السؤال {toHindi(currentIndex + 1)} / {toHindi(questionPool.length)}
                  </span>
                  <div className="flex items-center gap-1 text-amber-400 font-mono font-black text-xs sm:text-sm">
                    <Trophy className="w-4 h-4" />
                    <span>{toHindi(score)} صحيحة</span>
                  </div>
                </div>

                {currentStreak > 1 && (
                  <div className="flex items-center gap-1 text-orange-400 font-black text-xs animate-bounce">
                    <Flame className="w-4 h-4 fill-current" />
                    <span>تتابع: {toHindi(currentStreak)} 🔥</span>
                  </div>
                )}

                {timePerQuestion > 0 ? (
                  <div className={`flex items-center gap-1 font-mono font-black text-sm px-2.5 py-1 rounded-xl ${
                    timeLeft <= 4 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-amber-300'
                  }`}>
                    <Timer className="w-4 h-4" />
                    <span>{toHindi(timeLeft)} ث</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                    وقت مفتوح
                  </span>
                )}
              </div>

              {/* شريط التقدم البصري */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                  style={{ width: `${Math.round(((currentIndex + 1) / Math.max(1, questionPool.length)) * 100)}%` }}
                />
              </div>
            </div>

            {/* بطاقة السؤال */}
            <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl text-center space-y-6 relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, scale: 0.9, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                  className="text-5xl sm:text-7xl font-black font-mono text-white tracking-widest flex items-center justify-center gap-4 select-none"
                >
                  <span>{toHindi(currentQ.a)}</span>
                  <span className="text-amber-400">{currentQ.operation}</span>
                  <span>{toHindi(currentQ.b)}</span>
                  <span className="text-slate-600">=</span>
                  <span className="text-indigo-400">؟</span>
                </motion.div>
              </AnimatePresence>

              {/* الخيارات الأربعة */}
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pt-2">
                {currentQ.options.map((opt, i) => {
                  const isChosen = selectedOption === opt;
                  const isCorrect = opt === currentQ.answer;

                  let style = 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700';
                  let badge = null;

                  if (isAnswered) {
                    if (isCorrect) {
                      style = 'bg-emerald-600 border-emerald-300 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400';
                      badge = (
                        <motion.span
                          initial={{ scale: 0, y: 6 }}
                          animate={{ scale: 1, y: 0 }}
                          transition={{ type: 'spring', stiffness: 450, damping: 18 }}
                          className="absolute -top-3 bg-emerald-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>الصحيحة</span>
                        </motion.span>
                      );
                    } else if (isChosen) {
                      style = 'bg-rose-600 border-rose-400 text-white';
                      badge = (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-3 bg-rose-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>خطأ</span>
                        </motion.span>
                      );
                    } else {
                      style = 'bg-slate-800/40 border-slate-800 text-slate-600 opacity-35';
                    }
                  }

                  const buttonAnimate = isAnswered
                    ? isCorrect && isChosen
                      ? { scale: [1, 1.1, 1.04], y: [0, -6, 0] }
                      : isCorrect
                      ? { scale: [1, 1.04, 1] }
                      : isChosen
                      ? { x: [0, -8, 8, -5, 5, 0] }
                      : { scale: 0.98 }
                    : { scale: 1, x: 0, y: 0 };

                  return (
                    <motion.button
                      key={`${currentIndex}-${i}`}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isAnswered}
                      animate={buttonAnimate}
                      transition={{ duration: 0.35 }}
                      whileHover={!isAnswered ? { scale: 1.03, y: -2 } : undefined}
                      whileTap={!isAnswered ? { scale: 0.96 } : undefined}
                      className={`relative py-4 px-2 rounded-2xl font-black text-3xl font-mono border-2 transition-colors shadow-md flex flex-col items-center justify-center cursor-pointer ${style}`}
                    >
                      {badge}
                      {isAnswered && isChosen && isCorrect && (
                        <motion.span
                          initial={{ opacity: 0, y: 4, scale: 0.6 }}
                          animate={{ opacity: [0, 1, 1, 0], y: -32, scale: [0.6, 1.2, 1.05] }}
                          transition={{ duration: 0.7 }}
                          className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-sm font-black text-amber-300 drop-shadow"
                        >
                          +١ 🌟
                        </motion.span>
                      )}
                      <span>{toHindi(opt)}</span>
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence>
                {isAnswered && selectedOption === currentQ.answer && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-black"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>
                      {currentStreak >= 3
                        ? `رائع! سلسلة ${toHindi(currentStreak)} إجابات متتالية 🔥`
                        : 'إجابة صحيحة! أحسنت يا بطل 🌟'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* شاشة النتائج النهائية والتقرير الذكي */}
        {gameState === 'finished' && (
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full space-y-4"
          >
            <div className="report-hide-on-print w-full bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-2xl text-center space-y-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg">
                <Trophy className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  انتهى التدريب يا {studentName || 'بطل الإبداع'}! 🌟
                </h2>
                <p className="text-xs text-slate-400 font-bold">
                  أنجزت {toHindi(totalAnsweredQuestions)} سؤالاً في زمن قدره {toHindi(totalTimeSpent.toFixed(1))} ثانية
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">الدرجة النهائية:</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {toHindi(correctCount)} / {toHindi(totalAnsweredQuestions)}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">النسبة العامة:</span>
                  <span className={`text-2xl font-black font-mono ${qualifiesForCertificate ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {toHindi(roundedAccuracyPct)}٪
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">إجابات خاطئة:</span>
                  <span className="text-2xl font-black text-rose-400 font-mono">{toHindi(wrongCount)}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">أعلى تتابع:</span>
                  <span className="text-2xl font-black text-orange-400 font-mono">{toHindi(bestStreak)} 🔥</span>
                </div>
              </div>

              {score >= personalBest && score > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>رقم قياسي شخصي جديد! تم تسجيل الإنجاز 🏆</span>
                </div>
              )}

              {/* شهادة التفوق: تظهر حصراً لمن حقق أكثر من ٩٠٪ */}
              {qualifiesForCertificate && onOpenCertificate ? (
                <button
                  onClick={() => onOpenCertificate(studentName || 'بطل الإبداع', score, correctCount, totalAnsweredQuestions, 1)}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.01] cursor-pointer"
                >
                  <Award className="w-5 h-5 fill-current" />
                  <span>👑 طباعة شهادة التفوق (اجتاز ٩٠٪)</span>
                </button>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-bold">
                  تُمنح شهادة التفوق فقط عند اجتياز نسبة ٩٠٪ (نسبتك الحالية: {toHindi(roundedAccuracyPct)}٪)
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={startGame}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة التدريب ⚡</span>
                </button>
                <button
                  onClick={() => setGameState('setup')}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                >
                  تعديل الأسئلة
                </button>
                <button
                  onClick={onBack}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  الرئيسية
                </button>
              </div>
            </div>

            {/* التقرير التحليلي الذكي للتدريب الفردي */}
            <SmartCompetitionReport
              title={`تقرير التحليل الذكي — ${studentName || 'بطل الإبداع'}`}
              subtitle="التدريب الفردي السريع"
              analysis={soloSmartAnalysis}
              opMode={opMode}
              onOpenCertificate={onOpenCertificate}
              exportFileName={`تقرير_التدريب_الفردي_${studentName || 'الطالب'}`}
            />
          </motion.div>
        )}
      </main>

      {/* التذييل */}
      <footer className="py-2 text-center border-t border-slate-900 bg-slate-950/60">
        <span className="text-[10px] text-slate-500 font-bold">
          مدارس رياض الإبداع • التدريب الفردي للحساب الذهني
        </span>
      </footer>
    </div>
  );
};
