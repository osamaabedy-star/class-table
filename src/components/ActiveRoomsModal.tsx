import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Play, 
  X, 
  Plus, 
  Radio, 
  Swords, 
  RefreshCw, 
  Eye, 
  ArrowRight,
  Flame
} from 'lucide-react';
import { toHindi } from '../utils/format';

export interface RoomSummary {
  id: string;
  title: string;
  roomType: 'duel' | 'group';
  status: 'lobby' | 'playing' | 'intermission' | 'finished';
  currentQuestionIndex: number;
  totalQuestions: number;
  studentCount: number;
  students: Array<{ name: string; score: number; correctCount: number }>;
  createdAt: number;
}

interface ActiveRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoom: (roomId: string, mode: 'student' | 'teacher') => void;
  onCreateNewRoom: () => void;
}

export const ActiveRoomsModal: React.FC<ActiveRoomsModalProps> = ({
  isOpen,
  onClose,
  onSelectRoom,
  onCreateNewRoom
}) => {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
      const interval = setInterval(fetchRooms, 1500);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">الغرف النشطة حالياً</h3>
                <p className="text-xs text-slate-400 font-bold">
                  يمكن إدارة وتشغيل عدة غرف في نفس الوقت
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchRooms}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="تحديث"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Rooms list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {rooms.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-400">لا توجد غرف نشطة حالياً</p>
                <button
                  onClick={() => { onClose(); onCreateNewRoom(); }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  إنشاء أول غرفة الآن
                </button>
              </div>
            ) : (
              rooms.map(room => {
                const isPlaying = room.status === 'playing' || room.status === 'intermission';
                const isFinished = room.status === 'finished';

                return (
                  <div
                    key={room.id}
                    className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/70 hover:border-slate-600 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
                          {room.id}
                        </span>
                        <span className="font-black text-white text-base">
                          {room.title || 'مسابقة جدول الضرب'}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          {room.roomType === 'duel' ? '(١ ضد ١)' : '(جماعي)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 font-bold">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{toHindi(room.studentCount)} متسابقين</span>
                        </span>
                        <span>•</span>
                        <span className={`font-black ${
                          isPlaying ? 'text-emerald-400' : isFinished ? 'text-slate-400' : 'text-amber-400'
                        }`}>
                          {isPlaying ? `جارية (السؤال ${toHindi(room.currentQuestionIndex + 1)} من ${toHindi(room.totalQuestions)})` : isFinished ? 'منتهية' : 'في الانتظار'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          onClose();
                          onSelectRoom(room.id, 'teacher');
                        }}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>شاشة المعلم</span>
                      </button>

                      <button
                        onClick={() => {
                          onClose();
                          onSelectRoom(room.id, 'student');
                        }}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>دخول كمتسابق</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer action: Create another room */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">
              إجمالي الغرف: {toHindi(rooms.length)}
            </span>
            <button
              onClick={() => {
                onClose();
                onCreateNewRoom();
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء غرفة جديدة إضافية</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
