-- ============================================================
-- UPS Regis DB v2 : schema ใหม่ทั้งหมด (รันใน Supabase SQL Editor)
-- Project ใหม่ที่ว่างเปล่า -> รันไฟล์นี้ก่อน แล้วตามด้วย 0002_seed_demo.sql
-- Idempotent: รันซ้ำได้ (IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- เปลี่ยนจาก v1:
--  1. student.password_hash + admin.password_hash (bcrypt via pgcrypto)
--  2. course.credits SMALLINT (เดิม String) -> frontend parseFloat รองรับอยู่
--  3. class_section.section_type CHAR(1) คอลัมน์จริง (เดิม parse จาก room)
--     room ยังเก็บ "(ท)/(ป)" ไว้เพื่อ backward compat กับโค้ดเก่า
--  4. enrollment_cart/enrollment.section_number INT (เดิม String/ปนกัน)
--     API ยังส่ง String ได้ -> SQLAlchemy coerce ให้, extract_section_int() ยังใช้ได้
--  5. enrollment UNIQUE(student_id, course_id, section_type) กันลงซ้ำระดับ DB
--  6. FK เติม ON DELETE CASCADE (cart/enrollment/member/grade/waitlist)
--  7. index ครบ + waitlist pending index
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE waitliststatus AS ENUM ('PENDING', 'ALLOCATED', 'CONFIRMED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------- student ----------------
CREATE TABLE IF NOT EXISTS student (
  student_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100),
  faculty VARCHAR(100),
  major VARCHAR(100),
  email VARCHAR(100),
  phone_number VARCHAR(20),
  curriculum_year VARCHAR(4),
  study_plan VARCHAR(50),
  avatar_url VARCHAR(255),
  current_year INTEGER,
  current_semester INTEGER DEFAULT 1,
  password_hash TEXT,
  expo_push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- เผื่อรันบน DB ที่มีตารางเก่าอยู่แล้ว: เติมคอลัมน์ที่ขาด
ALTER TABLE student ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE student ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
ALTER TABLE student ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE student ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ---------------- admin ----------------
CREATE TABLE IF NOT EXISTS admin (
  admin_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  avatar_url VARCHAR(255),
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE admin ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- ---------------- instructor ----------------
CREATE TABLE IF NOT EXISTS instructor (
  instructor_id VARCHAR(50) PRIMARY KEY,
  instructor_name VARCHAR(100)
);

-- ---------------- course ----------------
CREATE TABLE IF NOT EXISTS course (
  course_id VARCHAR(20) PRIMARY KEY,
  course_name VARCHAR(150),
  credits SMALLINT NOT NULL DEFAULT 3
);

-- ---------------- curriculum_course ----------------
CREATE TABLE IF NOT EXISTS curriculum_course (
  curriculum_id SERIAL PRIMARY KEY,
  course_id VARCHAR(20) NOT NULL REFERENCES course(course_id) ON DELETE RESTRICT,
  faculty VARCHAR(100),
  major VARCHAR(100),
  curriculum_year VARCHAR(4),
  course_group VARCHAR(100),
  suggested_year INTEGER,
  suggested_semester INTEGER,
  secondcourse_group VARCHAR(20)
);
CREATE INDEX IF NOT EXISTS ix_curriculum_filter
  ON curriculum_course (faculty, major, curriculum_year, suggested_year);

-- ---------------- class_section ----------------
CREATE TABLE IF NOT EXISTS class_section (
  section_id SERIAL PRIMARY KEY,
  course_id VARCHAR(20) NOT NULL REFERENCES course(course_id) ON DELETE RESTRICT,
  semester VARCHAR(20) DEFAULT '1/68',
  section_number INTEGER NOT NULL,
  section_type CHAR(1) NOT NULL DEFAULT 'T' CHECK (section_type IN ('T', 'L')),
  instructor_id VARCHAR(50) REFERENCES instructor(instructor_id) ON DELETE SET NULL,
  day_of_week VARCHAR(15),
  start_time TIME,
  end_time TIME,
  room VARCHAR(50),
  max_seats INTEGER DEFAULT 40,
  enrolled_seats INTEGER DEFAULT 0
);
ALTER TABLE class_section ADD COLUMN IF NOT EXISTS section_type CHAR(1) DEFAULT 'T';
CREATE INDEX IF NOT EXISTS ix_section_course ON class_section (course_id, section_number);

-- ---------------- enrollment_cart ----------------
CREATE TABLE IF NOT EXISTS enrollment_cart (
  cart_id SERIAL PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  course_id VARCHAR(20) NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  section_type VARCHAR(10) DEFAULT 'T'
);
CREATE INDEX IF NOT EXISTS ix_cart_student ON enrollment_cart (student_id);

-- ---------------- enrollment ----------------
CREATE TABLE IF NOT EXISTS enrollment (
  enroll_id SERIAL PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  course_id VARCHAR(20) NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  section_type VARCHAR(10) DEFAULT 'T',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_enrollment_student_course_type UNIQUE (student_id, course_id, section_type)
);
CREATE INDEX IF NOT EXISTS ix_enrollment_student ON enrollment (student_id);

-- ---------------- study_group ----------------
CREATE TABLE IF NOT EXISTS study_group (
  group_id SERIAL PRIMARY KEY,
  group_code VARCHAR(10) UNIQUE,
  leader_id VARCHAR(20) REFERENCES student(student_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  is_registered BOOLEAN DEFAULT FALSE,
  last_action VARCHAR(100)
);

-- ---------------- group_member ----------------
CREATE TABLE IF NOT EXISTS group_member (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES study_group(group_id) ON DELETE CASCADE,
  student_id VARCHAR(20) UNIQUE REFERENCES student(student_id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'PENDING',
  joined_at TIMESTAMPTZ DEFAULT now(),
  is_ready BOOLEAN DEFAULT FALSE,
  last_notified_action VARCHAR(100),
  has_seen_registered_alert BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ix_group_member_group ON group_member (group_id);

-- ---------------- grade_record ----------------
CREATE TABLE IF NOT EXISTS grade_record (
  record_id SERIAL PRIMARY KEY,
  student_id VARCHAR(20) REFERENCES student(student_id) ON DELETE CASCADE,
  course_id VARCHAR(20),
  grade VARCHAR(5),
  semester VARCHAR(10)
);
CREATE INDEX IF NOT EXISTS ix_grade_student ON grade_record (student_id);

-- ---------------- waitlist ----------------
CREATE TABLE IF NOT EXISTS waitlist (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  course_id VARCHAR(20) NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  section_type VARCHAR(10),
  status waitliststatus NOT NULL DEFAULT 'PENDING',
  queue_position INTEGER NOT NULL,
  allocated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_waitlist_student ON waitlist (student_id);
CREATE INDEX IF NOT EXISTS ix_waitlist_course_sec ON waitlist (course_id, section_number);
CREATE INDEX IF NOT EXISTS ix_waitlist_pending
  ON waitlist (course_id, section_number, section_type) WHERE status = 'PENDING';

-- ---------------- system_config ----------------
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(50) PRIMARY KEY,
  value VARCHAR(255)
);
INSERT INTO system_config (key, value) VALUES
  ('registration_open', 'true'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- ---------------- system_log ----------------
CREATE TABLE IF NOT EXISTS system_log (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(20),
  action VARCHAR(255),
  details VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_system_log_admin ON system_log (admin_id);
