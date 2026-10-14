/**
 * Interactive Classroom Roulette Wheel Modal
 * Selects a specified number of students randomly with animation and sound effects
 * Riyadh Al-Ebdaa Schools
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Trophy, RotateCcw, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { SchoolStudent } from '../data/students';
import { sounds } from '../utils/audio';
import { toHindi } from '../utils/format';

interface RouletteWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: SchoolStudent[];
  onPickStudents: (chosenStudents: SchoolStudent[]) => void;
}

const COLORS = [
  '#f59e0b', // amber
  '#6366f1', // indigo
  '#10b981', // emerald
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
];

export const RouletteWheelModal: React.FC<RouletteWheelModalProps> = ({
  isOpen,
  onClose,
  students,
  onPickStudents,
}) => {
  const [spinning, setSpinning] = useState(false);
  const [winners, setWinners] = useState<SchoolStudent[]>([]);
  const [targetCount, setTargetCount] = useState<number>(4);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Available students list (max 24 for clean visual slices)
  const pool = students.slice(0, 24);

  // Draw the wheel on canvas
  useEffect(() => {
    if (!isOpen || pool.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const numSlices = pool.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    ctx.clearRect(0, 0, size, size);

    pool.forEach((student, i) => {
      const angle = i * sliceAngle;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, angle, angle + sliceAngle);
      ctx.closePath();

      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();

      // Draw student name text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Tajawal, sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
      const displayName = student.name.length > 14 ? student.name.slice(0, 12) + '..' : student.name;
      ctx.fillText(displayName, radius - 18, 4);
      ctx.restore();
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', center, center);
  }, [isOpen, pool]);

  if (!isOpen) return null;

  const spinWheel = () => {
    if (spinning || pool.length === 0) return;
    setSpinning(true);
    setWinners([]);

    // Determine how many to pick (capped at pool length)
    const countToPick = Math.min(Math.max(1, targetCount), pool.length);

    // Pick random unique winners
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const chosenList = shuffled.slice(0, countToPick);
    const primaryWinner = chosenList[0];
    const winningIdx = pool.findIndex(s => s.id === primaryWinner.id);

    const sliceAngleDeg = 360 / pool.length;
    const targetOffset = 270 - (winningIdx * sliceAngleDeg + sliceAngleDeg / 2);
    const fullSpins = 360 * 5; // 5 full rotations
    const newRotation = rotation + fullSpins + ((targetOffset - (rotation % 360) + 360) % 360);

    setRotation(newRotation);

    // Sound ticks during spin
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      sounds.playWheelTick();
      tickCount++;
      if (tickCount > 24) clearInterval(tickInterval);
    }, 120);

    // After animation ends
    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);
      setWinners(chosenList);
      sounds.playFanfare();
      sounds.playPraiseVoice(true);
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      onPickStudents(chosenList);
    }, 3200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md dir-rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-center space-y-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎡</span>
            <h3 className="text-sm sm:text-base font-black text-white">عجلة الحظ والاختيار العشوائي</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Count Selector */}
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>حدد عدد الطلاب المراد اختيارهم عشوائياً:</span>
            </span>
            <span className="text-xs font-mono font-bold text-white bg-amber-500/20 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
              {toHindi(targetCount)} طلاب
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {[1, 2, 3, 4, 5, 10].map(cnt => {
              if (cnt > Math.max(1, pool.length)) return null;
              return (
                <button
                  key={cnt}
                  onClick={() => { sounds.playTap(); setTargetCount(cnt); }}
                  className={`py-1.5 rounded-xl text-xs font-black font-mono transition-all border ${
                    targetCount === cnt
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {toHindi(cnt)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wheel Container with Pointer */}
        <div className="relative mx-auto w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
          {/* Indicator Arrow at Top */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 text-amber-400 filter drop-shadow">
            <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-amber-400" />
          </div>

          {/* Canvas Wheel */}
          <canvas
            ref={canvasRef}
            width={256}
            height={256}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 3.2s cubic-bezier(0.15, 0.9, 0.25, 1)' : 'none',
            }}
            className="rounded-full shadow-2xl border-4 border-slate-800"
          />
        </div>

        {/* Winners Announcement or Prompt */}
        <AnimatePresence mode="wait">
          {winners.length > 0 ? (
            <motion.div
              key="winners"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border-2 border-amber-400 shadow-lg space-y-2"
            >
              <div className="flex items-center justify-center gap-1.5 text-amber-400 text-xs font-black">
                <Trophy className="w-4 h-4" />
                <span>تم اختيار الأبطال بنجاح ({toHindi(winners.length)} طلاب)!</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {winners.map(w => (
                  <span key={w.id} className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-1 rounded-xl shadow">
                    {w.name}
                  </span>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="text-xs text-slate-400 font-bold py-1">
              {spinning ? 'العجلة تدور لاختيار الأبطال...' : `اضغط للتدوير واختيار (${toHindi(targetCount)}) طلاب عشوائياً من إجمالي (${toHindi(pool.length)}) طالب`}
            </div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        <div className="flex gap-2">
          <button
            onClick={spinWheel}
            disabled={spinning || pool.length === 0}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
          >
            <RotateCcw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
            <span>{winners.length > 0 ? 'تدوير مرة أخرى 🎡' : `بدء اختيار (${toHindi(targetCount)}) عشوائياً 🎡`}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
          >
            تم
          </button>
        </div>
      </motion.div>
    </div>
  );
};
