/**
 * Interactive Classroom Roulette Wheel Modal
 * Selects students randomly with animation and sound effects
 * Riyadh Al-Ebdaa Schools
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Trophy, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { SchoolStudent } from '../data/students';
import { sounds } from '../utils/audio';

interface RouletteWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: SchoolStudent[];
  onPickStudent: (student: SchoolStudent) => void;
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
  onPickStudent,
}) => {
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<SchoolStudent | null>(null);
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
    setWinner(null);

    // Pick random winner
    const winningIdx = Math.floor(Math.random() * pool.length);
    const chosen = pool[winningIdx];
    const sliceAngleDeg = 360 / pool.length;

    // Angle to bring the winning index to the pointer at top (270 degrees)
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
      setWinner(chosen);
      sounds.playFanfare();
      sounds.playPraiseVoice(true);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      onPickStudent(chosen);
    }, 3200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md dir-rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-center space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎡</span>
            <h3 className="text-sm font-black text-white">عجلة الحظ لاختيار البطل</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wheel Container with Pointer */}
        <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
          {/* Indicator Arrow at Top */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 text-amber-400 filter drop-shadow">
            <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-amber-400" />
          </div>

          {/* Canvas Wheel */}
          <canvas
            ref={canvasRef}
            width={288}
            height={288}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 3.2s cubic-bezier(0.15, 0.9, 0.25, 1)' : 'none',
            }}
            className="rounded-full shadow-2xl border-4 border-slate-800"
          />
        </div>

        {/* Winner Announcement or Prompt */}
        <AnimatePresence mode="wait">
          {winner ? (
            <motion.div
              key="winner"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border-2 border-amber-400 shadow-lg"
            >
              <div className="flex items-center justify-center gap-1.5 text-amber-400 text-xs font-black mb-1">
                <Trophy className="w-4 h-4" />
                <span>تم اختيار بطل الدور!</span>
              </div>
              <p className="text-xl font-black text-white font-['El_Messiri',serif]">
                {winner.name}
              </p>
            </motion.div>
          ) : (
            <div className="text-xs text-slate-400 font-bold py-1">
              {spinning ? 'العجلة تدور لاختيار الطالب...' : 'اضغط للتدوير واختيار الطالب عشوائياً'}
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
            <span>{winner ? 'تدوير مرة أخرى 🎡' : 'تدوير عجلة الحظ 🎡'}</span>
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
