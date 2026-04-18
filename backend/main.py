import random
import datetime
import string
import re
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, func
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from itertools import product

# Import models and database configuration
from database import (
    SessionLocal, Student, Course, ClassSection, EnrollmentCart, Enrollment, 
    CurriculumCourse, StudyGroup, GroupMember, GradeRecord, Waitlist, 
    WaitlistStatus, SystemConfig, engine, Base, Admin, SystemLog, Instructor
)
from notifications import send_push_message

app = FastAPI()

# ---------------- Constants ----------------
CURRENT_YEAR_CODE = 68

DAY_ORDER = {
    "Mon": 1, "Monday": 1, "จันทร์": 1,
    "Tue": 2, "Tuesday": 2, "อังคาร": 2,
    "Wed": 3, "Wednesday": 3, "พุธ": 3,
    "Thu": 4, "Thursday": 4, "พฤหัส": 4, "พฤหัสบดี": 4,
    "Fri": 5, "Friday": 5, "ศุกร์": 5,
    "Sat": 6, "Saturday": 6, "เสาร์": 6,
    "Sun": 7, "Sunday": 7, "อาทิตย์": 7,
    "Online": 8, "ออนไลน์": 8,
}

# ---------------- Middleware ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Dependency ----------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------- Helper Functions ----------------
def is_regis_open(db: Session):
    config = db.query(SystemConfig).filter(SystemConfig.key == "registration_open").first()
    if not config:
        new_config = SystemConfig(key="registration_open", value="true")
        db.add(new_config)
        db.commit()
        return True
    return config.value == "true"

def calculate_student_year(student_id: str) -> int:
    try:
        entry_year = int(student_id[:2])
        student_year = (CURRENT_YEAR_CODE - entry_year) + 1
        return max(student_year, 1)
    except Exception:
        return 1

def get_section_type_from_room(room: str) -> str:
    room_str = str(room or "")
    if "(ท)" in room_str:
        return "T"
    elif "(ป)" in room_str:
        return "L"
    return "T"

def is_conflict(plan: list) -> bool:
    used_times = []
    for sec in plan:
        day = sec.day_of_week
        if not day or day in ["Online", "N", "", "ออนไลน์"]:
            continue
        if not sec.start_time or not sec.end_time:
            continue
        start = sec.start_time.hour + (sec.start_time.minute / 60.0)
        end = sec.end_time.hour + (sec.end_time.minute / 60.0)
        for used_day, used_start, used_end in used_times:
            if day == used_day and max(start, used_start) < min(end, used_end):
                return True
        used_times.append((day, start, end))
    return False

def format_plan(plan: list) -> list:
    formatted = []
    for s in plan:
        raw_day = s.day_of_week.strip() if s.day_of_week else "Mon"
        start_float = s.start_time.hour + (s.start_time.minute / 60.0) if s.start_time else 0
        end_float = s.end_time.hour + (s.end_time.minute / 60.0) if s.end_time else 0
        sec_type = get_section_type_from_room(s.room or "")
        formatted.append({
            "course_code": s.course_id,
            "section_number": str(s.section_number),
            "section_type": sec_type,
            "instructor": s.instructor_id,
            "instructor_name": s.instructor.instructor_name if s.instructor else "ไม่ระบุ", 
            "enrolled_seats": s.enrolled_seats,
            "max_seats": s.max_seats,
            "class_times": [{"day": raw_day, "start": start_float, "end": end_float}],
            "_sort_day": DAY_ORDER.get(raw_day, 9),
            "_sort_time": start_float,
        })
    formatted.sort(key=lambda x: (x["_sort_day"], x["_sort_time"]))
    for item in formatted:
        del item["_sort_day"]
        del item["_sort_time"]
    return formatted

def extract_section_int(section_number_str: str):
    if section_number_str is None: return None
    match = re.search(r'\d+', str(section_number_str))
    return int(match.group()) if match else None

def generate_random_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def find_conflict_details(plan_secs, current_secs):
    all_secs = plan_secs + current_secs
    for i in range(len(all_secs)):
        for j in range(i + 1, len(all_secs)):
            s1 = all_secs[i]
            s2 = all_secs[j]
            if s1.course_id == s2.course_id and getattr(s1, 'section_number', '') == getattr(s2, 'section_number', ''):
                continue
            if s1.day_of_week and s2.day_of_week and s1.day_of_week == s2.day_of_week:
                if s1.start_time and s1.end_time and s2.start_time and s2.end_time:
                    def get_mins(t):
                        if hasattr(t, 'hour'): return t.hour * 60 + t.minute
                        h, m = map(int, str(t).split(':')[:2])
                        return h * 60 + m
                    start1, end1 = get_mins(s1.start_time), get_mins(s1.end_time)
                    start2, end2 = get_mins(s2.start_time), get_mins(s2.end_time)
                    if start1 < end2 and start2 < end1:
                        fmt_t1 = f"{str(s1.start_time)[:5]}-{str(s1.end_time)[:5]}"
                        fmt_t2 = f"{str(s2.start_time)[:5]}-{str(s2.end_time)[:5]}"
                        type1 = "(ในตาราง)" if s1 in current_secs else "(วิชาเป้าหมาย)"
                        type2 = "(ในตาราง)" if s2 in current_secs else "(วิชาเป้าหมาย)"
                        return f"วิชา {s1.course_id} {type1} ชนกับ {s2.course_id} {type2}\nวัน{s1.day_of_week} เวลา {fmt_t1} ทับกับ {fmt_t2}"
    return None

def check_conflict_with_all(new_slots, student_id, db: Session):
    enrolled = db.query(Enrollment).filter(Enrollment.student_id == student_id).all()
    for e in enrolled:
        e_secs = db.query(ClassSection).filter(
            ClassSection.course_id == e.course_id, 
            ClassSection.section_number == extract_section_int(e.section_number)
        ).all()
        e_slots = [s for s in e_secs if get_section_type_from_room(s.room or "") == (e.section_type or "T")]
        if is_conflict(new_slots + e_slots):
            return f"{e.course_id} ในตารางเรียน"
    cart = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == student_id).all()
    for c in cart:
        c_secs = db.query(ClassSection).filter(
            ClassSection.course_id == c.course_id, 
            ClassSection.section_number == extract_section_int(c.section_number)
        ).all()
        c_slots = [s for s in c_secs if get_section_type_from_room(s.room or "") == (c.section_type or "T")]
        if is_conflict(new_slots + c_slots):
            return f"{c.course_id} ในตะกร้าเรียน"
    return None

# ---------------- Pydantic Models ----------------
class LoginRequest(BaseModel):
    student_id: str
    password: str

class CartRequest(BaseModel):
    student_id: str
    course_code: str
    section_number: str
    section_type: Optional[str] = None

class RemoveCartRequest(BaseModel):
    student_id: str
    course_code: str
    section_type: Optional[str] = None

class BatchItem(BaseModel):
    course_code: str
    section_number: str
    section_type: str

class BatchCartRequest(BaseModel):
    student_id: str
    items: List[BatchItem]

class WaitlistJoinRequest(BaseModel):
    student_id: str
    course_code: str
    section_number: int
    section_type: str

class PushTokenUpdate(BaseModel):
    push_token: str

# ---------------- Endpoints ----------------

# ================= 1. Login =================
@app.post("/login")
def login(request: dict, db: Session = Depends(get_db)):
    req_student_id = request.get("student_id")
    
    # 1. เช็คในตาราง Admin ก่อน
    admin = db.query(Admin).filter(Admin.admin_id == req_student_id).first()
    if admin:
        return {
            "student_id": admin.admin_id,
            "first_name": admin.name,
            "email": admin.email,
            "avatar_url": admin.avatar_url,
            "role": "ADMIN"
        }
    
    # 2. ถ้าไม่ใช่ Admin ให้เช็คในตาราง Student
    # ก่อนเข้า Student ให้เช็ค Maintenance Mode
    maintenance = db.query(SystemConfig).filter(SystemConfig.key == "maintenance_mode").first()
    if maintenance and maintenance.value == "true":
        raise HTTPException(status_code=403, detail="ระบบปิดปรับปรุงชั่วคราว กรุณาลองใหม่ในภายหลัง")

    student = db.query(Student).filter(Student.student_id == req_student_id).first()
    if student:
        return {
            "student_id": student.student_id,
            "first_name": student.name,
            "major": student.major,
            "email": student.email,
            "phone_number": student.phone_number,
            "year": student.curriculum_year,
            "faculty": student.faculty,
            "avatar_url": student.avatar_url,
            "current_year": student.current_year,
            "current_semester": student.current_semester or 1,
            "role": "STUDENT"
        }
    
    raise HTTPException(status_code=401, detail="ไม่พบรหัสผู้ใช้งานนี้ในระบบ")

# ================= 2. Courses =================
@app.get("/courses/available/{student_id}")
def get_available_courses(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลนักศึกษา")
    current_year = student.current_year or calculate_student_year(student_id)
    current_sem = student.current_semester or 1
    results = (
        db.query(Course, CurriculumCourse)
        .join(CurriculumCourse, Course.course_id == CurriculumCourse.course_id)
        .filter(
            CurriculumCourse.faculty == student.faculty,
            CurriculumCourse.major == student.major,
            CurriculumCourse.curriculum_year == student.curriculum_year,
            CurriculumCourse.suggested_year == current_year,
            CurriculumCourse.suggested_semester == current_sem,
        )
        .all()
    )
    return [
        {
            "course_code": course.course_id,
            "course_name": course.course_name,
            "credits": course.credits,
            "faculty": curriculum.faculty,
            "major": curriculum.major,
            "course_group": curriculum.course_group,
            "suggested_year": curriculum.suggested_year,
            "suggested_semester": curriculum.suggested_semester,
            "is_required": curriculum.course_group in ["วิชาบังคับ", "บังคับ", "required"],
        }
        for course, curriculum in results
    ]

@app.get("/courses/suggested/{student_id}")
def get_suggested_courses(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student: raise HTTPException(status_code=404, detail="ไม่พบข้อมูลนักศึกษา")
    student_year = calculate_student_year(student_id)
    current_sem = student.current_semester or 1
    suggested_courses = (
        db.query(CurriculumCourse, Course)
        .join(Course, CurriculumCourse.course_id == Course.course_id)
        .filter(
            CurriculumCourse.faculty == student.faculty,
            CurriculumCourse.major == student.major,
            CurriculumCourse.curriculum_year == student.curriculum_year,
            CurriculumCourse.suggested_year == student_year,
            CurriculumCourse.suggested_semester == current_sem
        ).all()
    )
    major_prefix_map = {
        "วิศวกรรมคอมพิวเตอร์": "CPE",
        "เทคโนโลยีสารสนเทศและการสื่อสาร": "ICT",
        "การจัดการโลจิสติกส์และโซ่อุปทาน": "LSM"
    }
    target_prefix = major_prefix_map.get(student.major)
    result = []
    for curr_course, course in suggested_courses:
        course_code = course.course_id
        if target_prefix and not course_code.upper().startswith(target_prefix):
            continue
        result.append({
            "course_code": course_code,
            "course_name": course.course_name or 'Unknown',
            "credits": course.credits,
            "suggested_year": curr_course.suggested_year,
            "suggested_semester": curr_course.suggested_semester
        })
    return result

@app.get("/z-options/{student_id}/{z_course_code}")
def get_z_course_options(student_id: str, z_course_code: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    z_curr = db.query(CurriculumCourse).filter(
        CurriculumCourse.course_id == z_course_code,
        CurriculumCourse.major == student.major
    ).first()
    z_course = db.query(Course).filter(Course.course_id == z_course_code).first()
    if not z_course: raise HTTPException(status_code=404, detail="ไม่พบรหัสวิชา Z ในระบบ")
    target_credits = z_course.credits
    target_group = z_curr.secondcourse_group if z_curr else None
    query = db.query(Course).join(CurriculumCourse, Course.course_id == CurriculumCourse.course_id)
    query = query.filter(~Course.course_id.startswith('Z'))
    if target_credits: query = query.filter(Course.credits == target_credits)
    if target_group:
        if target_group == "เสรี":
            query = query.filter(CurriculumCourse.secondcourse_group == "เสรี")
        else:
            query = query.filter(
                CurriculumCourse.secondcourse_group == target_group,
                CurriculumCourse.faculty == student.faculty,
                CurriculumCourse.major == student.major
            )
    eligible_courses = query.distinct().all()
    result = []
    for course in eligible_courses:
        sections = db.query(ClassSection).filter(ClassSection.course_id == course.course_id).all()
        if not sections: continue
        sec_list = []
        for sec in sections:
            sec_list.append({
                "section_number": str(sec.section_number),
                "type": get_section_type_from_room(sec.room),
                "day_of_week": sec.day_of_week,
                "start_time": str(sec.start_time) if sec.start_time else "",
                "end_time": str(sec.end_time) if sec.end_time else "",
                "room": sec.room or "ไม่ระบุ",
                "instructor": sec.instructor.instructor_name if sec.instructor else "ไม่ระบุ",
                "max_seats": sec.max_seats or 0,
                "enrolled_seats": sec.enrolled_seats or 0
            })
        result.append({
            "course_code": course.course_id,
            "course_name": course.course_name,
            "credits": course.credits,
            "sections": sec_list
        })
    return result

# ================= 3. AI Scheduler =================
@app.post("/ai-suggest")
def ai_suggest(data: dict, db: Session = Depends(get_db)):
    student_id = data.get("student_id")
    course_codes = list(set(data.get("course_codes", [])))
    if not student_id: raise HTTPException(status_code=400, detail="ต้องระบุ student_id")
    MAX_AI_COURSES, MAX_AI_PLANS = 10, 10
    if len(course_codes) > MAX_AI_COURSES:
        raise HTTPException(status_code=400, detail=f"เลือกได้สูงสุด {MAX_AI_COURSES} วิชาต่อครั้ง")
    current_enrollments = db.query(Enrollment).filter(Enrollment.student_id == student_id).all()
    current_slots = []
    for en in current_enrollments:
        secs = db.query(ClassSection).filter(
            ClassSection.course_id == en.course_id,
            ClassSection.section_number == extract_section_int(en.section_number)
        ).all()
        for s in secs:
            if get_section_type_from_room(s.room or "") == (en.section_type or "T"):
                current_slots.append(s)
    all_course_options = []
    for code in course_codes:
        secs = db.query(ClassSection).filter(ClassSection.course_id == code).all()
        if not secs: continue
        groups = {}
        for s in secs:
            stype = get_section_type_from_room(s.room)
            key = (s.section_number, stype)
            if key not in groups: groups[key] = []
            groups[key].append(s)
        theory_options = [rows for (snum, stype), rows in groups.items() if stype == "T"]
        practice_options = [rows for (snum, stype), rows in groups.items() if stype == "L"]
        course_options = []
        if theory_options and practice_options:
            for t_grp, p_grp in product(theory_options, practice_options):
                course_options.append(t_grp + p_grp)
        elif theory_options: course_options = theory_options
        elif practice_options: course_options = practice_options
        if course_options: all_course_options.append(course_options)
    if not all_course_options: raise HTTPException(status_code=400, detail="ไม่พบกลุ่มเรียนสำหรับวิชาที่เลือก")
    valid_plans, conflict_reason = [], "ไม่สามารถจัดตารางได้ เนื่องจากเวลาเรียนชนกัน"
    for plan_combinations in product(*all_course_options):
        flat_plan = [sec for item in plan_combinations for sec in item]
        if not is_conflict(flat_plan + current_slots):
            valid_plans.append(format_plan(flat_plan))
        elif not valid_plans:
            detail = find_conflict_details(flat_plan, current_slots)
            if detail: conflict_reason = detail
        if len(valid_plans) >= MAX_AI_PLANS: break
    if not valid_plans: raise HTTPException(status_code=400, detail=conflict_reason)
    return valid_plans

# ================= 4. Cart =================
@app.post("/cart/add")
def add_to_cart(request: CartRequest, db: Session = Depends(get_db)):
    if not is_regis_open(db):
        raise HTTPException(status_code=400, detail="ขณะนี้ระบบปิดรับการลงทะเบียนชั่วคราว")
    sec_num_str = request.section_number
    sec_int = extract_section_int(sec_num_str)
    section_type = request.section_type
    if not section_type and sec_int is not None:
        sec_row = db.query(ClassSection).filter(
            ClassSection.course_id == request.course_code,
            ClassSection.section_number == sec_int,
        ).first()
        if sec_row: section_type = get_section_type_from_room(sec_row.room or "")
    if not section_type: section_type = "T"
    already_enrolled = db.query(Enrollment).filter(
        Enrollment.student_id == request.student_id,
        Enrollment.course_id == request.course_code,
        Enrollment.section_type == section_type,
    ).first()
    if already_enrolled:
        type_label = "ทฤษฎี (T)" if section_type == "T" else "ปฏิบัติ (L)"
        raise HTTPException(status_code=400, detail=f"คุณได้ลงทะเบียน {type_label} ของวิชานี้ไปแล้ว")
    existing_in_cart = db.query(EnrollmentCart).filter(
        EnrollmentCart.student_id == request.student_id,
        EnrollmentCart.course_id == request.course_code,
        EnrollmentCart.section_type == section_type,
    ).first()
    if existing_in_cart:
        type_label = "ทฤษฎี (T)" if section_type == "T" else "ปฏิบัติ (L)"
        raise HTTPException(status_code=400, detail=f"วิชานี้มี {type_label} อยู่ในตะกร้าแล้ว (Sec {existing_in_cart.section_number})")
    new_item = EnrollmentCart(
        student_id=request.student_id,
        course_id=request.course_code,
        section_number=sec_num_str,
        section_type=section_type,
    )
    db.add(new_item)
    db.commit()
    return {"message": "เพิ่มลงตะกร้าสำเร็จ", "section_type": section_type}

@app.get("/cart/{student_id}")
def view_cart(student_id: str, db: Session = Depends(get_db)):
    results = (
        db.query(EnrollmentCart, Course)
        .join(Course, EnrollmentCart.course_id == Course.course_id)
        .filter(EnrollmentCart.student_id == student_id)
        .all()
    )
    course_ids = list({item.course_id for item, _ in results})
    all_sections = db.query(ClassSection).filter(ClassSection.course_id.in_(course_ids)).all() if course_ids else []
    section_map = {}
    for s in all_sections:
        key = (s.course_id, s.section_number)
        section_map.setdefault(key, []).append(s)
    result = []
    for item, course in results:
        sec_int = extract_section_int(item.section_number)
        added_schedule = False
        if sec_int is not None:
            for r in section_map.get((item.course_id, sec_int), []):
                if get_section_type_from_room(r.room or "") != (item.section_type or "T"): continue
                result.append({
                    "course_name": course.course_name,
                    "course_code": item.course_id,
                    "credits": course.credits,
                    "section_number": item.section_number,
                    "section_type": item.section_type or "T",
                    "day_of_week": r.day_of_week, 
                    "start_time": str(r.start_time) if r.start_time else None,
                    "end_time": str(r.end_time) if r.end_time else None,
                    "instructor_name": r.instructor.instructor_name if r.instructor else "ไม่ระบุ",
                    "room": r.room,
                    "max_seats": getattr(r, 'max_seats', 0),
                    "enrolled_seats": getattr(r, 'enrolled_seats', 0)
                })
                added_schedule = True
        if not added_schedule:
            result.append({
                "course_name": course.course_name, "course_code": item.course_id, "credits": course.credits,
                "section_number": item.section_number, "section_type": item.section_type or "T",
                "day_of_week": None, "start_time": None, "end_time": None, "room": None, "max_seats": 0, "enrolled_seats": 0
            })
    return result

@app.post("/cart/batch_add_with_check")
def batch_add_cart(req: BatchCartRequest, db: Session = Depends(get_db)):
    if not is_regis_open(db): raise HTTPException(status_code=400, detail="ขณะนี้ระบบปิดรับการลงทะเบียนชั่วคราว")
    cart_items = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == req.student_id).all()
    def get_time_slots(course_code, sec_num, sec_type):
        slots = db.query(ClassSection).filter(ClassSection.course_id == course_code, ClassSection.section_number == extract_section_int(sec_num)).all()
        return [s for s in slots if get_section_type_from_room(s.room or "") == sec_type]
    current_schedule = []
    for ci in cart_items: current_schedule.extend(get_time_slots(ci.course_id, ci.section_number, ci.section_type or "T"))
    conflicts = []
    to_add = []
    for req_item in req.items:
        req_slots = get_time_slots(req_item.course_code, req_item.section_number, req_item.section_type)
        is_conf = False
        for rs in req_slots:
            if not rs.start_time or not rs.end_time: continue
            for cs in current_schedule + to_add:
                if not cs.start_time or not cs.end_time: continue
                if rs.day_of_week == cs.day_of_week:
                    if max(rs.start_time, cs.start_time) < min(rs.end_time, cs.end_time):
                        is_conf = True; break
            if is_conf: break
        if is_conf:
            all_secs = db.query(ClassSection).filter(ClassSection.course_id == req_item.course_code).all()
            valid_secs = [s for s in all_secs if get_section_type_from_room(s.room or "") == req_item.section_type]
            sec_nums = list(set([str(s.section_number) for s in valid_secs]))
            alt_sec = None
            for sn in sec_nums:
                if sn == req_item.section_number: continue
                sn_slots = get_time_slots(req_item.course_code, sn, req_item.section_type)
                sn_conf = False
                for sns in sn_slots:
                    if not sns.start_time or not sns.end_time: continue
                    for cs in current_schedule + to_add:
                        if not cs.start_time or not cs.end_time: continue
                        if sns.day_of_week == cs.day_of_week:
                            if max(sns.start_time, cs.start_time) < min(sns.end_time, cs.end_time):
                                sn_conf = True; break
                    if sn_conf: break
                if not sn_conf: alt_sec = sn; break
            conflicts.append({"course_code": req_item.course_code, "section_type": req_item.section_type, "requested_section": req_item.section_number, "suggested_section": alt_sec})
        else: to_add.extend(req_slots)
    if conflicts: return {"status": "conflict", "conflicts": conflicts}
    for req_item in req.items:
        exists = db.query(EnrollmentCart).filter_by(student_id=req.student_id, course_id=req_item.course_code, section_type=req_item.section_type).first()
        if not exists:
            new_cart = EnrollmentCart(student_id=req.student_id, course_id=req_item.course_code, section_number=req_item.section_number, section_type=req_item.section_type)
            db.add(new_cart)
    db.commit()
    return {"status": "success"}

@app.post("/cart/remove")
def post_remove_from_cart(request: RemoveCartRequest, db: Session = Depends(get_db)):
    query = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == request.student_id, EnrollmentCart.course_id == request.course_code)
    if request.section_type: query = query.filter(EnrollmentCart.section_type == request.section_type)
    item = query.first()
    if item:
        db.delete(item)
        db.commit()
        return {"message": "ลบวิชาออกจากตะกร้าสำเร็จ"}
    raise HTTPException(status_code=404, detail="ไม่พบวิชานี้ในตะกร้า")

@app.delete("/cart/remove/{student_id}/{course_code}")
def delete_remove_from_cart(student_id: str, course_code: str, section_type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == student_id, EnrollmentCart.course_id == course_code)
    if section_type: query = query.filter(EnrollmentCart.section_type == section_type)
    deleted_count = query.delete()
    db.commit()
    if deleted_count == 0: raise HTTPException(status_code=404, detail="ไม่พบวิชานี้ในตะกร้า")
    return {"message": "ลบวิชาออกจากตะกร้าสำเร็จ"}

@app.post("/cart/confirm/{student_id}")
def confirm_enrollment(student_id: str, db: Session = Depends(get_db)):
    if not is_regis_open(db): raise HTTPException(status_code=400, detail="ขณะนี้ระบบปิดรับการลงทะเบียนชั่วคราว")
    cart_items = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == student_id).all()
    if not cart_items: raise HTTPException(status_code=400, detail="ตะกร้าว่างเปล่า")
    for item in cart_items:
        existing = db.query(Enrollment).filter(Enrollment.student_id == student_id, Enrollment.course_id == item.course_id, Enrollment.section_type == item.section_type).first()
        if not existing:
            sections = db.query(ClassSection).with_for_update().filter(ClassSection.course_id == item.course_id, ClassSection.section_number == extract_section_int(item.section_number)).all()
            target_section = next((s for s in sections if get_section_type_from_room(s.room or "") == item.section_type), None)
            if not target_section and sections: target_section = sections[0]
            if target_section:
                cap, enr = target_section.max_seats or 0, target_section.enrolled_seats or 0
                if cap > 0 and enr >= cap:
                    raise HTTPException(status_code=400, detail=f"วิชา {item.course_id} กลุ่ม {item.section_number} ที่นั่งเต็มแล้ว")
                target_section.enrolled_seats = enr + 1
            new_enroll = Enrollment(student_id=student_id, course_id=item.course_id, section_number=item.section_number, section_type=item.section_type)
            db.add(new_enroll)
    db.query(EnrollmentCart).filter(EnrollmentCart.student_id == student_id).delete()
    db.commit()
    return {"message": "ลงทะเบียนสำเร็จ"}

# ================= 5. Group Sync =================
@app.post("/group/create/{student_id}")
def create_group(student_id: str, db: Session = Depends(get_db)):
    existing = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if existing: raise HTTPException(status_code=400, detail="คุณมีกลุ่มอยู่แล้ว")
    new_code = generate_random_code()
    new_group = StudyGroup(leader_id=student_id, group_code=new_code)
    db.add(new_group); db.commit(); db.refresh(new_group)
    new_member = GroupMember(group_id=new_group.group_id, student_id=student_id, status="APPROVED")
    db.add(new_member); db.commit()
    return {"message": "สร้างกลุ่มสำเร็จ", "group_code": new_code}

@app.post("/group/join/{student_id}/{group_code}")
def join_group(student_id: str, group_code: str, db: Session = Depends(get_db)):
    group = db.query(StudyGroup).filter(StudyGroup.group_code == group_code).first()
    if not group: raise HTTPException(status_code=404, detail="รหัสกลุ่มไม่ถูกต้อง")
    exist = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if exist: raise HTTPException(status_code=400, detail="คุณอยู่ในกลุ่มอื่นแล้ว")
    member_count = db.query(GroupMember).filter(GroupMember.group_id == group.group_id, GroupMember.status == "APPROVED").count()
    if member_count >= 5: raise HTTPException(status_code=400, detail="กลุ่มเต็มแล้ว")
    student, leader = db.query(Student).filter(Student.student_id == student_id).first(), db.query(Student).filter(Student.student_id == group.leader_id).first()
    if student.faculty != leader.faculty or student.major != leader.major or student.curriculum_year != leader.curriculum_year:
        raise HTTPException(status_code=400, detail="ต้องอยู่คณะ สาขา และชั้นปีเดียวกัน")
    new_member = GroupMember(group_id=group.group_id, student_id=student_id, status="PENDING")
    db.add(new_member); db.commit()
    return {"message": "ส่งคำขอแล้ว"}

@app.get("/group/my/{student_id}")
def get_my_group(student_id: str, db: Session = Depends(get_db)):
    member_info = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if not member_info: return {"group": None}
    group = db.query(StudyGroup).filter(StudyGroup.group_id == member_info.group_id).first()
    members = db.query(GroupMember, Student).join(Student, GroupMember.student_id == Student.student_id).filter(GroupMember.group_id == group.group_id).all()
    raw_cart = db.query(EnrollmentCart, Course, ClassSection).join(Course, EnrollmentCart.course_id == Course.course_id).outerjoin(ClassSection, (EnrollmentCart.course_id == ClassSection.course_id) & (EnrollmentCart.section_number == cast(ClassSection.section_number, String))).filter(EnrollmentCart.student_id == group.leader_id).all()
    processed_cart = {}
    for ec, c, cs in raw_cart:
        current_sec_type = get_section_type_from_room(cs.room or "") if cs else "-"
        if ec.section_type and current_sec_type != ec.section_type: continue
        cart_key = (ec.course_id, ec.section_number, ec.section_type)
        if cart_key not in processed_cart:
            processed_cart[cart_key] = {
                "course_code": c.course_id, "course_name": c.course_name, "section": ec.section_number, "section_type": ec.section_type or "-",
                "day": cs.day_of_week if cs else "-", "time_info": f"{cs.start_time} - {cs.end_time}" if cs and cs.start_time else "",
                "enrolled_seats": cs.enrolled_seats if cs else 0, "max_seats": cs.max_seats if cs else 0
            }
        elif cs and cs.day_of_week and cs.day_of_week not in processed_cart[cart_key]["day"]:
            processed_cart[cart_key]["day"] += f", {cs.day_of_week}"
    return {
        "group": group, "is_leader": group.leader_id == student_id, "leader_cart": list(processed_cart.values()),
        "members": [{"student_id": m.student_id, "name": s.name, "avatar_url": s.avatar_url, "status": m.status, "is_ready": m.is_ready, "has_seen_registered_alert": m.has_seen_registered_alert} for m, s in members]
    }

@app.post("/group/ready/{student_id}")
def toggle_ready(student_id: str, db: Session = Depends(get_db)):
    member = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if not member: raise HTTPException(status_code=404, detail="ไม่พบสมาชิก")
    member.is_ready = not member.is_ready
    group = db.query(StudyGroup).filter(StudyGroup.group_id == member.group_id).first()
    if group: group.last_synced_at = datetime.datetime.utcnow()
    db.commit()
    return {"is_ready": member.is_ready}

@app.post("/group/register-all/{leader_id}")
def register_group_all(leader_id: str, db: Session = Depends(get_db)):
    if not is_regis_open(db): raise HTTPException(status_code=400, detail="ขณะนี้ระบบปิดรับการลงทะเบียนชั่วคราว")
    group = db.query(StudyGroup).filter(StudyGroup.leader_id == leader_id).first()
    if not group: raise HTTPException(status_code=404, detail="ไม่พบกลุ่ม")
    approved_members = db.query(GroupMember).filter(GroupMember.group_id == group.group_id, GroupMember.status == "APPROVED").all()
    for member in approved_members:
        if member.student_id != leader_id and not member.is_ready: raise HTTPException(status_code=400, detail=f"สมาชิกยังไม่พร้อม: {member.student_id}")
    leader_cart = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == leader_id).all()
    if not leader_cart: raise HTTPException(status_code=400, detail="ตะกร้าของหัวหน้ากลุ่มว่างเปล่า")
    for member in approved_members:
        for item in leader_cart:
            exist = db.query(Enrollment).filter(Enrollment.student_id == member.student_id, Enrollment.course_id == item.course_id, Enrollment.section_type == item.section_type).first()
            if not exist:
                sections = db.query(ClassSection).filter(ClassSection.course_id == item.course_id, ClassSection.section_number == extract_section_int(item.section_number)).all()
                for s in sections:
                    if get_section_type_from_room(s.room or "") == item.section_type:
                        if s.max_seats and s.enrolled_seats >= s.max_seats: raise HTTPException(status_code=400, detail=f"วิชา {item.course_id} ที่นั่งเต็มแล้ว")
                        s.enrolled_seats += 1; break
                db.add(Enrollment(student_id=member.student_id, course_id=item.course_id, section_number=item.section_number, section_type=item.section_type))
        db.query(EnrollmentCart).filter(EnrollmentCart.student_id == member.student_id).delete()
    group.is_registered = True; group.last_action = "REGISTERED"; db.commit()
    return {"message": "ลงทะเบียนให้สมาชิกทุกคนสำเร็จ!"}

@app.post("/group/sync/{leader_id}")
def sync_group_cart(leader_id: str, db: Session = Depends(get_db)):
    if not is_regis_open(db): raise HTTPException(status_code=400, detail="ขณะนี้ระบบปิดรับการลงทะเบียนชั่วคราว")
    group = db.query(StudyGroup).filter(StudyGroup.leader_id == leader_id).first()
    if not group: raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์ Sync")
    leader_cart = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == leader_id).all()
    if not leader_cart: raise HTTPException(status_code=400, detail="ตะกร้าของหัวหน้าว่างเปล่า")
    approved_members = db.query(GroupMember).filter(GroupMember.group_id == group.group_id, GroupMember.status == "APPROVED").all()
    leader_slots = []
    for item in leader_cart:
        slots = db.query(ClassSection).filter(ClassSection.course_id == item.course_id, ClassSection.section_number == extract_section_int(item.section_number)).all()
        leader_slots.extend([s for s in slots if get_section_type_from_room(s.room or "") == (item.section_type or "T")])
    for member in approved_members:
        if member.student_id == leader_id: continue
        member_enrolls = db.query(Enrollment).filter(Enrollment.student_id == member.student_id).all()
        for le in leader_cart:
            if any(me.course_id == le.course_id and me.section_type == le.section_type for me in member_enrolls):
                raise HTTPException(status_code=400, detail=f"สมาชิก {member.student_id} ลงวิชา {le.course_id} ไปแล้ว")
        for ls in leader_slots:
            if not ls.start_time or not ls.end_time: continue
            for me in member_enrolls:
                me_secs = db.query(ClassSection).filter(ClassSection.course_id == me.course_id, ClassSection.section_number == extract_section_int(me.section_number)).all()
                for mes in me_secs:
                    if get_section_type_from_room(mes.room or "") != (me.section_type or "T"): continue
                    if ls.day_of_week == mes.day_of_week and max(ls.start_time, mes.start_time) < min(ls.end_time, mes.end_time):
                        raise HTTPException(status_code=400, detail=f"วิชา {ls.course_id} ของหัวหน้า ชนกับ {me.course_id} ของสมาชิก {member.student_id}")
        db.query(EnrollmentCart).filter(EnrollmentCart.student_id == member.student_id).delete()
        for item in leader_cart:
            db.add(EnrollmentCart(student_id=member.student_id, course_id=item.course_id, section_number=item.section_number, section_type=item.section_type))
    group.last_synced_at = datetime.datetime.utcnow(); group.last_action = "SYNC"; group.is_registered = False; db.commit()
    return {"message": "Sync ตะกร้าให้สมาชิกสำเร็จ"}

@app.post("/group/approve/{leader_id}/{target_id}/{action}")
def approve_member(leader_id: str, target_id: str, action: str, db: Session = Depends(get_db)):
    group = db.query(StudyGroup).filter(StudyGroup.leader_id == leader_id).first()
    if not group: raise HTTPException(status_code=403, detail="คุณไม่ใช่หัวหน้ากลุ่ม")
    target = db.query(GroupMember).filter(GroupMember.group_id == group.group_id, GroupMember.student_id == target_id).first()
    if not target: raise HTTPException(status_code=404, detail="ไม่พบคำขอ")
    if action == "APPROVE":
        if db.query(GroupMember).filter(GroupMember.group_id == group.group_id, GroupMember.status == "APPROVED").count() >= 5:
            raise HTTPException(status_code=400, detail="กลุ่มเต็มแล้ว")
        target.status = "APPROVED"
    elif action == "REJECT": db.delete(target)
    db.commit()
    return {"message": f"ดำเนินการ {action} สำเร็จ"}

@app.delete("/group/leave/{student_id}")
def leave_group(student_id: str, db: Session = Depends(get_db)):
    member = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if not member: raise HTTPException(status_code=404, detail="ไม่ได้อยู่ในกลุ่ม")
    db.delete(member); db.commit()
    return {"message": "ออกจากกลุ่มสำเร็จ"}

@app.delete("/group/delete/{leader_id}")
def delete_group(leader_id: str, db: Session = Depends(get_db)):
    group = db.query(StudyGroup).filter(StudyGroup.leader_id == leader_id).first()
    if not group: raise HTTPException(status_code=403, detail="ไม่ใช่หัวหน้ากลุ่ม")
    db.delete(group); db.commit()
    return {"message": "ยุบกลุ่มสำเร็จ"}

@app.post("/group/mark-seen-registered/{student_id}")
def mark_seen_registered(student_id: str, db: Session = Depends(get_db)):
    member = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if not member: raise HTTPException(status_code=404, detail="ไม่พบสมาชิก")
    member.has_seen_registered_alert = True; db.commit()
    return {"message": "บันทึกการรับทราบสำเร็จ"}

# ================= 6. Enrollment & Withdraw =================
@app.get("/enroll/my/{student_id}")
def get_my_schedule(student_id: str, db: Session = Depends(get_db)):
    enrolls = db.query(Enrollment).filter(Enrollment.student_id == student_id).all()
    result = []
    for en in enrolls:
        course = db.query(Course).filter(Course.course_id == en.course_id).first()
        if not course: continue
        secs = db.query(ClassSection).filter(ClassSection.course_id == en.course_id, ClassSection.section_number == extract_section_int(en.section_number)).all()
        for sec in secs:
            stype = get_section_type_from_room(sec.room or "")
            if en.section_type and stype != en.section_type: continue
            result.append({
                "course_code": course.course_id, "course_name": course.course_name, "credits": course.credits, "section_number": sec.section_number,
                "type": stype, "day_of_week": sec.day_of_week, "start_time": str(sec.start_time) if sec.start_time else "", "end_time": str(sec.end_time) if sec.end_time else "",
                "room": sec.room, "instructor_name": sec.instructor.instructor_name if sec.instructor else "ไม่ระบุ"
            })
    return result

@app.post("/enrollment/withdraw")
def withdraw_course(data: dict, db: Session = Depends(get_db)):
    student_id, course_code, sec_num_str, sec_type = data.get("student_id"), data.get("course_code"), str(data.get("section_number")), data.get("section_type")
    enrollment = db.query(Enrollment).filter(Enrollment.student_id == student_id, Enrollment.course_id == course_code, Enrollment.section_number == sec_num_str, Enrollment.section_type == sec_type).first()
    if not enrollment: raise HTTPException(status_code=404, detail="ไม่พบข้อมูลการลงทะเบียน")
    course = db.query(Course).filter(Course.course_id == course_code).first()
    course_label = f"{course_code} {course.course_name if course else ''}"
    db.delete(enrollment)
    sec_num_int = extract_section_int(sec_num_str)
    next_in_q = db.query(Waitlist).with_for_update().filter(Waitlist.course_id == course_code, Waitlist.section_number == sec_num_int, Waitlist.section_type == sec_type, Waitlist.status == WaitlistStatus.PENDING).order_by(Waitlist.created_at.asc()).first()
    if next_in_q:
        next_in_q.status, next_in_q.allocated_at = WaitlistStatus.ALLOCATED, datetime.datetime.utcnow()
        student_q = db.query(Student).filter(Student.student_id == next_in_q.student_id).first()
        if student_q and student_q.expo_push_token:
            try: send_push_message(token=student_q.expo_push_token, title="ถึงคิวของคุณแล้ว! 🎉", message=f"วิชา {course_label} ว่างแล้ว! ยืนยันสิทธิ์ใน 30 นาที", extra={"course_id": course_code, "screen": "Waitlist"})
            except Exception as e: print(f"Push Error: {e}")
        msg = f"ถอนวิชา {course_label} สำเร็จ และโอนสิทธิ์ให้คนรอคิวลำดับถัดไปแล้ว"
    else:
        sections = db.query(ClassSection).with_for_update().filter(ClassSection.course_id == course_code, ClassSection.section_number == sec_num_int).all()
        for sec in sections:
            if get_section_type_from_room(sec.room or "") == sec_type and sec.enrolled_seats > 0: sec.enrolled_seats -= 1
        msg = f"ถอนวิชา {course_label} สำเร็จ"
    db.commit()
    return {"status": "success", "message": msg}

# ================= 7. Grades & Sections =================
@app.get("/grades/{student_id}")
def get_student_grades(student_id: str, db: Session = Depends(get_db)):
    results = db.query(GradeRecord, Course.credits, Course.course_name).join(Course, GradeRecord.course_id == Course.course_id).filter(GradeRecord.student_id == student_id).all()
    return [{"course_id": g.course_id, "course_name": cn, "grade": g.grade, "semester": g.semester, "credits": cr} for g, cr, cn in results]

@app.get("/sections/{course_code}")
def get_course_sections_v1(course_code: str, db: Session = Depends(get_db)):
    sections = db.query(ClassSection).filter(ClassSection.course_id == course_code).all()
    return [{"section_id": s.section_id, "section_number": str(s.section_number), "type": get_section_type_from_room(s.room), "day_of_week": s.day_of_week, "start_time": s.start_time.strftime('%H:%M') if s.start_time else "00:00", "end_time": s.end_time.strftime('%H:%M') if s.end_time else "00:00", "room": s.room, "max_seats": s.max_seats, "enrolled_seats": s.enrolled_seats} for s in sections]

@app.get("/courses/{course_id}/sections")
def get_course_sections_v2(course_id: str, db: Session = Depends(get_db)):
    sections = db.query(ClassSection).filter(ClassSection.course_id == course_id).all()
    if not sections: return []
    grouped = {}
    for sec in sections:
        stype = get_section_type_from_room(sec.room)
        key = (sec.section_number, stype)
        if key not in grouped: grouped[key] = {"course_id": sec.course_id, "section_number": sec.section_number, "section_type": stype, "day_of_week": sec.day_of_week or "", "start_time": str(sec.start_time) if sec.start_time else None, "end_time": str(sec.end_time) if sec.end_time else None, "max_seats": sec.max_seats, "enrolled_seats": sec.enrolled_seats}
        elif sec.day_of_week and sec.day_of_week not in grouped[key]["day_of_week"]:
            grouped[key]["day_of_week"] = (grouped[key]["day_of_week"] + f", {sec.day_of_week}") if grouped[key]["day_of_week"] else sec.day_of_week
    return list(grouped.values())

# ================= 8. Waitlist =================
@app.post("/waitlist/join")
def join_waitlist(req: WaitlistJoinRequest, db: Session = Depends(get_db)):
    sections = db.query(ClassSection).filter(ClassSection.course_id == req.course_code, ClassSection.section_number == req.section_number).all()
    target_secs = [s for s in sections if get_section_type_from_room(s.room or "") == req.section_type]
    if not target_secs: raise HTTPException(status_code=404, detail="ไม่พบกลุ่มเรียน")
    if not any(s.max_seats > 0 and s.enrolled_seats >= s.max_seats for s in target_secs): raise HTTPException(status_code=400, detail="กลุ่มเรียนนี้ยังไม่เต็ม")
    existing = db.query(Waitlist).filter(Waitlist.student_id == req.student_id, Waitlist.course_id == req.course_code, Waitlist.section_type == req.section_type, Waitlist.status == WaitlistStatus.PENDING).first()
    if existing: raise HTTPException(status_code=400, detail="คุณได้เข้าคิววิชานี้ไว้แล้ว")
    conf_msg = check_conflict_with_all(target_secs, req.student_id, db)
    if conf_msg: raise HTTPException(status_code=400, detail=f"เวลาเรียนทับซ้อน: {conf_msg}")
    last_wait = db.query(Waitlist).with_for_update().filter(Waitlist.course_id == req.course_code, Waitlist.section_number == req.section_number, Waitlist.section_type == req.section_type).order_by(Waitlist.queue_position.desc()).first()
    next_pos = (last_wait.queue_position + 1) if last_wait else 1
    db.add(Waitlist(student_id=req.student_id, course_id=req.course_code, section_number=req.section_number, section_type=req.section_type, status=WaitlistStatus.PENDING, queue_position=next_pos))
    db.commit()
    return {"message": "เข้าสู่ลำดับรอสำเร็จ", "queue_position": next_pos}

@app.get("/waitlist/status/{student_id}")
def get_waitlist_status(student_id: str, db: Session = Depends(get_db)):
    waitlists = db.query(Waitlist).filter(Waitlist.student_id == student_id).order_by(Waitlist.created_at.desc()).all()
    result = []
    for w in waitlists:
        course = db.query(Course).filter(Course.course_id == w.course_id).first()
        secs = db.query(ClassSection).filter(ClassSection.course_id == w.course_id, ClassSection.section_number == w.section_number).all()
        target_s = next((s for s in secs if get_section_type_from_room(s.room or "") == w.section_type), None)
        cur_q = db.query(Waitlist).filter(Waitlist.course_id == w.course_id, Waitlist.section_number == w.section_number, Waitlist.section_type == w.section_type, Waitlist.status == WaitlistStatus.PENDING, Waitlist.created_at <= w.created_at).count() if w.status == WaitlistStatus.PENDING else 0
        result.append({"id": w.id, "course_id": w.course_id, "course_name": course.course_name if course else "Unknown", "section_number": w.section_number, "section_type": w.section_type, "status": w.status.value, "queue_position": cur_q, "created_at": w.created_at.isoformat(), "allocated_at": w.allocated_at.isoformat() if w.allocated_at else None, "schedule": f"{target_s.day_of_week} {target_s.start_time}-{target_s.end_time}" if target_s else "N/A", "room": target_s.room if target_s else "N/A"})
    return result

@app.post("/waitlist/confirm/{waitlist_id}")
def confirm_waitlist_seat(waitlist_id: int, db: Session = Depends(get_db)):
    entry = db.query(Waitlist).filter(Waitlist.id == waitlist_id).first()
    if not entry: raise HTTPException(status_code=404, detail="ไม่พบข้อมูลคิว")
    if entry.status != WaitlistStatus.ALLOCATED: raise HTTPException(status_code=400, detail="สถานะไม่ถูกต้อง")
    if (datetime.datetime.utcnow() - entry.allocated_at).total_seconds() > 1800:
        entry.status = WaitlistStatus.EXPIRED; db.commit()
        raise HTTPException(status_code=400, detail="หมดเวลายืนยันสิทธิ์ 30 นาที")
    already = db.query(Enrollment).filter(Enrollment.student_id == entry.student_id, Enrollment.course_id == entry.course_id, Enrollment.section_type == entry.section_type).first()
    if already: raise HTTPException(status_code=400, detail="มีวิชานี้ในตารางเรียนแล้ว")
    in_cart = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == entry.student_id, EnrollmentCart.course_id == entry.course_id, EnrollmentCart.section_type == entry.section_type).first()
    if in_cart: raise HTTPException(status_code=400, detail="มีในตะกร้าแล้ว ลบออกก่อนยืนยัน")
    secs = db.query(ClassSection).filter(ClassSection.course_id == entry.course_id, ClassSection.section_number == entry.section_number).all()
    target = next((s for s in secs if get_section_type_from_room(s.room or "") == entry.section_type), None)
    if not target: raise HTTPException(status_code=404, detail="ไม่พบข้อมูลกลุ่ม")
    conf_msg = check_conflict_with_all([target], entry.student_id, db)
    if conf_msg: raise HTTPException(status_code=400, detail=f"เวลาเรียนชน: {conf_msg}")
    db.add(Enrollment(student_id=entry.student_id, course_id=entry.course_id, section_number=str(entry.section_number), section_type=entry.section_type))
    entry.status = WaitlistStatus.CONFIRMED; db.commit()
    return {"message": "ยืนยันสิทธิ์สำเร็จ"}

@app.post("/waitlist/cancel/{waitlist_id}")
def cancel_waitlist_seat(waitlist_id: int, db: Session = Depends(get_db)):
    waitlist = db.query(Waitlist).filter(Waitlist.id == waitlist_id).first()
    if not waitlist: raise HTTPException(status_code=404, detail="ไม่พบข้อมูลคิว")
    was_alloc = (waitlist.status == WaitlistStatus.ALLOCATED)
    c_id, s_num, s_type = waitlist.course_id, waitlist.section_number, waitlist.section_type
    db.delete(waitlist); db.commit()
    if was_alloc:
        next_w = db.query(Waitlist).filter(Waitlist.course_id == c_id, Waitlist.section_number == s_num, Waitlist.section_type == s_type, Waitlist.status == WaitlistStatus.PENDING).order_by(Waitlist.created_at.asc()).first()
        if next_w: next_w.status, next_w.allocated_at = WaitlistStatus.ALLOCATED, datetime.datetime.utcnow(); db.commit()
        else:
            secs = db.query(ClassSection).filter(ClassSection.course_id == c_id, ClassSection.section_number == s_num).all()
            target = next((s for s in secs if get_section_type_from_room(s.room or "") == s_type), None)
            if target and target.enrolled_seats > 0: target.enrolled_seats -= 1; db.commit()
    return {"message": "สละสิทธิ์สำเร็จ"}

# ================= 9. Admin =================
@app.get("/admin/config")
def get_admin_config(db: Session = Depends(get_db)):
    config = db.query(SystemConfig).filter(SystemConfig.key == "registration_open").first()
    return {"registration_open": config.value == "true" if config else True}

@app.post("/admin/toggle-registration")
def toggle_registration(request: dict, db: Session = Depends(get_db)):
    admin_id = request.get("admin_id")
    config = db.query(SystemConfig).filter(SystemConfig.key == "registration_open").first()
    if not config:
        config = SystemConfig(key="registration_open", value="true")
        db.add(config)
    
    old_val = config.value
    new_val = "false" if old_val == "true" else "true"
    config.value = new_val
    
    # บันทึก Log การทำงาน
    new_log = SystemLog(
        admin_id=admin_id,
        action='TOGGLE_REGISTRATION',
        details=f'Changed registration from {old_val} to {new_val}'
    )
    db.add(new_log)
    
    db.commit()
    return {"registration_open": new_val == "true"}

@app.post("/admin/toggle-maintenance")
def toggle_maintenance(request: dict, db: Session = Depends(get_db)):
    admin_id = request.get("admin_id")
    config = db.query(SystemConfig).filter(SystemConfig.key == "maintenance_mode").first()
    if not config:
        config = SystemConfig(key="maintenance_mode", value="false")
        db.add(config)
    
    old_val = config.value
    new_val = "true" if old_val == "false" else "false"
    config.value = new_val
    
    # บันทึก Log การทำงาน
    new_log = SystemLog(
        admin_id=admin_id,
        action='TOGGLE_MAINTENANCE',
        details=f'Changed maintenance mode from {old_val} to {new_val}'
    )
    db.add(new_log)
    
    db.commit()
    return {"maintenance_mode": new_val == "true"}

@app.get("/admin/maintenance-status")
def get_maintenance_status(db: Session = Depends(get_db)):
    config = db.query(SystemConfig).filter(SystemConfig.key == "maintenance_mode").first()
    return {"maintenance_mode": config.value == "true" if config else False}

@app.get("/admin/students/search")
def search_students(query: str, db: Session = Depends(get_db)):
    students = db.query(Student).filter((Student.student_id.like(f"%{query}%")) | (Student.name.like(f"%{query}%"))).all()
    results = []
    for s in students:
        # 1. Enrolled Courses (using detailed joins)
        enrolled_items = []
        enrolled_query = (
            db.query(
                Enrollment.course_id,
                Course.course_name,
                Course.credits,
                Enrollment.section_number,
                Enrollment.section_type,
                ClassSection.day_of_week,
                ClassSection.start_time,
                ClassSection.end_time,
                Instructor.instructor_name,
                ClassSection.room
            )
            .join(Course, Enrollment.course_id == Course.course_id)
            .join(ClassSection, (Enrollment.course_id == ClassSection.course_id) & (cast(ClassSection.section_number, String) == Enrollment.section_number))
            .outerjoin(Instructor, ClassSection.instructor_id == Instructor.instructor_id)
            .filter(Enrollment.student_id == s.student_id)
        )
        
        for row in enrolled_query.all():
            stype = get_section_type_from_room(row.room)
            if row.section_type and stype != row.section_type:
                continue
            
            enrolled_items.append({
                "course_id": row.course_id,
                "course_name": row.course_name,
                "credits": row.credits,
                "section": row.section_number,
                "type": stype,
                "day": row.day_of_week or "N/A",
                "time": f"{row.start_time.strftime('%H:%M')}-{row.end_time.strftime('%H:%M')}" if row.start_time and row.end_time else "N/A",
                "instructor_name": row.instructor_name or "ไม่ระบุ"
            })

        # 2. Waitlist Entries
        waitlist_items = []
        waitlist_query = (
            db.query(
                Waitlist.course_id,
                Course.course_name,
                Course.credits,
                Waitlist.section_number,
                Waitlist.section_type,
                Waitlist.status,
                Waitlist.created_at,
                ClassSection.day_of_week,
                ClassSection.start_time,
                ClassSection.end_time,
                ClassSection.room,
                Instructor.instructor_name
            )
            .join(Course, Waitlist.course_id == Course.course_id)
            .join(ClassSection, (Waitlist.course_id == ClassSection.course_id) & (Waitlist.section_number == ClassSection.section_number))
            .outerjoin(Instructor, ClassSection.instructor_id == Instructor.instructor_id)
            .filter(Waitlist.student_id == s.student_id)
        )
        
        for row in waitlist_query.all():
            stype = get_section_type_from_room(row.room)
            if row.section_type and stype != row.section_type:
                continue
                
            waitlist_items.append({
                "course_id": row.course_id,
                "course_name": row.course_name,
                "credits": row.credits,
                "section": row.section_number,
                "type": row.section_type,
                "day": row.day_of_week or "N/A",
                "time": f"{row.start_time.strftime('%H:%M')}-{row.end_time.strftime('%H:%M')}" if row.start_time and row.end_time else "N/A",
                "instructor_name": row.instructor_name or "ไม่ระบุ",
                "status": row.status.value,
                "created_at": row.created_at.isoformat()
            })

        # 3. Grades 
        grades_res = (
            db.query(GradeRecord, Course.course_name, Course.credits)
            .join(Course, GradeRecord.course_id == Course.course_id)
            .filter(GradeRecord.student_id == s.student_id)
            .all()
        )
        
        results.append({
            "profile": {
                "student_id": s.student_id, 
                "name": s.name, 
                "email": s.email,
                "major": s.major,
                "faculty": s.faculty,
                "phone_number": s.phone_number,
                "avatar_url": s.avatar_url
            },
            "enrolled": enrolled_items,
            "waitlist": waitlist_items,
           "grades": [{"course_id": g.course_id, "course_name": cn, "grade": g.grade, "semester": g.semester, "credits": cr} for g, cn, cr in grades_res]
        })
    return results

# ================= 10. Others =================
@app.post("/students/{student_id}/push-token")
def update_push_token(student_id: str, data: PushTokenUpdate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student: raise HTTPException(status_code=404, detail="ไม่พบข้อมูลนักศึกษา")
    student.expo_push_token = data.push_token; db.commit()
    return {"status": "success"}

# ---------------- Background Tasks ----------------
def process_waitlist_expiry():
    db = SessionLocal()
    try:
        expiry_time = datetime.datetime.utcnow() - datetime.timedelta(minutes=30)
        expired = db.query(Waitlist).filter(Waitlist.status == WaitlistStatus.ALLOCATED, Waitlist.allocated_at <= expiry_time).all()
        for entry in expired:
            entry.status = WaitlistStatus.EXPIRED
            # Move to next in queue
            next_w = db.query(Waitlist).filter(
                Waitlist.course_id == entry.course_id, 
                Waitlist.section_number == entry.section_number, 
                Waitlist.section_type == entry.section_type, 
                Waitlist.status == WaitlistStatus.PENDING
            ).order_by(Waitlist.created_at.asc()).first()
            if next_w: 
                next_w.status, next_w.allocated_at = WaitlistStatus.ALLOCATED, datetime.datetime.utcnow()
                # Send Push Notification
                student_q = db.query(Student).filter(Student.student_id == next_w.student_id).first()
                if student_q and student_q.expo_push_token:
                    try:
                        send_push_message(
                            token=student_q.expo_push_token,
                            title="ถึงคิวของคุณแล้ว! 🎉",
                            message=f"วิชา {next_w.course_id} ว่างแล้ว! ยืนยันสิทธิ์ใน 30 นาที",
                            extra={"course_id": next_w.course_id, "screen": "Waitlist"}
                        )
                    except Exception as e: print(f"Push Error: {e}")
        db.commit()
    except Exception as e: 
        print(f"Waitlist Scheduler Error: {e}")
        db.rollback()
    finally: 
        db.close()

def allocate_waitlist_seats():
    db = SessionLocal()
    try:
        pending_groups = db.query(Waitlist.course_id, Waitlist.section_number, Waitlist.section_type).filter(Waitlist.status == WaitlistStatus.PENDING).distinct().all()
        for c_id, s_num, s_type in pending_groups:
            sections = db.query(ClassSection).filter(ClassSection.course_id == c_id, ClassSection.section_number == s_num).all()
            target = next((s for s in sections if get_section_type_from_room(s.room or "") == s_type), None)
            if target and target.enrolled_seats < target.max_seats:
                avail = target.max_seats - target.enrolled_seats
                next_in_line = db.query(Waitlist).filter(
                    Waitlist.course_id == c_id, 
                    Waitlist.section_number == s_num, 
                    Waitlist.section_type == s_type, 
                    Waitlist.status == WaitlistStatus.PENDING
                ).order_by(Waitlist.queue_position.asc()).limit(avail).all()
                for entry in next_in_line: 
                    entry.status, entry.allocated_at = WaitlistStatus.ALLOCATED, datetime.datetime.utcnow()
                    # Send Push Notification
                    student_q = db.query(Student).filter(Student.student_id == entry.student_id).first()
                    if student_q and student_q.expo_push_token:
                        try:
                            send_push_message(
                                token=student_q.expo_push_token,
                                title="ถึงคิวของคุณแล้ว! 🎉",
                                message=f"วิชา {c_id} ว่างแล้ว! ยืนยันสิทธิ์ใน 30 นาที",
                                extra={"course_id": c_id, "screen": "Waitlist"}
                            )
                        except Exception as e: print(f"Push Error: {e}")
        db.commit()
    except Exception as e: 
        print(f"Allocation Error: {e}")
        db.rollback()
    finally: 
        db.close()

scheduler = BackgroundScheduler()

@app.on_event("startup")
def startup_event():
    scheduler.add_job(process_waitlist_expiry, 'interval', minutes=1)
    scheduler.add_job(allocate_waitlist_seats, 'interval', minutes=1)
    scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    if scheduler.running: scheduler.shutdown()

# Initialize Database
Base.metadata.create_all(bind=engine)
