import datetime
import enum
import os
from sqlalchemy import Column, Integer, String, Time, ForeignKey, create_engine, Index , DateTime , Boolean, Enum, SmallInteger, CHAR, UniqueConstraint
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

# v2: อ่านจาก env เท่านั้น ห้าม hardcode secret (ดู .env.example)
# รองรับชื่อเก่า OLD_DATABASE_URL ด้วยตอน migrate
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("OLD_DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("ตั้ง env DATABASE_URL ก่อน (ดู backend/.env.example)")
engine = create_engine(
    DATABASE_URL,
    pool_size=10,          # จำนวน connection สูงสุดใน pool
    max_overflow=20,       # connection เพิ่มเติมได้อีก 20
    pool_pre_ping=True,    # เช็ก connection ก่อนใช้ (ป้องกัน stale connection)
    pool_recycle=300       # 🌟 ล้างท่อใหม่ทุกๆ 5 นาที
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ---------------- ตารางนักศึกษา ----------------
class Student(Base):
    __tablename__ = 'student'

    student_id = Column(String(20), primary_key=True)
    name = Column(String(100))
    faculty = Column(String(100))
    major = Column(String(100))
    email = Column(String(100))
    phone_number = Column(String(20))
    curriculum_year = Column(String(4))
    study_plan = Column(String(50))
    avatar_url = Column(String(255))
    current_year = Column(Integer)
    current_semester = Column(Integer,default=1)
    password_hash = Column(String(255), nullable=True)  # v2: bcrypt hash, seed = '123456'
    expo_push_token = Column(String, nullable=True) # 🌟 เพิ่มตรงนี้
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Admin(Base):
    __tablename__ = 'admin'
    admin_id = Column(String(20), primary_key=True)
    name = Column(String(100))
    email = Column(String(100))
    avatar_url = Column(String(255))
    password_hash = Column(String(255), nullable=True)  # v2
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Instructor(Base):
    __tablename__ = 'instructor'
    
    # สมมติว่า Primary Key ของตารางนี้คือ instructor_id
    instructor_id = Column(String(50), primary_key=True) 
    instructor_name = Column(String(100))  




# ---------------- ตารางวิชาเรียน ----------------
class Course(Base):
    __tablename__ = 'course'

    course_id = Column(String(20), primary_key=True)
    course_name = Column(String(150))
    credits = Column(SmallInteger, default=3)  # v2: INT (เดิม String) frontend parseFloat รองรับ

# ---------------- ตารางโครงสร้างหลักสูตร ----------------
class CurriculumCourse(Base):
    __tablename__ = 'curriculum_course'

    curriculum_id = Column(Integer, primary_key=True, autoincrement=True)  # แก้เป็น curriculum_id  ,  id
    course_id = Column(String(20), ForeignKey('course.course_id'), nullable=False)
    faculty = Column(String(100))
    major = Column(String(100))
    curriculum_year = Column(String(4))
    course_group = Column(String(100))
    suggested_year = Column(Integer)
    suggested_semester = Column(Integer)
    secondcourse_group = Column(String(20))

    # ✅ Index เพื่อให้ query /courses/available เร็วขึ้น
    __table_args__ = (
        Index('ix_curriculum_filter', 'faculty', 'major', 'curriculum_year', 'suggested_year'),
    )

# ---------------- ตารางกลุ่มเรียน (Section) ----------------
class ClassSection(Base):
    __tablename__ = 'class_section'

    section_id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(String(20), ForeignKey('course.course_id'), nullable=False)
    semester = Column(String(20), default='1/68')
    section_number = Column(Integer)
    section_type = Column(CHAR(1), default='T')  # v2: คอลัมน์จริง 'T'/'L' (เดิม parse จาก room)
    instructor_id = Column(String(50), ForeignKey('instructor.instructor_id'))
    instructor = relationship("Instructor")
    day_of_week = Column(String(15))
    start_time = Column(Time)
    end_time = Column(Time)
    room = Column(String(50))  # เก็บ "(ท)/(ป)" ไว้เพื่อ compat โค้ดเก่า
    max_seats = Column(Integer, default=40)
    enrolled_seats = Column(Integer, default=0)
    

    # ✅ Index เพื่อให้ query /sections/{course_code} เร็วขึ้น
    __table_args__ = (
        Index('ix_section_course', 'course_id', 'section_number'),
    )

# ---------------- ตารางตะกร้าเรียน ----------------
class EnrollmentCart(Base):
    __tablename__ = 'enrollment_cart'

    cart_id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(20), ForeignKey('student.student_id', ondelete="CASCADE"), nullable=False)
    course_id = Column(String(20), ForeignKey('course.course_id', ondelete="CASCADE"), nullable=False)
    section_number = Column(Integer)  # v2: INT (เดิม String) API ส่ง String ได้ SQLAlchemy coerce ให้
    section_type = Column(String(10), default='T')

    # ✅ Index ให้ query ตะกร้าเร็วขึ้น
    __table_args__ = (
        Index('ix_cart_student', 'student_id'),
    )

# ---------------- ตารางลงทะเบียนจริง ----------------
class Enrollment(Base):
    __tablename__ = 'enrollment'

    enroll_id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(20), ForeignKey('student.student_id', ondelete="CASCADE"), nullable=False)
    course_id = Column(String(20), ForeignKey('course.course_id', ondelete="CASCADE"), nullable=False)

    section_number = Column(Integer)  # v2: INT
    section_type = Column(String(10), default='T')
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    # ✅ กันลงซ้ำระดับ DB + index ดึงตารางเรียนเร็ว
    __table_args__ = (
        Index('ix_enrollment_student', 'student_id'),
        UniqueConstraint('student_id', 'course_id', 'section_type', name='uq_enrollment_student_course_type'),
    )


class StudyGroup(Base):
    __tablename__ = 'study_group'
    group_id = Column(Integer, primary_key=True, autoincrement=True)
    group_code = Column(String(10), unique=True, index=True) # รหัส 6 หลักให้เพื่อนกรอก
    leader_id = Column(String(20), ForeignKey('student.student_id', ondelete="CASCADE")) # หัวหน้ากลุ่ม
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_synced_at = Column(DateTime, nullable=True)
    is_registered = Column(Boolean, default=False)
    last_action = Column(String(100), nullable=True)

class GroupMember(Base):
    __tablename__ = 'group_member'
    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey('study_group.group_id', ondelete="CASCADE"))
    student_id = Column(String(20), ForeignKey('student.student_id', ondelete="CASCADE"), unique=True) # 1 คน 1 กลุ่ม
    status = Column(String(20), default="PENDING") # 🌟 สถานะ: PENDING, APPROVED
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_ready = Column(Boolean, default=False)
    last_notified_action = Column(String(100), nullable=True)
    has_seen_registered_alert = Column(Boolean, default=False)


class GradeRecord(Base):
    __tablename__ = 'grade_record'
    
    record_id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(20), ForeignKey('student.student_id', ondelete="CASCADE"))
    course_id = Column(String(20))
    grade = Column(String(5))
    semester = Column(String(10))

# ---------------- ตาราง Waitlist (ลำดับรอลงทะเบียน) ----------------
class WaitlistStatus(enum.Enum):
    PENDING = "PENDING"      # กำลังรอคิว
    ALLOCATED = "ALLOCATED"  # ได้สิทธิ์ลงทะเบียนแล้ว (รอการยืนยัน)
    CONFIRMED = "CONFIRMED"  # ยืนยันการลงทะเบียนสำเร็จ
    EXPIRED = "EXPIRED"      # หมดเวลาสิทธิ์การลงทะเบียน

class Waitlist(Base):
    __tablename__ = 'waitlist'

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(20), ForeignKey('student.student_id', ondelete="CASCADE"), nullable=False)
    course_id = Column(String(20), ForeignKey('course.course_id', ondelete="CASCADE"), nullable=False)
    section_number = Column(Integer, nullable=False)
    section_type = Column(String(10))  # 'T' หรือ 'L'
    status = Column(Enum(WaitlistStatus), default=WaitlistStatus.PENDING, nullable=False)
    queue_position = Column(Integer, nullable=False)
    allocated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # ความสัมพันธ์
    student = relationship("Student")
    course = relationship("Course")

    __table_args__ = (
        Index('ix_waitlist_student', 'student_id'),
        Index('ix_waitlist_course_sec', 'course_id', 'section_number'),
    )

# ---------------- ตารางการตั้งค่าระบบ ----------------
class SystemConfig(Base):
    __tablename__ = 'system_config'
    key = Column(String(50), primary_key=True)
    value = Column(String(255))

class SystemLog(Base):
    __tablename__ = 'system_log'
    id = Column(Integer, primary_key=True, autoincrement=True)
    admin_id = Column(String(20))
    action = Column(String(255))
    details = Column(String(500))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
