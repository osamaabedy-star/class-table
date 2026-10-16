-- ==============================================================================
-- مخطط قاعدة بيانات منصة مسابقات جدول الضرب والحساب الذهني (مدارس رياض الإبداع)
-- Riyadh Al-Ebdaa Schools - Multiplication & Mental Math Platform
-- PostgreSQL / Supabase Schema Definition - Phase 2
-- ==============================================================================

-- 1. تفعيل الامتدادات الضرورية (Extensions)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. جداول الصفوف والفصول الدراسية (Grades & Sections)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS grades (
    id VARCHAR(50) PRIMARY KEY, -- e.g. 'grade3', 'grade4', 'grade5', 'grade6'
    name VARCHAR(100) NOT NULL, -- e.g. 'الصف الثالث الابتدائي'
    short_name VARCHAR(50) NOT NULL, -- e.g. 'الثالث'
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- إدخال الصفوف الافتراضية المعتمدة في المدارس
INSERT INTO grades (id, name, short_name, display_order) VALUES
    ('grade3', 'الصف الثالث الابتدائي', 'الثالث', 3),
    ('grade4', 'الصف الرابع الابتدائي', 'الرابع', 4),
    ('grade5', 'الصف الخامس الابتدائي', 'الخامس', 5),
    ('grade6', 'الصف السادس الابتدائي', 'السادس', 6)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    short_name = EXCLUDED.short_name,
    display_order = EXCLUDED.display_order;

CREATE TABLE IF NOT EXISTS sections (
    id SERIAL PRIMARY KEY,
    grade_id VARCHAR(50) NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    name VARCHAR(20) NOT NULL, -- e.g. 'أ', 'ب', 'ج', 'د'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_grade_section UNIQUE(grade_id, name)
);

-- إدخال الشعب الافتراضية
INSERT INTO sections (grade_id, name) VALUES
    ('grade3', 'أ'), ('grade3', 'ب'), ('grade3', 'ج'), ('grade3', 'د'),
    ('grade4', 'أ'), ('grade4', 'ب'), ('grade4', 'ج'), ('grade4', 'د'),
    ('grade5', 'أ'), ('grade5', 'ب'), ('grade5', 'ج'), ('grade5', 'د'),
    ('grade6', 'أ'), ('grade6', 'ب'), ('grade6', 'ج'), ('grade6', 'د')
ON CONFLICT ON CONSTRAINT uq_grade_section DO NOTHING;

-- ==============================================================================
-- 3. جدول المعلمين والمشرفين (Teachers & Admins)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS teachers (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'teacher_' || substr(md5(random()::text), 1, 12),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'teacher', -- 'admin', 'teacher'
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- إنشاء حساب المسؤول الافتراضي إذا لم يكن موجوداً
INSERT INTO teachers (id, email, name, role) VALUES
    ('admin_default', 'osamaabedy@gmail.com', 'مشرف مدارس رياض الإبداع', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ==============================================================================
-- 4. جدول الطلاب الرئيسي (Students Roster & Honor Stats)
-- تم تصميمه لمنع تكرار الطلاب وتحديث إحصائياتهم التراكمية بأعلى أداء
-- ==============================================================================

CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(100) PRIMARY KEY, -- معرف فريد ثابت (مثل student-1792060995504-3oxu)
    name VARCHAR(150) NOT NULL,
    grade_id VARCHAR(50) NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
    grade_name VARCHAR(100) NOT NULL,
    section VARCHAR(20) NOT NULL DEFAULT 'أ',
    level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
    participation_count INT NOT NULL DEFAULT 0,
    total_score INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    total_answered INT NOT NULL DEFAULT 0,
    best_streak INT NOT NULL DEFAULT 0,
    last_active_date VARCHAR(50) DEFAULT 'لم يشارك',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- القيد الفريد الحاسم: يمنع تكرار الطالب بنفس الاسم داخل نفس الصف والشعبة عند استيراد الأسماء
    CONSTRAINT uq_student_identity UNIQUE (name, grade_id, section)
);

-- فهارس لتحسين سرعة الاستعلام ولوحات الشرف والتصفية
CREATE INDEX IF NOT EXISTS idx_students_grade_section ON students(grade_id, section);
CREATE INDEX IF NOT EXISTS idx_students_total_score ON students(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_students_participations ON students(participation_count DESC);
CREATE INDEX IF NOT EXISTS idx_students_correct_rate ON students((correct_count::float / NULLIF(total_answered, 0)) DESC NULLS LAST);

-- ==============================================================================
-- 5. جدول الجولات المسجلة (Recorded Game Rounds - Idempotency Registry)
-- هذا الجدول يضمن منع تكرار تسجيل نتائج أي جولة أكثر من مرة على مستوى قاعدة البيانات
-- ==============================================================================

CREATE TABLE IF NOT EXISTS recorded_game_rounds (
    round_id VARCHAR(120) PRIMARY KEY, -- معرف الجولة الفريد (مثل direct_1792061469285_bdkyh أو room_4ZF6_1791965845609)
    room_id VARCHAR(50),
    source VARCHAR(50) DEFAULT 'room', -- 'room', 'direct_test', 'duel'
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    participants_count INT DEFAULT 0,
    results_json JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_recorded_rounds_room ON recorded_game_rounds(room_id);
CREATE INDEX IF NOT EXISTS idx_recorded_rounds_date ON recorded_game_rounds(recorded_at DESC);

-- ==============================================================================
-- 6. جدول غرف المسابقات المباشرة (Online Live Rooms)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(20) PRIMARY KEY, -- رمز الغرفة المكون من 4 خانات (مثل 4ZF6)
    title VARCHAR(200) NOT NULL,
    room_type VARCHAR(50) NOT NULL DEFAULT 'duel', -- 'duel', 'group'
    status VARCHAR(50) NOT NULL DEFAULT 'lobby', -- 'lobby', 'playing', 'intermission', 'finished'
    host_token VARCHAR(100), -- رمز سري مخصص للمعلم المضيف (لا يُرسل للطلاب)
    config JSONB NOT NULL DEFAULT '{}'::jsonb, -- إعدادات الجداول والوقت ونوع العمليات
    questions JSONB NOT NULL DEFAULT '[]'::jsonb, -- مصفوفة الأسئلة
    students JSONB NOT NULL DEFAULT '{}'::jsonb, -- مصفوفة وبيانات الطلاب المشاركين
    current_question_index INT NOT NULL DEFAULT 0,
    question_started_at BIGINT DEFAULT 0,
    intermission_ends_at BIGINT DEFAULT 0,
    results_recorded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC);

-- ==============================================================================
-- 7. جدول المشاركين في الغرف (Room Participants)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS room_participants (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(20) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    student_name VARCHAR(150) NOT NULL,
    student_id VARCHAR(100) REFERENCES students(id) ON DELETE SET NULL,
    score INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    streak INT NOT NULL DEFAULT 0,
    current_index INT NOT NULL DEFAULT 0,
    last_active BIGINT DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- منع تكرار نفس الطالب داخل الغرفة الواحدة
    CONSTRAINT uq_room_participant UNIQUE (room_id, student_name)
);

CREATE INDEX IF NOT EXISTS idx_room_participants_lookup ON room_participants(room_id, student_name);

-- ==============================================================================
-- 8. جدول إجابات الطلاب على الأسئلة في الغرف (Room Student Answers)
-- يمنع تكرار الإجابة على نفس السؤال ويضمن دقة احتساب النقاط
-- ==============================================================================

CREATE TABLE IF NOT EXISTS room_student_answers (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(20) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    student_name VARCHAR(150) NOT NULL,
    question_index INT NOT NULL,
    selected_option INT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    time_spent NUMERIC(8,2) DEFAULT 0,
    points_earned INT NOT NULL DEFAULT 0,
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- قيد يمنع الطالب من تسجيل أكثر من إجابة على نفس السؤال
    CONSTRAINT uq_room_student_question UNIQUE (room_id, student_name, question_index)
);

CREATE INDEX IF NOT EXISTS idx_student_answers_query ON room_student_answers(room_id, student_name);

-- ==============================================================================
-- 9. جدول سجل جلسات الاختبارات الشاملة (Test Sessions Database)
-- أرشيف الجلسات والاختبارات الصفية للتحليل الإحصائي وتصدير إكسل
-- ==============================================================================

CREATE TABLE IF NOT EXISTS test_sessions (
    id VARCHAR(120) PRIMARY KEY, -- معرف الجلسة الفريد
    title VARCHAR(255) NOT NULL,
    grade_id VARCHAR(50) NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
    grade_name VARCHAR(100) NOT NULL,
    section VARCHAR(50) NOT NULL,
    tables JSONB NOT NULL DEFAULT '[]'::jsonb,
    op_mode VARCHAR(20) NOT NULL DEFAULT 'multi',
    time_limit INT NOT NULL DEFAULT 10,
    rounds_per_student INT NOT NULL DEFAULT 2,
    competition_type VARCHAR(50) NOT NULL DEFAULT 'points',
    total_participants INT NOT NULL DEFAULT 0,
    average_accuracy NUMERIC(5,2) DEFAULT 0,
    top_student_name VARCHAR(150),
    top_student_score INT DEFAULT 0,
    date_formatted VARCHAR(100),
    created_at BIGINT NOT NULL,
    created_at_dt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_sessions_grade ON test_sessions(grade_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_created ON test_sessions(created_at DESC);

-- ==============================================================================
-- 10. جدول المشاركين في جلسات الاختبار (Test Session Participants)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS test_session_participants (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(120) NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
    student_id VARCHAR(100) REFERENCES students(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    correct_answers INT NOT NULL DEFAULT 0,
    total_answered INT NOT NULL DEFAULT 0,
    percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    rank INT NOT NULL DEFAULT 0,
    eliminated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- منع تكرار اسم المشارك داخل جلسة الاختبار الواحدة
    CONSTRAINT uq_session_participant UNIQUE (session_id, name)
);

CREATE INDEX IF NOT EXISTS idx_session_participants_session ON test_session_participants(session_id);

-- ==============================================================================
-- 11. أمان قاعدة البيانات وتفعيل سياسات Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE recorded_game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_session_participants ENABLE ROW LEVEL SECURITY;

-- السماح بالقراءة العامة لبيانات الصفوف والشعب
CREATE POLICY "Public read grades" ON grades FOR SELECT USING (true);
CREATE POLICY "Public read sections" ON sections FOR SELECT USING (true);

-- سياسات الطلاب: القراءة العامة للوحات الصدارة وشاشات التكريم، والتعديل حصراً للخادم الموثوق (service_role)
CREATE POLICY "Public read students" ON students FOR SELECT USING (true);
CREATE POLICY "Service role manages students" ON students USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- سياسات الغرف: القراءة العامة لمعلومات الغرفة العامة (مع استبعاد host_token عبر الواجهة)، والتحكم للخادم
CREATE POLICY "Public read rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Service role manages rooms" ON rooms USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read room participants" ON room_participants FOR SELECT USING (true);
CREATE POLICY "Service role manages room participants" ON room_participants USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read room answers" ON room_student_answers FOR SELECT USING (true);
CREATE POLICY "Service role manages room answers" ON room_student_answers USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- سياسات الاختبارات والجولات
CREATE POLICY "Public read test sessions" ON test_sessions FOR SELECT USING (true);
CREATE POLICY "Service role manages test sessions" ON test_sessions USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public read test participants" ON test_session_participants FOR SELECT USING (true);
CREATE POLICY "Service role manages test participants" ON test_session_participants USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages recorded rounds" ON recorded_game_rounds USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ==============================================================================
-- 12. دوال مفيدة لمعالجة البيانات والتحديث التلقائي (Database Functions & Triggers)
-- ==============================================================================

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_rooms_updated_at ON rooms;
CREATE TRIGGER trg_rooms_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
