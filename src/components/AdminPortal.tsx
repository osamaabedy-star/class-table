/**
 * Admin Portal Component
 * Riyadh Al-Ebdaa Schools
 * Comprehensive Student Roster Management, Deep Classroom Analytics & Honor Rolls
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Users,
  BarChart3,
  Award,
  Upload,
  UserPlus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  X,
  LogOut,
  RefreshCw,
  Trophy,
  Star,
  Flame,
  ArrowRight,
  Filter,
  GraduationCap,
  Sparkles,
  Lock,
  Printer,
  ChevronDown,
  Layers,
  Radio,
  Mail,
  Eye,
  EyeOff,
  Download,
  FileSpreadsheet,
  Database
} from 'lucide-react';
import { RiyadhEbdaaLogo } from './RiyadhEbdaaLogo';
import { toHindi } from '../utils/format';
import {
  SchoolStudent,
  SCHOOL_GRADES,
  GradeInfo,
  fetchSchoolStudentsFromServer,
  syncStudentsListToServer,
  parsePastedStudentNames
} from '../data/students';
import {
  TestSessionRecord,
  fetchTestSessionsFromServer,
  exportTestDatabaseToExcel,
  deleteTestSessionFromDatabase
} from '../data/testDatabase';
import { sounds } from '../utils/audio';
import { setAdminToken, clearAdminToken, getAdminToken, getAdminAuthHeaders } from '../utils/auth';

interface AdminPortalProps {
  onBack: () => void;
  onOpenCertificate: (name: string, score: number, correct: number, total: number) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onBack,
  onOpenCertificate
}) => {
  // Authentication State via verified token
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(getAdminToken());
  });
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'roster' | 'upload' | 'analytics' | 'honor' | 'liveRooms'>('roster');

  // Students Data
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Roster Filters
  const [selectedGradeId, setSelectedGradeId] = useState<string>('grade3');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Batch Upload State
  const [uploadText, setUploadText] = useState<string>('');
  const [uploadGradeId, setUploadGradeId] = useState<string>('grade3');
  const [uploadSection, setUploadSection] = useState<string>('أ');
  const [uploadMode, setUploadMode] = useState<'append' | 'replaceGrade'>('append');

  // Single Add / Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<SchoolStudent | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formGradeId, setFormGradeId] = useState<string>('grade3');
  const [formSection, setFormSection] = useState<string>('أ');

  // Analytics Data from API
  const [analytics, setAnalytics] = useState<any>(null);

  // Test Database Records (for analytics)
  const [testSessions, setTestSessions] = useState<TestSessionRecord[]>([]);
  const [inspectingTest, setInspectingTest] = useState<TestSessionRecord | null>(null);

  // Live Rooms Data
  const [liveRooms, setLiveRooms] = useState<any[]>([]);

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await fetchSchoolStudentsFromServer();
      setStudents(list);

      // Fetch analytics
      const anaRes = await fetch('/api/school/analytics');
      if (anaRes.ok) {
        const anaData = await anaRes.json();
        setAnalytics(anaData);
      }

      // Fetch test database
      const tests = await fetchTestSessionsFromServer();
      setTestSessions(tests);

      // Fetch active rooms
      const roomsRes = await fetch('/api/rooms');
      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setLiveRooms(roomsData.rooms || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  // Handle Strict Admin Login via Server
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass })
      });
      const data = await res.json();

      if (res.ok && data.success && data.token) {
        setIsAuthenticated(true);
        setAdminToken(data.token, data.email || cleanEmail);
        sounds.playSuccess();
        showToast('تم تسجيل الدخول بنجاح');
      } else {
        setLoginError(data.error || 'فشل تسجيل الدخول. تحقق من صحة البريد وكلمة المرور');
        sounds.playWrong();
      }
    } catch {
      setLoginError('تعذر الاتصال بالخادم للتحقق من بيانات الدخول');
      sounds.playWrong();
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    clearAdminToken();
    setEmailInput('');
    setPasswordInput('');
    sounds.playTap();
  };

  // Export & Import Roster JSON
  const handleExportJSON = () => {
    sounds.playTap();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(students, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `riyadh_students_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('تم تصدير ملف الطلاب بنجاح');
  };

  // Full Database Snapshot Backup (Students + Tests)
  const handleDownloadFullBackup = async () => {
    sounds.playTap();
    try {
      const res = await fetch('/api/admin/backup', {
        headers: getAdminAuthHeaders()
      });
      if (res.ok) {
        const backupData = await res.json();
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `riyadh_full_database_backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('تم حفظ وتحميل النسخة الاحتياطية الشاملة بنجاح');
        sounds.playSuccess();
      } else {
        showToast('تعذر إنشاء النسخة الاحتياطية من الخادم');
      }
    } catch {
      showToast('خطأ أثناء تحميل النسخة الاحتياطية');
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStudents(parsed);
          await syncStudentsListToServer(parsed);
          showToast(`تم استيراد ${parsed.length} طالب بنجاح`);
          sounds.playSuccess();
        } else if (parsed && Array.isArray(parsed.students)) {
          // Full backup file detected
          setStudents(parsed.students);
          await syncStudentsListToServer(parsed.students);
          showToast(`تمت استعادة ${parsed.students.length} طالب من النسخة الاحتياطية`);
          sounds.playSuccess();
        } else {
          showToast('ملف غير صالح');
        }
      } catch {
        showToast('فشل قراءة الملف');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered Students for Roster tab
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedGradeId !== 'all' && s.gradeId !== selectedGradeId) return false;
      if (selectedSection !== 'all' && s.section !== selectedSection) return false;
      if (searchQuery.trim() && !s.name.includes(searchQuery.trim())) return false;
      return true;
    });
  }, [students, selectedGradeId, selectedSection, searchQuery]);

  // Batch Upload Submit
  const handleBatchUpload = async () => {
    if (!uploadText.trim()) return;
    const parsed = parsePastedStudentNames(uploadText, uploadGradeId, uploadSection);
    if (parsed.length === 0) {
      showToast('لم يتم العثور على أي أسماء صالحة');
      return;
    }

    setIsSaving(true);
    try {
      let nextList = [...students];
      if (uploadMode === 'replaceGrade') {
        // Remove students from this grade and section
        nextList = nextList.filter(s => !(s.gradeId === uploadGradeId && s.section === uploadSection));
      }
      nextList = [...nextList, ...parsed];

      const ok = await syncStudentsListToServer(nextList);
      if (ok) {
        setStudents(nextList);
        setUploadText('');
        showToast(`تمت إضافة ${toHindi(parsed.length)} طالباً بنجاح!`);
        sounds.playSuccess();
        loadData();
      } else {
        showToast('تعذر الحفظ على الخادم');
      }
    } catch {
      showToast('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Single Student
  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف الطالب: ${name}؟`)) return;
    const nextList = students.filter(s => s.id !== id);
    setStudents(nextList);
    try {
      await fetch(`/api/school/students/${id}`, { 
        method: 'DELETE',
        headers: getAdminAuthHeaders()
      });
      await syncStudentsListToServer(nextList);
      showToast(`تم حذف الطالب: ${name}`);
      sounds.playTap();
      loadData();
    } catch {
      showToast('تعذر الحذف');
    }
  };

  // Save Add / Edit Student Form
  const handleSaveStudent = async () => {
    const trimmedName = formName.trim();
    if (!trimmedName) return;

    const gradeInfo = SCHOOL_GRADES.find(g => g.id === formGradeId);
    const gradeName = gradeInfo?.name || 'الصف المحدد';

    let nextList = [...students];
    if (editingStudent) {
      nextList = nextList.map(s => {
        if (s.id === editingStudent.id) {
          return {
            ...s,
            name: trimmedName,
            gradeId: formGradeId,
            gradeName,
            section: formSection
          };
        }
        return s;
      });
    } else {
      const newSt: SchoolStudent = {
        id: `student-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: trimmedName,
        gradeId: formGradeId,
        gradeName,
        section: formSection,
        level: 1,
        participationCount: 0,
        lastActiveDate: 'لم يشارك',
        totalScore: 0,
        correctCount: 0,
        totalAnswered: 0,
        bestStreak: 0
      };
      nextList.push(newSt);
    }

    setIsSaving(true);
    try {
      await syncStudentsListToServer(nextList);
      setStudents(nextList);
      setIsEditModalOpen(false);
      setEditingStudent(null);
      setFormName('');
      showToast('تم حفظ بيانات الطالب بنجاح');
      sounds.playSuccess();
      loadData();
    } catch {
      showToast('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset entire school roster
  const handleClearAll = async () => {
    if (!confirm('تحذير: هل أنت متأكد من مسح جميع قوائم الطلاب بالكامل من المدرسة؟')) return;
    try {
      await fetch('/api/school/students', { 
        method: 'DELETE',
        headers: getAdminAuthHeaders()
      });
      setStudents([]);
      showToast('تم مسح جميع القوائم بنجاح');
      sounds.playTap();
      loadData();
    } catch {
      showToast('تعذر المسح');
    }
  };

  // -------------------------------------------------------------
  // LOGIN SCREEN (if not authenticated)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 font-sans dir-rtl">
        <header className="flex items-center justify-between border-b border-slate-800 pb-3 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>الرئيسية</span>
            </button>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>دخول الإدارة المدرسية</span>
            </div>
          </div>
          <RiyadhEbdaaLogo size="xs" />
        </header>

        <main className="flex-1 flex items-center justify-center py-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl space-y-4"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-base font-black text-white">تسجيل دخول المشرف العام</h2>
              <p className="text-[11px] text-slate-400 mt-1">
                مخصص للأستاذ أسامة العابدي
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3 text-right">
              <div>
                <label className="text-[10px] font-bold text-slate-300 block mb-1">
                  البريد الإلكتروني للإدارة:
                </label>
                <div className="relative">
                  <input
                    type="email"
                    dir="ltr"
                    required
                    autoFocus
                    placeholder="name@example.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-400 transition-colors"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-300 block mb-1">
                  كلمة المرور:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    required
                    placeholder="••••••"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <p className="text-[11px] text-rose-400 font-bold bg-rose-500/10 py-1.5 px-2 rounded-lg border border-rose-500/20 text-center">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 mt-2"
              >
                <span>دخول لوحة التحكم</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        </main>

        <footer className="py-2 text-center border-t border-slate-900 text-[10px] text-slate-500 font-bold">
          مدارس رياض الإبداع • الإدارة المدرسية
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATED ADMIN DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between font-sans dir-rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 border border-indigo-400 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-xl flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Admin Header (Compact & Sharp) */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors"
              title="العودة للصفحة الرئيسية"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">الرئيسية</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm font-black text-white leading-tight">
                  بوابة الإدارة المدرسية والتحليل
                </h1>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  إجمالي الطلاب: {toHindi(students.length)} طالب
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{localStorage.getItem('riyadh_admin_email') || 'المشرف العام'}</span>
            </div>
            <RiyadhEbdaaLogo size="xs" />
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1 border border-rose-500/20 transition-colors"
              title="تسجيل الخروج من الإدارة"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>

        {/* Compact Tabs Bar */}
        <div className="max-w-6xl mx-auto flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => { sounds.playTap(); setActiveTab('roster'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              activeTab === 'roster'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>قوائم وفصول الطلاب</span>
            <span className="bg-slate-950/20 px-1.5 py-0.2 rounded text-[10px]">
              {toHindi(students.length)}
            </span>
          </button>

          <button
            onClick={() => { sounds.playTap(); setActiveTab('upload'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>إضافة ورفع الأسماء</span>
          </button>

          <button
            onClick={() => { sounds.playTap(); setActiveTab('analytics'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              activeTab === 'analytics'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>التحليل المدرسي للفصول</span>
          </button>

          <button
            onClick={() => { sounds.playTap(); setActiveTab('honor'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              activeTab === 'honor'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>لوحات وقوائم الشرف</span>
          </button>

          <button
            onClick={() => { sounds.playTap(); setActiveTab('liveRooms'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
              activeTab === 'liveRooms'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span>المسابقات الحية</span>
            {liveRooms.length > 0 && (
              <span className="bg-rose-500 text-white px-1.5 py-0.2 rounded-full text-[9px] animate-pulse">
                {toHindi(liveRooms.length)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-3 sm:p-5">
        {/* ========================================================= */}
        {/* TAB 1: STUDENT ROSTER (COMPACT STUDENT CARDS) */}
        {/* ========================================================= */}
        {activeTab === 'roster' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2.5">
              {/* Grade Selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400">الصف:</span>
                <button
                  onClick={() => setSelectedGradeId('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    selectedGradeId === 'all'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  جميع الصفوف
                </button>
                {SCHOOL_GRADES.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGradeId(g.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                      selectedGradeId === g.id
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {g.shortName}
                  </button>
                ))}
              </div>

              {/* Section Selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400">الشعبة:</span>
                {['all', 'أ', 'ب', 'ج', 'د'].map(sec => (
                  <button
                    key={sec}
                    onClick={() => setSelectedSection(sec)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                      selectedSection === sec
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {sec === 'all' ? 'الكل' : `شعبة ${sec}`}
                  </button>
                ))}
              </div>

              {/* Search & Actions */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث عن طالب..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pr-8 pl-2 py-1 text-xs text-white outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  onClick={() => {
                    setEditingStudent(null);
                    setFormName('');
                    setFormGradeId(selectedGradeId === 'all' ? 'grade3' : selectedGradeId);
                    setFormSection('أ');
                    setIsEditModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>طالب جديد</span>
                </button>

                <button
                  onClick={handleDownloadFullBackup}
                  className="px-2 py-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-200 font-bold text-xs flex items-center gap-1 shrink-0 border border-indigo-700/60"
                  title="نسخ احتياطي شامل لبيانات المدرسة والاختبارات"
                >
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">نسخ احتياطي شامل</span>
                </button>

                <button
                  onClick={handleExportJSON}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 shrink-0 border border-slate-700"
                  title="تصدير ملف النسخ الاحتياطي للطلاب"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">تصدير</span>
                </button>

                <label
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 shrink-0 border border-slate-700 cursor-pointer"
                  title="استيراد ملف النسخ الاحتياطي للطلاب"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">استيراد</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportJSON}
                  />
                </label>
              </div>
            </div>

            {/* Students List Count */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
              <span>
                عرض {toHindi(filteredStudents.length)} من إجمالي {toHindi(students.length)} طالب
              </span>
              {students.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-rose-400 hover:text-rose-300 text-[11px] font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>مسح القائمة</span>
                </button>
              )}
            </div>

            {/* Students Grid - Compact, Sleek Cards */}
            {filteredStudents.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300">لا توجد أسماء طلاب مسجلة</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  يمكنك رفع قائمة الطلاب دفعة واحدة عبر تبويب "إضافة ورفع الأسماء"
                </p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع أسماء الفصل الآن</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {filteredStudents.map(student => {
                  return (
                    <div
                      key={student.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-2 rounded-xl flex flex-col justify-between transition-colors shadow-sm group"
                    >
                      {/* Name & Badge Header */}
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-white truncate group-hover:text-amber-400 transition-colors" title={student.name}>
                          {student.name}
                        </span>
                        {/* Compact Level Badge */}
                        <span className="shrink-0 text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1 py-0.2 rounded">
                          م.{toHindi(student.level || 1)}
                        </span>
                      </div>

                      {/* Class & Section Tag */}
                      <div className="text-[10px] text-slate-400 font-medium truncate mb-1">
                        {student.gradeName.replace(' الابتدائي', '')} ({student.section})
                      </div>

                      {/* Compact Stats Row (Requested by user: level, last participation, participation count) */}
                      <div className="bg-slate-950/70 rounded-lg p-1 text-[9px] font-bold text-slate-400 grid grid-cols-2 gap-1 border border-slate-800/80 mb-1.5">
                        <div title="عدد مرات الاشتراك">
                          <span>مشاركات: </span>
                          <span className="text-amber-400">{toHindi(student.participationCount || 0)}</span>
                        </div>
                        <div title="آخر دخول للمسابقة" className="truncate">
                          <span>آخر: </span>
                          <span className="text-slate-300">{student.lastActiveDate || 'لم يشارك'}</span>
                        </div>
                        <div title="إجمالي النقاط">
                          <span>النقاط: </span>
                          <span className="text-emerald-400">{toHindi(student.totalScore || 0)}</span>
                        </div>
                        <div title="نسبة الدقة">
                          <span>الدقة: </span>
                          <span className="text-indigo-400">
                            {student.totalAnswered > 0 
                              ? `${toHindi(Math.round((student.correctCount / student.totalAnswered) * 100))}٪`
                              : '—'
                            }
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-800/60">
                        <button
                          onClick={() => {
                            setEditingStudent(student);
                            setFormName(student.name);
                            setFormGradeId(student.gradeId);
                            setFormSection(student.section);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id, student.name)}
                          className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: BATCH UPLOAD & PASTE ROSTER */}
        {/* ========================================================= */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>رفع ولصق أسماء الطلاب دفعة واحدة</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  الصق أسماء الطلاب من نظام نور أو ملف وورد/إكسل (كل اسم في سطر مستقل)
                </p>
              </div>

              {/* Class & Section Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    اختر الصف الدراسي:
                  </label>
                  <select
                    value={uploadGradeId}
                    onChange={e => setUploadGradeId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-indigo-400"
                  >
                    {SCHOOL_GRADES.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    اختر الشعبة:
                  </label>
                  <select
                    value={uploadSection}
                    onChange={e => setUploadSection(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-indigo-400"
                  >
                    {['أ', 'ب', 'ج', 'د'].map(sec => (
                      <option key={sec} value={sec}>شعبة {sec}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-400">
                    قائمة الأسماء:
                  </label>
                  {uploadText.trim() && (
                    <span className="text-[10px] font-bold text-amber-400">
                      تم رصد {toHindi(uploadText.split(/[\r\n,]+/).filter(l => l.trim().length > 1).length)} اسماً
                    </span>
                  )}
                </div>
                <textarea
                  rows={8}
                  placeholder="محمد عبدالله الشهري&#10;خالد فهد الدوسري&#10;عمر إبراهيم العتيبي&#10;زياد سامي القحطاني..."
                  value={uploadText}
                  onChange={e => setUploadText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-indigo-400 placeholder:text-slate-600 leading-relaxed"
                />
              </div>

              {/* Mode Options */}
              <div className="flex items-center gap-4 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-xs font-bold">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="uploadMode"
                    checked={uploadMode === 'append'}
                    onChange={() => setUploadMode('append')}
                    className="accent-indigo-500"
                  />
                  <span>إضافة للقائمة الحالية</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="uploadMode"
                    checked={uploadMode === 'replaceGrade'}
                    onChange={() => setUploadMode('replaceGrade')}
                    className="accent-indigo-500"
                  />
                  <span>استبدال طلاب هذه الشعبة</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleBatchUpload}
                disabled={isSaving || !uploadText.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ وتثبيت الأسماء في المدرسة</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DEEP ANALYTICS & INSIGHTS */}
        {/* ========================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            {/* Top KPIs Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block">إجمالي طلاب المدرسة</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400">
                  {toHindi(analytics?.totalStudents ?? students.length)}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block">إجمالي المشاركات بالمسابقات</span>
                <span className="text-xl sm:text-2xl font-black text-indigo-400">
                  {toHindi(analytics?.totalParticipations ?? 0)}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block">متوسط الدقة والإتقان</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400">
                  {toHindi(analytics?.overallAccuracy ?? 0)}٪
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block">إجمالي النقاط المكتسبة</span>
                <span className="text-xl sm:text-2xl font-black text-purple-400">
                  {toHindi(analytics?.totalScoreAll ?? 0)}
                </span>
              </div>
            </div>

            {/* Grade Breakdown Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <span>تحليل الأداء حسب الصفوف الدراسية</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-bold">
                      <th className="py-2 px-3">الصف الدراسي</th>
                      <th className="py-2 px-3">عدد الطلاب</th>
                      <th className="py-2 px-3">المشاركات</th>
                      <th className="py-2 px-3">نسبة الدقة</th>
                      <th className="py-2 px-3">فارس الصف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-bold">
                    {(analytics?.gradeStats || []).map((g: any) => (
                      <tr key={g.gradeId} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-white">{g.gradeName}</td>
                        <td className="py-2.5 px-3 text-slate-300">{toHindi(g.studentCount)}</td>
                        <td className="py-2.5 px-3 text-indigo-400">{toHindi(g.participations)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 w-8">{toHindi(g.accuracy)}٪</span>
                            <div className="flex-1 max-w-[80px] bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full"
                                style={{ width: `${g.accuracy}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-amber-400">
                          {g.topStudent ? `${g.topStudent.name} (${g.topStudent.section})` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sections Breakdown */}
            {analytics?.sectionStats && analytics.sectionStats.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>مقارنة الفصول والشعب</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {analytics.sectionStats.map((sec: any, idx: number) => (
                    <div key={idx} className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-xl space-y-1">
                      <div className="text-xs font-black text-white truncate">{sec.title}</div>
                      <div className="text-[10px] text-slate-400 font-bold flex justify-between">
                        <span>الطلاب: {toHindi(sec.studentCount)}</span>
                        <span className="text-amber-400">المشاركات: {toHindi(sec.participations)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. TEST SESSIONS DATABASE & HISTORICAL ANALYTICS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs sm:text-sm font-black text-white">
                    قاعدة بيانات الاختبارات المنجزة ({toHindi(testSessions.length)} اختبار موثق)
                  </h3>
                </div>

                {testSessions.length > 0 && (
                  <button
                    onClick={() => exportTestDatabaseToExcel(testSessions)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>تصدير قاعدة بيانات الاختبارات (Excel)</span>
                  </button>
                )}
              </div>

              {testSessions.length === 0 ? (
                <div className="py-8 text-center bg-slate-950/60 rounded-xl border border-slate-800/80 p-4 space-y-1">
                  <Database className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 font-bold">لا توجد اختبارات مسجلة بعد في قاعدة البيانات</p>
                  <p className="text-[11px] text-slate-500">
                    عند إنجاز أي مسابقة أو اختبار سبورة، ستظهر سجلاته ونتائج الطلاب التفصيلية هنا تلقائياً للتحليل
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-bold">
                        <th className="py-2.5 px-3">التاريخ والوقت</th>
                        <th className="py-2.5 px-3">عنوان الاختبار / الصف</th>
                        <th className="py-2.5 px-3">الجداول المختبرة</th>
                        <th className="py-2.5 px-3">المشاركون</th>
                        <th className="py-2.5 px-3">متوسط الدقة</th>
                        <th className="py-2.5 px-3">فارس الاختبار</th>
                        <th className="py-2.5 px-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-bold">
                      {testSessions.map(test => (
                        <tr key={test.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {test.dateFormatted}
                          </td>
                          <td className="py-2.5 px-3 text-white">
                            <span className="block font-black">{test.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {test.gradeName} • فصل {test.section}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-indigo-300 font-mono">
                            {test.tables.map(t => toHindi(t)).join('، ')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-mono">
                            {toHindi(test.totalParticipants)} طالب
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              {toHindi(test.averageAccuracy)}٪
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-amber-400">
                            {test.topStudentName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setInspectingTest(test)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[11px] font-bold border border-indigo-500/30 transition-colors"
                              >
                                عرض النتائج
                              </button>
                              <button
                                onClick={() => exportTestDatabaseToExcel([test])}
                                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="تصدير هذا الاختبار كـ Excel"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (window.confirm('هل تريد حذف هذا الاختبار من قاعدة البيانات؟')) {
                                    await deleteTestSessionFromDatabase(test.id);
                                    setTestSessions(prev => prev.filter(t => t.id !== test.id));
                                    showToast('تم حذف سجل الاختبار من قاعدة البيانات');
                                  }
                                }}
                                className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                                title="حذف السجل"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: HONOR ROLLS & WALL OF CHAMPIONS */}
        {/* ========================================================= */}
        {activeTab === 'honor' && (
          <div className="space-y-4">
            {/* Top 10 Overall Champions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>لوحة الشرف العامة (فرسان مدارس رياض الإبداع)</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  مرتبة حسب النقاط والإتقان
                </span>
              </div>

              {(!analytics?.honorRolls?.topOverall || analytics.honorRolls.topOverall.length === 0) ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  ستظهر أسماء المتفوقين هنا فور إتمام أولى المسابقات
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {analytics.honorRolls.topOverall.map((student: SchoolStudent, rank: number) => {
                    const isGold = rank === 0;
                    const isSilver = rank === 1;
                    const isBronze = rank === 2;

                    return (
                      <div
                        key={student.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-transform ${
                          isGold
                            ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                            : isSilver
                            ? 'bg-slate-800/80 border-slate-700'
                            : isBronze
                            ? 'bg-amber-700/10 border-amber-700/30'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Rank Icon */}
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            isGold
                              ? 'bg-amber-500 text-slate-950'
                              : isSilver
                              ? 'bg-slate-300 text-slate-950'
                              : isBronze
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {toHindi(rank + 1)}
                          </div>

                          <div className="min-w-0">
                            <span className="font-black text-xs text-white truncate block">
                              {student.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {student.gradeName.replace(' الابتدائي', '')} ({student.section})
                            </span>
                          </div>
                        </div>

                        {/* Points & Certificate Button */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="text-left font-mono">
                            <span className="text-xs font-black text-amber-400 block">
                              {toHindi(student.totalScore)}
                            </span>
                            <span className="text-[9px] text-slate-500">نقطة</span>
                          </div>

                          <button
                            onClick={() => onOpenCertificate(student.name, student.totalScore, student.correctCount, student.totalAnswered || 10)}
                            className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors"
                            title="طباعة شهادة تفوق"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Speed & Accuracy Stars */}
            {analytics?.honorRolls?.masteryStars && analytics.honorRolls.masteryStars.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-emerald-400" />
                  <span>نجوم الدقة والإتقان الكامل (نسبة إجابات صحيحة فائقة)</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {analytics.honorRolls.masteryStars.map((st: SchoolStudent) => (
                    <div key={st.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                      <span className="text-xs font-bold text-white truncate">{st.name}</span>
                      <div className="text-[10px] text-slate-400 flex justify-between mt-1">
                        <span>{st.gradeName.replace(' الابتدائي', '')}</span>
                        <span className="text-emerald-400 font-bold">
                          {toHindi(Math.round((st.correctCount / (st.totalAnswered || 1)) * 100))}٪ دقة
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: LIVE ACTIVE ROOMS OVERSIGHT */}
        {/* ========================================================= */}
        {activeTab === 'liveRooms' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                  <span>المسابقات والغرف الحية قيد التشغيل</span>
                </h3>
                <button
                  onClick={loadData}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>تحديث</span>
                </button>
              </div>

              {liveRooms.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-bold">
                  لا توجد غرف نشطة حالياً. يمكن بدء مسابقة من الصفحة الرئيسية.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {liveRooms.map(rm => (
                    <div key={rm.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400 font-mono tracking-wider">
                          رمز: {rm.id}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rm.status === 'playing' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {rm.status === 'playing' ? 'جارية' : 'انتظار'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">{rm.title}</div>
                      <div className="text-[10px] text-slate-400">
                        الطلاب المشاركون: {toHindi(rm.studentCount || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit / Add Single Student Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-black text-white">
                  {editingStudent ? 'تعديل بيانات طالب' : 'إضافة طالب جديد'}
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">اسم الطالب الرباعي أو الثلاثي:</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="مثال: تركي فهد الدوسري"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">الصف:</label>
                    <select
                      value={formGradeId}
                      onChange={e => setFormGradeId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                    >
                      {SCHOOL_GRADES.map(g => (
                        <option key={g.id} value={g.id}>{g.shortName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">الشعبة:</label>
                    <select
                      value={formSection}
                      onChange={e => setFormSection(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                    >
                      {['أ', 'ب', 'ج', 'د'].map(sec => (
                        <option key={sec} value={sec}>شعبة {sec}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveStudent}
                  disabled={!formName.trim() || isSaving}
                  className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20"
                >
                  حفظ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TEST DETAILS INSPECTION MODAL */}
      <AnimatePresence>
        {inspectingTest && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">{inspectingTest.title}</h3>
                    <span className="text-[11px] text-slate-400 font-mono">{inspectingTest.dateFormatted}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportTestDatabaseToExcel([inspectingTest])}
                    className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold flex items-center gap-1 border border-emerald-500/30"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={() => setInspectingTest(null)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-950 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">الجداول المختبرة</span>
                  <span className="font-bold text-white">{inspectingTest.tables.map(t => toHindi(t)).join('، ')}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">متوسط الدقة</span>
                  <span className="font-bold text-emerald-400">{toHindi(inspectingTest.averageAccuracy)}٪</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">فارس الاختبار</span>
                  <span className="font-bold text-amber-400">{inspectingTest.topStudentName}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">المشاركون</span>
                  <span className="font-bold text-indigo-400">{toHindi(inspectingTest.totalParticipants)} طالب</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-950 rounded-2xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">الترتيب</th>
                      <th className="py-2 px-3">اسم الطالب</th>
                      <th className="py-2 px-3">الدرجة</th>
                      <th className="py-2 px-3">الإجابات الصحيحة</th>
                      <th className="py-2 px-3">نسبة الدقة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-bold">
                    {inspectingTest.participants.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 text-amber-400 font-mono">#{toHindi(p.rank)}</td>
                        <td className="py-2 px-3 text-white">{p.name}</td>
                        <td className="py-2 px-3 text-indigo-300 font-mono">{toHindi(p.score)}</td>
                        <td className="py-2 px-3 text-slate-300 font-mono">{toHindi(p.correctAnswers)} / {toHindi(p.totalAnswered)}</td>
                        <td className="py-2 px-3 text-emerald-400 font-mono">{toHindi(p.percentage)}٪</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setInspectingTest(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Branding */}
      <footer className="py-2.5 text-center border-t border-slate-900 bg-slate-950/80 text-[10px] text-slate-500 font-bold">
        مدارس رياض الإبداع • منصة التميز والحساب الذهني
      </footer>
    </div>
  );
};
