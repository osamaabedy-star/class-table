/**
 * Solo Practice Blitz Game Component
 * Allows individual students to practice math tables at home or school,
 * track streaks, beat personal bests, and earn stars.
 * Riyadh Al-Ebdaa Schools
 */

import React, { useState, useEffect } from 'react';
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
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/audio';
import { toHindi } from '../utils/format';
import { RiyadhEbdaaLogo } from './RiyadhEbdaaLogo';

interface Question {
  a: number;
  b: number;
  operation: '×' | '÷';
  answer: number;
  options: number[];
}

interface SoloPracticeGameProps {
  onBack: () => void;
}

export const SoloPracticeGame: React.FC<SoloPracticeGameProps> = ({ onBack }) => {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'finished'>('setup');
  const [studentName, setStudentName] = useState<string>('بطل الإبداع');
  const [selectedTables, setSelectedTables] = useState<number[]>([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const [gameDuration, setGameDuration] = useState<number>(45); // 45 seconds
  const [soundOn, setSoundOn] = useState<boolean>(true);

  // Gameplay state
  const [timeLeft, setTimeLeft] = useState<number>(45);
  const [score, setScore] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  // High score in local storage
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

  const generateQuestion = (): Question => {
    const valid = selectedTables.length > 0 ? selectedTables : [2, 3, 4, 5];
    const table = valid[Math.floor(Math.random() * valid.length)];
    const factor = Math.floor(Math.random() * 11) + 2;
    const answer = table * factor;

    const opts = new Set<number>([answer]);
    while (opts.size < 4) {
      const delta = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1);
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
  };

  const startGame = () => {
    sounds.playTap();
    setScore(0);
    setCorrectCount(0);
    setWrongCount(0);
    setCurrentStreak(0);
    setBestStreak(0);
    setTimeLeft(gameDuration);
    setCurrentQ(generateQuestion());
    setIsAnswered(false);
    setSelectedOption(null);
    setFeedback(null);
    setGameState('playing');
  };

  // Timer countdown
  useEffect(() => {
    if (gameState !== 'playing') return;

    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        if (timeLeft <= 5) sounds.playTick(true);
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Game finished
      sounds.playFanfare();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      if (score > personalBest) {
        setPersonalBest(score);
        try {
          localStorage.setItem('solo_practice_best', score.toString());
        } catch {
          // ignore
        }
      }
      setGameState('finished');
    }
  }, [timeLeft, gameState, score, personalBest]);

  const handleSelectOption = (opt: number) => {
    if (isAnswered || !currentQ || gameState !== 'playing') return;
    setIsAnswered(true);
    setSelectedOption(opt);

    const isCorrect = opt === currentQ.answer;

    if (isCorrect) {
      sounds.playCorrect();
      sounds.playPraiseVoice(true);
      setFeedback('correct');
      const newScore = score + 1;
      setScore(newScore);
      setCorrectCount(prev => prev + 1);
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
    } else {
      sounds.playWrong();
      setFeedback('wrong');
      setWrongCount(prev => prev + 1);
      setCurrentStreak(0);
    }

    // Advance immediately after 0.5 second for rapid sprint feel
    setTimeout(() => {
      if (timeLeft > 0) {
        setCurrentQ(generateQuestion());
        setIsAnswered(false);
        setSelectedOption(null);
        setFeedback(null);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between dir-rtl">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md py-2 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>الرئيسية</span>
          </button>
          <div>
            <h2 className="text-sm font-black text-white">التدريب الفردي السريع (سبرنت الحساب)</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-amber-400 font-mono font-bold bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
            <Trophy className="w-3.5 h-3.5" />
            <span>أعلى رقم: {toHindi(personalBest)}</span>
          </div>
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 md:p-6 max-w-2xl mx-auto w-full my-auto">
        {/* SETUP SCREEN */}
        {gameState === 'setup' && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4"
          >
            <div className="text-center space-y-1">
              <span className="text-3xl">⚡</span>
              <h1 className="text-xl font-black text-white">تحدي السرعة الفردي</h1>
              <p className="text-xs text-slate-400 font-bold">أجب على أكبر قدر ممكن من الأسئلة قبل انتهاء الوقت</p>
            </div>

            {/* Student Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم الطالب:</label>
              <input
                type="text"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-amber-400"
              />
            </div>

            {/* Tables Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">الجداول المطلوبة في التدريب:</label>
              <div className="grid grid-cols-6 gap-1">
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => { sounds.playTap(); toggleTable(n); }}
                    className={`h-9 rounded-xl font-black text-xs border transition-all font-mono ${
                      selectedTables.includes(n)
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {toHindi(n)}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration with Free Custom Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                <span>مدة التحدي (حر):</span>
                <span className="text-amber-400 font-mono font-black">{toHindi(gameDuration)} ثانية</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="10"
                  max="600"
                  value={gameDuration}
                  onChange={e => setGameDuration(Math.max(5, Number(e.target.value) || 30))}
                  className="w-20 bg-slate-800 border border-amber-500/50 rounded-xl px-2 py-1.5 text-center font-mono font-black text-xs text-amber-300 outline-none focus:border-amber-400"
                  placeholder="أي ثانية"
                  title="اكتب أي وقت تريده بالثواني"
                />
                <div className="flex-1 grid grid-cols-4 gap-1">
                  {[30, 45, 60, 90].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => { sounds.playTap(); setGameDuration(sec); }}
                      className={`py-1.5 rounded-xl text-xs font-black border transition-all ${
                        gameDuration === sec
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {toHindi(sec)}ث
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch Button */}
            <button
              onClick={startGame}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-base shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>انطلاق التحدي الفردي ⚡</span>
            </button>
          </motion.div>
        )}

        {/* PLAYING SCREEN */}
        {gameState === 'playing' && currentQ && (
          <div className="w-full space-y-4">
            {/* Top Bar Stats */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl shadow-lg">
              <div className="flex items-center gap-1.5 text-amber-400 font-mono font-black text-sm">
                <Trophy className="w-4 h-4" />
                <span>{toHindi(score)} درجات</span>
              </div>

              {currentStreak > 1 && (
                <div className="flex items-center gap-1 text-orange-400 font-black text-xs animate-bounce">
                  <Flame className="w-4 h-4 fill-current" />
                  <span>تتابع: {toHindi(currentStreak)} 🔥</span>
                </div>
              )}

              <div className={`flex items-center gap-1 font-mono font-black text-base px-2.5 py-0.5 rounded-lg ${
                timeLeft <= 5 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-white'
              }`}>
                <Timer className="w-4 h-4" />
                <span>{toHindi(timeLeft)} ث</span>
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl text-center space-y-6">
              <div className="text-6xl sm:text-7xl font-black font-mono text-white tracking-widest flex items-center justify-center gap-4">
                <span>{toHindi(currentQ.a)}</span>
                <span className="text-amber-400">{currentQ.operation}</span>
                <span>{toHindi(currentQ.b)}</span>
                <span className="text-slate-600">=</span>
                <span className="text-indigo-400">؟</span>
              </div>

              {/* 4 Touch Options */}
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pt-2">
                {currentQ.options.map((opt, i) => {
                  const isChosen = selectedOption === opt;
                  const isCorrect = opt === currentQ.answer;

                  let style = 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700';
                  if (isAnswered) {
                    if (isCorrect) style = 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-500/40 animate-pulse';
                    else if (isChosen) style = 'bg-red-600 border-red-400 text-white';
                    else style = 'bg-slate-800/40 border-slate-800 text-slate-600 opacity-40';
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isAnswered}
                      className={`py-4 px-2 rounded-2xl font-black text-3xl font-mono border-2 transition-all shadow-md active:scale-95 flex items-center justify-center ${style}`}
                    >
                      {toHindi(opt)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* FINISHED SCREEN */}
        {gameState === 'finished' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl text-center space-y-4"
          >
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg">
              <Trophy className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">انتهى التحدي يا {studentName}! 🌟</h2>
              <p className="text-xs text-slate-400 font-bold">نتيجتك النهائية في التدريب الفردي</p>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold block">مجموع الدرجات:</span>
                <span className="text-2xl font-black text-amber-400 font-mono">{toHindi(score)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold block">إجابات صحيحة:</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">{toHindi(correctCount)}</span>
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

            <div className="flex gap-2 pt-2">
              <button
                onClick={startGame}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm shadow-md flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة التحدي ⚡</span>
              </button>
              <button
                onClick={onBack}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                العودة للرئيسية
              </button>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="py-2 text-center border-t border-slate-900 bg-slate-950/60">
        <span className="text-[10px] text-slate-500 font-bold">
          مدارس رياض الإبداع • التدريب الفردي للحساب الذهني
        </span>
      </footer>
    </div>
  );
};
