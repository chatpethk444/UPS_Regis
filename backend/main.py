import random
import datetime
import string
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import cast, String
from pydantic import BaseModel
from database import SessionLocal, Student, Course, ClassSection, EnrollmentCart, Enrollment, CurriculumCourse, StudyGroup, GroupMember
from itertools import product
from database import engine, Base
from typing import List, Optional
import re
import random
import string

app = FastAPI()

def generate_random_code():
    # สุ่มตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ผสมตัวเลข ความยาว 6 ตัว (เช่น YOVI09, 8C4LV4)
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Pydantic Models ---
class LoginRequest(BaseModel):
    student_id: str
    password: str

class CartRequest(BaseModel):
    student_id: str
    course_code: str
    section_number: str
    section_type: Optional[str] = None   # ✅ เพิ่ม: "T" หรือ "L"

class RemoveCartRequest(BaseModel):
    student_id: str
    course_code: str

class AISuggestRequest(BaseModel):
    student_id: str
    course_codes: List[str]


# --- Constants ---
CURRENT_YEAR_CODE = 68
MAX_AI_PLANS = 5
MAX_AI_COURSES = 8

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


# =============================================================
# Helper Functions
# =============================================================

def calculate_student_year(student_id: str) -> int:
    try:
        entry_year = int(student_id[:2])
        student_year = (CURRENT_YEAR_CODE - entry_year) + 1
        return max(student_year, 1)
    except Exception:
        return 1


def get_section_type_from_room(room: str) -> str:
    """✅ ระบุประเภท T/L จากชื่อห้อง (ท) = T, (ป) = L"""
    room_str = str(room or "")
    if "(ท)" in room_str:
        return "T"
    elif "(ป)" in room_str:
        return "L"
    return "T"  # default ถ้าไม่ระบุ


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
            "instructor_name": s.instructor_name, 
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
    match = re.search(r'\d+', str(section_number_str))
    return int(match.group()) if match else None


# =============================================================
# 1. Login
# =============================================================

@app.post("/login")
def login(request: dict, db: Session = Depends(get_db)):
    req_student_id = request.get("student_id")
    student = db.query(Student).filter(Student.student_id == req_student_id).first()
    if student:
        return {
            "student_id": student.student_id,
            "first_name": student.name,
            "major": student.major,
            "year": student.curriculum_year,
            "faculty": student.faculty,
            "avatar_url": student.avatar_url,
            "current_year": student.current_year,
            "current_semester": student.current_semester or 1
        }
    raise HTTPException(status_code=401, detail="ไม่พบรหัสนักศึกษานี้ในระบบ")


# =============================================================
# 2. วิชาที่แนะนำ
# =============================================================

@app.get("/courses/available/{student_id}")
def get_available_courses(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลนักศึกษา")

    # ✅ ใช้ข้อมูลจากตาราง Student โดยตรง
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


# =============================================================
# 3. AI Scheduler
# =============================================================

# 🌟 ฟังก์ชันเสริม: ใช้เพื่อหาว่าวิชาไหนชนกันแบบละเอียด (บอกวัน/เวลา)
def find_conflict_details(plan_secs, current_secs):
    all_secs = plan_secs + current_secs
    for i in range(len(all_secs)):
        for j in range(i + 1, len(all_secs)):
            s1 = all_secs[i]
            s2 = all_secs[j]
            
            # ถ้าเป็นวิชาเดียวกัน Section เดียวกัน ให้ข้าม (ไม่ถือว่าชน)
            if s1.course_id == s2.course_id and getattr(s1, 'section_number', '') == getattr(s2, 'section_number', ''):
                continue
                
            # ถ้าเรียนวันเดียวกัน
            if s1.day_of_week and s2.day_of_week and s1.day_of_week == s2.day_of_week:
                if s1.start_time and s1.end_time and s2.start_time and s2.end_time:
                    
                    # แปลงเวลาเป็นนาทีเพื่อเช็คการทับซ้อน
                    def get_mins(t):
                        if hasattr(t, 'hour'): # ถ้าเป็น object datetime.time
                            return t.hour * 60 + t.minute
                        # ถ้าเป็น string เช่น "09:00"
                        h, m = map(int, str(t).split(':')[:2])
                        return h * 60 + m
                        
                    start1, end1 = get_mins(s1.start_time), get_mins(s1.end_time)
                    start2, end2 = get_mins(s2.start_time), get_mins(s2.end_time)
                    
                    # สูตรเช็คเวลาทับซ้อน
                    if start1 < end2 and start2 < end1:
                        fmt_t1 = f"{str(s1.start_time)[:5]}-{str(s1.end_time)[:5]}"
                        fmt_t2 = f"{str(s2.start_time)[:5]}-{str(s2.end_time)[:5]}"
                        
                        type1 = "(ในตาราง)" if s1 in current_secs else "(วิชาเป้าหมาย)"
                        type2 = "(ในตาราง)" if s2 in current_secs else "(วิชาเป้าหมาย)"
                        
                        return f"วิชา {s1.course_id} {type1} ชนกับ {s2.course_id} {type2}\nวัน{s1.day_of_week} เวลา {fmt_t1} ทับกับ {fmt_t2}"
    return None


@app.post("/ai-suggest")
def ai_suggest(data: dict, db: Session = Depends(get_db)):
    student_id = data.get("student_id")
    course_codes = list(set(data.get("course_codes", [])))

    if not student_id:
        raise HTTPException(status_code=400, detail="ต้องระบุ student_id")

    MAX_AI_COURSES = 10 
    MAX_AI_PLANS = 10

    if len(course_codes) > MAX_AI_COURSES:
        raise HTTPException(
            status_code=400,
            detail=f"เลือกได้สูงสุด {MAX_AI_COURSES} วิชาต่อครั้ง"
        )

    # 🌟 ดึงข้อมูลตารางเรียนปัจจุบันมาเช็คชน
    current_enrollments = db.query(Enrollment).filter(Enrollment.student_id == student_id).all()
    current_slots = []
    for en in current_enrollments:
        secs = db.query(ClassSection).filter(
            ClassSection.course_id == en.course_id,
            ClassSection.section_number == en.section_number
        ).all()
        for s in secs:
            if get_section_type_from_room(s.room or "") == (en.section_type or "T"):
                current_slots.append(s)

    all_course_options = []

    for code in course_codes:
        secs = db.query(ClassSection).filter(ClassSection.course_id == code).all()
        if not secs:
            continue

        # ✅ จับกลุ่ม Row ตาม Section Number และ Type (ทฤษฎี/ปฏิบัติ)
        # ป้องกันปัญหา 1 Section มีหลาย Row (เช่น เรียน 2 วัน) และดึงทุกรูปแบบ
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
            # กรณีมีทั้ง T และ L ให้หาผลคูณคาร์ทีเซียน (Cartesian Product) ทั้งหมด
            for t_grp, p_grp in product(theory_options, practice_options):
                course_options.append(t_grp + p_grp)
        elif theory_options:
            course_options = theory_options
        elif practice_options:
            course_options = practice_options

        if course_options:
            all_course_options.append(course_options)

    if not all_course_options:
        raise HTTPException(status_code=400, detail="ไม่พบกลุ่มเรียนสำหรับวิชาที่เลือก")

    valid_plans = []
    conflict_reason = "ไม่สามารถจัดตารางได้ เนื่องจากเวลาเรียนชนกัน"
    
    for plan_combinations in product(*all_course_options):
        flat_plan = [sec for item in plan_combinations for sec in item]
        
        # 🌟 เช็คชนกันเอง และ เช็คชนกับตารางเรียนปัจจุบัน
        if not is_conflict(flat_plan + current_slots):
            valid_plans.append(format_plan(flat_plan))
        elif not valid_plans:
            # 🌟 ถ้ายังไม่มีแผนไหนผ่านเลย ลองเก็บรายละเอียดการชนของแพลนนี้ไว้เผื่อแจ้ง Error
            detail = find_conflict_details(flat_plan, current_slots)
            if detail:
                conflict_reason = detail
                
        if len(valid_plans) >= MAX_AI_PLANS:
            break

    # 🌟 แจ้งเตือนข้อความ Error พร้อมรายละเอียดที่ไปสืบมา
    if not valid_plans:
        raise HTTPException(
            status_code=400,
            detail=conflict_reason
        )

    return valid_plans


# =============================================================
# 4. ตะกร้า (Cart)
# =============================================================

@app.post("/cart/add")
def add_to_cart(request: CartRequest, db: Session = Depends(get_db)):
    sec_num_str = request.section_number
    sec_int = extract_section_int(sec_num_str)

    # ✅ ระบุ section_type — รับจาก request ก่อน ถ้าไม่มีค่อยดูจากชื่อห้อง
    section_type = request.section_type
    if not section_type and sec_int is not None:
        sec_row = db.query(ClassSection).filter(
            ClassSection.course_id == request.course_code,
            ClassSection.section_number == sec_int,
        ).first()
        if sec_row:
            section_type = get_section_type_from_room(sec_row.room or "")
    if not section_type:
        section_type = "T"

    # ✅ เช็กการลงทะเบียนจริง: ถ้ามี type นี้ในตารางเรียนแล้ว ห้ามแอด type นี้ลงตะกร้าอีก
    already_enrolled_same_type = db.query(Enrollment).filter(
        Enrollment.student_id == request.student_id,
        Enrollment.course_id == request.course_code,
        Enrollment.section_type == section_type,
    ).first()
    
    if already_enrolled_same_type:
        type_label = "ทฤษฎี (T)" if section_type == "T" else "ปฏิบัติ (L)"
        raise HTTPException(
            status_code=400, 
            detail=f"คุณได้ลงทะเบียน {type_label} ของวิชานี้ไปเรียบร้อยแล้วในตารางเรียน"
        )

    # ✅ เช็กตะกร้า: วิชาเดียวกัน + section_type เดียวกัน → มีได้แค่ 1 section ต่อ type
    existing_same_type = db.query(EnrollmentCart).filter(
        EnrollmentCart.student_id == request.student_id,
        EnrollmentCart.course_id == request.course_code,
        EnrollmentCart.section_type == section_type,
    ).first()
    if existing_same_type:
        type_label = "ทฤษฎี (T)" if section_type == "T" else "ปฏิบัติ (L)"
        raise HTTPException(
            status_code=400,
            detail=f"วิชานี้มี {type_label} อยู่ในตะกร้าแล้ว (Sec {existing_same_type.section_number})"
        )

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
    all_sections = (
        db.query(ClassSection)
        .filter(ClassSection.course_id.in_(course_ids))
        .all()
    ) if course_ids else []

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
                # กรองเฉพาะ row ที่ตรง type (T หรือ L)
                row_type = get_section_type_from_room(r.room or "")
                if row_type != (item.section_type or "T"):
                    continue
                
                # ✅ แยกฟิลด์ วัน เวลา และห้อง เพื่อให้แอปเอาไปคำนวณและวาดตารางได้
                # 🌟 เพิ่มข้อมูลที่นั่งตรงนี้!
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
                    
                    # 🌟 ดึงข้อมูลที่นั่งจากตาราง ClassSection (r) ส่งไปด้วย
                    "max_seats": getattr(r, 'max_seats', 0),
                    "enrolled_seats": getattr(r, 'enrolled_seats', 0)
                })
                added_schedule = True

        # ถ้าวิชานั้นไม่มีข้อมูลเวลาเรียนในฐานข้อมูลเลย ให้แสดงเป็นค่าว่างแต่ยังต้องส่งไปแสดงในตะกร้า
        if not added_schedule:
            result.append({
                "course_name": course.course_name,
                "course_code": item.course_id,
                "credits": course.credits,
                "section_number": item.section_number,
                "section_type": item.section_type or "T",
                "day_of_week": None,
                "start_time": None,
                "end_time": None,
                "room": None,
                
                # 🌟 ถ้าไม่มีข้อมูลกลุ่มเรียน ก็ส่งค่าที่นั่งเป็น 0 ไปก่อน
                "max_seats": 0,
                "enrolled_seats": 0
            })

    return result


# =============================================================
# 5. ระบบลงทะเบียนยกภาค (Batch Registration & Conflict Check)
# =============================================================
from fastapi import HTTPException

@app.get("/courses/suggested/{student_id}")
def get_suggested_courses(student_id: str, db: Session = Depends(get_db)):
    # 1. ค้นหาข้อมูลนักศึกษาจาก Database
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลนักศึกษา")

    # 2. คำนวณชั้นปีของนักศึกษาจากรหัสนิสิต (2 ตัวแรก)
    # กำหนดปีการศึกษาปัจจุบัน (ตัวอย่าง: ปี 2568 ใช้เลข 68) 
    # รหัส 66 -> 68 - 66 + 1 = 3 (ปี 3)
    CURRENT_ACADEMIC_YEAR = 68 
    
    try:
        entry_year = int(student_id[:2]) # ดึง "66" ออกมา
        student_year = CURRENT_ACADEMIC_YEAR - entry_year + 1
    except ValueError:
        student_year = 1 # ค่าเริ่มต้นถ้าดึงรหัสไม่ได้

    # 3. ดึงเทอมปัจจุบันของนักศึกษา
    current_sem = student.current_semester or 1

    # 4. กรองรายวิชาจากหลักสูตร ให้ตรงกับ "คณะ", "สาขา", "ปี" และ "เทอม"
    suggested_courses = (
        db.query(CurriculumCourse, Course)
        .join(Course, CurriculumCourse.course_id == Course.course_id)
        .filter(
            # ❌ ลบบรรทัด CurriculumCourse.curriculum_id == student.major ทิ้งไป

            # ✅ เพิ่ม 3 บรรทัดนี้เพื่อกรอง คณะ, สาขา และ ปีหลักสูตร ให้ตรงกับนักศึกษา
            CurriculumCourse.faculty == student.faculty,
            CurriculumCourse.major == student.major,
            CurriculumCourse.curriculum_year == student.curriculum_year, # เช็คปีของหลักสูตรด้วย (เช่น หลักสูตรปี 60 หรือ 65)
            
            # เช็คชั้นปีที่เรียนและเทอมปัจจุบัน
            CurriculumCourse.suggested_year == student_year,
            CurriculumCourse.suggested_semester == current_sem
        )
        .all()
    )

    # 5. กรองรายวิชาเฉพาะวิชาภาค (Major Specific) ตามรหัสวิชา
    # CPE = วิศวกรรมคอมพิวเตอร์, ICT = เทคโนโลยีสารสนเทศ, LSM = โลจิสติกส์
    major_prefix_map = {
        "วิศวกรรมคอมพิวเตอร์": "CPE",
        "เทคโนโลยีสารสนเทศและการสื่อสาร": "ICT",
        "การจัดการโลจิสติกส์และโซ่อุปทาน": "LSM"
    }
    
    target_prefix = major_prefix_map.get(student.major)

    result = []
    for curr_course, course in suggested_courses:
        # ✅ 1. ดึงชื่อวิชาอย่างปลอดภัย
        final_name = getattr(course, 'course_name', None) or 'Unknown'
        course_code = course.course_id

        # ✅ 2. ถ้ามี Prefix ของสาขา ให้กรองเฉพาะวิชาที่ขึ้นต้นด้วย Prefix นั้น
        # (ยกเว้นวิชาที่เป็นวิชาเลือกหมวด Z ที่อาจต้องแสดงผลด้วย แต่อันนี้เน้นวิชาภาคตามโจทย์)
        if target_prefix and not course_code.upper().startswith(target_prefix):
            continue

        result.append({
            "course_code": course_code,
            "course_name": final_name,
            "credits": course.credits,
            "suggested_year": curr_course.suggested_year,
            "suggested_semester": curr_course.suggested_semester
        })

    return result

# ✅ อัปเดต Model ให้รับแยก T และ L ได้
class BatchItem(BaseModel):
    course_code: str
    section_number: str
    section_type: str  # ส่ง T หรือ L แยกกันมาเลย

class BatchCartRequest(BaseModel):
    student_id: str
    items: List[BatchItem]

@app.post("/cart/batch_add_with_check")
def batch_add_cart(req: BatchCartRequest, db: Session = Depends(get_db)):
    cart_items = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == req.student_id).all()
    
    def get_time_slots(course_code, sec_num, sec_type):
        slots = db.query(ClassSection).filter(
            ClassSection.course_id == course_code, 
            cast(ClassSection.section_number, String) == str(sec_num)
        ).all()
        return [s for s in slots if get_section_type_from_room(s.room or "") == sec_type]

    current_schedule = []
    for ci in cart_items:
        current_schedule.extend(get_time_slots(ci.course_id, ci.section_number, ci.section_type or "T"))
        
    conflicts = []
    to_add = []
    
    for req_item in req.items:
        req_slots = get_time_slots(req_item.course_code, req_item.section_number, req_item.section_type)
        is_conflict = False
        
        for rs in req_slots:
            if not rs.start_time or not rs.end_time: continue
            for cs in current_schedule + to_add:
                if not cs.start_time or not cs.end_time: continue
                if rs.day_of_week == cs.day_of_week:
                    if max(rs.start_time, cs.start_time) < min(rs.end_time, cs.end_time):
                        is_conflict = True
                        break
            if is_conflict: break
            
        if is_conflict:
            # หา Sec สำรองเฉพาะ Type เดียวกัน (T หา T สำรอง, L หา L สำรอง)
            all_secs = db.query(ClassSection).filter(ClassSection.course_id == req_item.course_code).all()
            valid_secs = [s for s in all_secs if get_section_type_from_room(s.room or "") == req_item.section_type]
            sec_nums = list(set([str(s.section_number) for s in valid_secs]))
            
            alt_sec = None
            for sn in sec_nums:
                if sn == req_item.section_number: continue
                sn_slots = get_time_slots(req_item.course_code, sn, req_item.section_type)
                sn_conflict = False
                for sns in sn_slots:
                    if not sns.start_time or not sns.end_time: continue
                    for cs in current_schedule + to_add:
                        if not cs.start_time or not cs.end_time: continue
                        if sns.day_of_week == cs.day_of_week:
                            if max(sns.start_time, cs.start_time) < min(sns.end_time, cs.end_time):
                                sn_conflict = True
                                break
                    if sn_conflict: break
                if not sn_conflict:
                    alt_sec = sn
                    break 
                    
            conflicts.append({
                "course_code": req_item.course_code,
                "section_type": req_item.section_type,
                "requested_section": req_item.section_number,
                "suggested_section": alt_sec
            })
        else:
            to_add.extend(req_slots)

    if conflicts:
        return {"status": "conflict", "conflicts": conflicts}
        
    for req_item in req.items:
        exists = db.query(EnrollmentCart).filter_by(
            student_id=req.student_id, course_id=req_item.course_code, section_type=req_item.section_type
        ).first()
        if not exists:
            new_cart = EnrollmentCart(
                student_id=req.student_id,
                course_id=req_item.course_code,
                section_number=req_item.section_number,
                section_type=req_item.section_type
            )
            db.add(new_cart)
    db.commit()
    return {"status": "success"}

# =============================================================
# 6. ตารางเรียน & ลบวิชา
# =============================================================

@app.get("/enroll/my/{student_id}")
def get_my_schedule(student_id: str, db: Session = Depends(get_db)):
    enrollments = db.query(Enrollment).filter(Enrollment.student_id == student_id).all()
    if not enrollments:
        return []
    
    result = []
    for en in enrollments:
        course = db.query(Course).filter(Course.course_id == en.course_id).first()
        if not course: continue

        sections = db.query(ClassSection).filter(
            ClassSection.course_id == en.course_id,
            ClassSection.section_number == en.section_number
        ).all()

        for sec in sections:
            sec_type = get_section_type_from_room(sec.room or "")
            
            # 📌 กรองเอาเฉพาะ Type ที่ตรงกับที่เราลงทะเบียนไว้เท่านั้น!
            if hasattr(en, 'section_type') and en.section_type:
                if sec_type != en.section_type:
                    continue

            result.append({
                "course_code": course.course_id,
                "course_name": course.course_name,
                "credits": course.credits,
                "section_number": sec.section_number,
                "type": sec_type,
                "day_of_week": sec.day_of_week,
                "start_time": str(sec.start_time) if sec.start_time else "",
                "end_time": str(sec.end_time) if sec.end_time else "",
                "room": sec.room,
                #ใช้ instructor.instructor_name แทน instructor_id เพื่อให้ได้ชื่ออาจารย์มาแสดงผลในตารางเรียน
                "instructor_name": sec.instructor.instructor_name if sec.instructor else "ไม่ระบุ",
            })
            
    return result

@app.post("/cart/remove")
def remove_cart_item_post(request: RemoveCartRequest, db: Session = Depends(get_db)):
    items = db.query(EnrollmentCart).filter(
        EnrollmentCart.student_id == request.student_id,
        EnrollmentCart.course_id == request.course_code,
    ).all()
    if not items:
        raise HTTPException(status_code=404, detail="ไม่พบวิชานี้ในตะกร้า")
    for item in items:
        db.delete(item)
    db.commit()
    return {"message": "ลบออกจากตะกร้าสำเร็จ"}




from typing import Optional # เช็กด้วยว่าข้างบนสุดของไฟล์ import หรือยัง

@app.delete("/cart/remove/{student_id}/{course_code}")
def remove_from_cart(student_id: str, course_code: str, section_type: Optional[str] = None, db: Session = Depends(get_db)):
    # 1. ค้นหาวิชาและรหัสนักศึกษา
    query = db.query(EnrollmentCart).filter(
        EnrollmentCart.student_id == student_id,
        EnrollmentCart.course_id == course_code
    )
    
    # 2. ✅ ถ้ามีการส่ง section_type (T หรือ L) มา ให้ลบเฉพาะตัวนั้น
    if section_type:
        query = query.filter(EnrollmentCart.section_type == section_type)
        
    deleted_count = query.delete()
    db.commit()
    
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="ไม่พบวิชานี้ในตะกร้า")
        
    return {"message": "ลบวิชาออกจากตะกร้าสำเร็จ"}


@app.get("/sections/{course_code}")
def get_course_sections(course_code: str, db: Session = Depends(get_db)):
    sections = db.query(ClassSection).filter(ClassSection.course_id == course_code).all()
    return [
        {
            "section_id": sec.section_id,
            "section_number": str(sec.section_number),
            "type": get_section_type_from_room(sec.room or ""),  # ✅ จากชื่อห้องจริง
            "day_of_week": sec.day_of_week,
            "start_time": sec.start_time.strftime('%H:%M') if sec.start_time else "00:00",
            "end_time": sec.end_time.strftime('%H:%M') if sec.end_time else "00:00",
            "room": sec.room,
            "max_seats": sec.max_seats,
            "enrolled_seats": sec.enrolled_seats,
        }
        for sec in sections
    ]

# --- Endpoint สำหรับวิชาหมวด Z ---
@app.get("/z-options/{student_id}/{z_course_code}")
def get_z_course_options(student_id: str, z_course_code: str, db: Session = Depends(get_db)):
    # 1. ดึงข้อมูลนักศึกษา
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 2. ดึงข้อมูลวิชา Z จากหลักสูตรเพื่อดูเงื่อนไข
    z_curr = db.query(CurriculumCourse).filter(
        CurriculumCourse.course_id == z_course_code,
        CurriculumCourse.major == student.major
    ).first()
    z_course = db.query(Course).filter(Course.course_id == z_course_code).first()

    if not z_course:
        raise HTTPException(status_code=404, detail="ไม่พบรหัสวิชา Z ในระบบ")

    target_credits = z_course.credits
    target_group = z_curr.secondcourse_group if z_curr else None

    # 3. สร้าง Query ค้นหาวิชาที่เข้าเงื่อนไข
    query = db.query(Course).join(CurriculumCourse, Course.course_id == CurriculumCourse.course_id)
    
    # กรองไม่เอาวิชาที่ขึ้นต้นด้วย Z
    query = query.filter(~Course.course_id.startswith('Z'))
    
    # กรองหน่วยกิตให้เท่ากัน
    if target_credits:
        query = query.filter(Course.credits == target_credits)

    # กรองตามหมวดวิชา (secondcourse_group)
    if target_group:
        if target_group == "เสรี":
            # ถ้าเป็นเลือกเสรี ให้เลือกวิชาที่เป็นเสรีได้หมด (หน่วยกิตตรง)
            query = query.filter(CurriculumCourse.secondcourse_group == "เสรี")
        else:
            # ถ้าเป็นวิชาเฉพาะ/วิชาโท ต้องตรงกับ Faculty และ Major ของเด็ก
            query = query.filter(
                CurriculumCourse.secondcourse_group == target_group,
                CurriculumCourse.faculty == student.faculty,
                CurriculumCourse.major == student.major
            )

    eligible_courses = query.distinct().all()

    # 4. จัดรูปแบบส่งกลับไปยัง Frontend พร้อม Section
    result = []
    for course in eligible_courses:
        sections = db.query(ClassSection).filter(ClassSection.course_id == course.course_id).all()
        if not sections: continue # ไม่เอาวิชาที่ไม่ได้เปิด sec
        
        sec_list = []
        for sec in sections:
            sec_list.append({
                "section_number": str(sec.section_number),
                "type": "T", # สมมติฐานเป็นทฤษฎี หรืออิงตามฟิลด์จริง
                "day_of_week": sec.day_of_week,
                "start_time": str(sec.start_time) if sec.start_time else "",
                "end_time": str(sec.end_time) if sec.end_time else "",
                "room": sec.room or "ไม่ระบุ",
                "instructor": sec.instructor_id or "ไม่ระบุ",
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


# ---------------- ระบบเพื่อนช่วยลง (Group Sync) ----------------

@app.post("/group/create/{student_id}")
def create_group(student_id: str, db: Session = Depends(get_db)):
    
    # 🌟 1. เช็คก่อนเลยว่าคนนี้มีกลุ่มหรือยัง?
    existing_member = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if existing_member:
        # ถ้ามีกลุ่มแล้ว ให้โยน Error 400 กลับไปพร้อมข้อความเตือน
        raise HTTPException(status_code=400, detail="คุณมีกลุ่มอยู่แล้ว ไม่สามารถสร้างกลุ่มใหม่ได้")

    # --- โค้ดเดิมของคุณต่อจากนี้ ---
    # 2. สร้างรหัสกลุ่มแบบสุ่ม
    new_code = generate_random_code() 
    
    # 3. สร้างกลุ่มลงตาราง study_group
    new_group = StudyGroup(leader_id=student_id, group_code=new_code)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    
    # 4. แอดตัวเองเข้าตาราง group_member
    new_member = GroupMember(
        group_id=new_group.group_id, 
        student_id=student_id,       
        status="APPROVED"            
    )
    db.add(new_member)
    db.commit()

    return {"message": "สร้างกลุ่มสำเร็จ", "group_code": new_code}

@app.post("/group/join/{student_id}/{group_code}")
def join_group(student_id: str, group_code: str, db: Session = Depends(get_db)):
    group = db.query(StudyGroup).filter(StudyGroup.group_code == group_code).first()
    if not group: 
        raise HTTPException(status_code=404, detail="รหัสกลุ่มไม่ถูกต้อง")
    
    exist = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if exist: 
        raise HTTPException(status_code=400, detail="คุณอยู่ในกลุ่มอื่น หรือ มีคำขอค้างอยู่แล้ว")
    
    member_count = db.query(GroupMember).filter(GroupMember.group_id == group.group_id, GroupMember.status == "APPROVED").count()
    if member_count >= 5: 
        raise HTTPException(status_code=400, detail="กลุ่มนี้เต็มแล้ว (สูงสุด 5 คน)")
    
    student = db.query(Student).filter(Student.student_id == student_id).first()
    leader = db.query(Student).filter(Student.student_id == group.leader_id).first()
    
    if student.faculty != leader.faculty or student.major != leader.major or student.curriculum_year != leader.curriculum_year:
        raise HTTPException(status_code=400, detail="ต้องอยู่คณะ สาขา และชั้นปีเดียวกันเท่านั้น")
        
    new_member = GroupMember(group_id=group.group_id, student_id=student_id, status="PENDING")
    db.add(new_member)
    db.commit()
    return {"message": "ส่งคำขอแล้ว รอหัวหน้ากลุ่มอนุมัติ"}

@app.get("/group/my/{student_id}")
def get_my_group(student_id: str, db: Session = Depends(get_db)):
    member_info = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if not member_info:
        return {"group": None}

    group = db.query(StudyGroup).filter(StudyGroup.group_id == member_info.group_id).first()
    members = db.query(GroupMember, Student).join(Student, GroupMember.student_id == Student.student_id)\
                .filter(GroupMember.group_id == group.group_id).all()

    # 1. ดึงข้อมูลแบบ Join ปกติ (ลบเงื่อนไข section_type ออกจาก Join)
    raw_cart = db.query(EnrollmentCart, Course, ClassSection)\
        .join(Course, EnrollmentCart.course_id == Course.course_id)\
        .outerjoin(ClassSection, 
            (EnrollmentCart.course_id == ClassSection.course_id) & 
            (EnrollmentCart.section_number == cast(ClassSection.section_number, String))
        )\
        .filter(EnrollmentCart.student_id == group.leader_id).all()

    # 2. จัดกลุ่มข้อมูลและกรองประเภท (T/L) ด้วย Python
    processed_cart = {}
    for ec, c, cs in raw_cart:
        # คำนวณหาประเภท (T หรือ L) จากชื่อห้อง
        current_sec_type = get_section_type_from_room(cs.room or "") if cs else "-"
        
        # 🌟 กรองตรงนี้: ถ้าวิชานี้ในตะกร้าเป็น T แต่แถวที่ดึงมาเป็น L (หรือสลับกัน) ให้ข้ามไป
        if ec.section_type and current_sec_type != ec.section_type:
            continue

        # สร้าง key สำหรับเช็กตัวซ้ำ (รหัสวิชา + เซค + ประเภท)
        cart_key = (ec.course_id, ec.section_number, ec.section_type)
        
        if cart_key not in processed_cart:
            processed_cart[cart_key] = {
                "course_code": c.course_id,
                "course_name": c.course_name,
                "section": ec.section_number,
                "section_type": ec.section_type or "-",
                "day": cs.day_of_week if cs else "-",
                "time_info": f"{cs.start_time} - {cs.end_time}" if cs and cs.start_time else "",
                "enrolled_seats": cs.enrolled_seats if cs else 0,
                "max_seats": cs.max_seats if cs else 0
            }
        else:
            # ถ้าเป็นวิชาเดียวกันแต่เรียนหลายวัน ให้เอาวันมาต่อกัน
            if cs and cs.day_of_week and cs.day_of_week not in processed_cart[cart_key]["day"]:
                processed_cart[cart_key]["day"] += f", {cs.day_of_week}"

    return {
        "group": group,
        "is_leader": group.leader_id == student_id,
        "leader_cart": list(processed_cart.values()),
        "members": [{
            "student_id": m.student_id,
            "name": s.name,
            "avatar_url": s.avatar_url,
            "status": m.status,
            "is_ready": m.is_ready,
            "has_seen_registered_alert": m.has_seen_registered_alert
        } for m, s in members]
    }

@app.post("/group/mark-seen-registered/{student_id}")
def mark_seen_registered(student_id: str, db: Session = Depends(get_db)):
    member = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="ไม่พบสมาชิก")
    member.has_seen_registered_alert = True
    db.commit()
    return {"message": "บันทึกการรับทราบการลงทะเบียนสำเร็จ"}

# 2. API สำหรับสมาชิกกด "ยืนยันความพร้อม"
@app.post("/group/ready/{student_id}")
def toggle_ready(student_id: str, db: Session = Depends(get_db)):
    member = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if not member: 
        raise HTTPException(status_code=404, detail="ไม่พบสมาชิก")
    
    # ✅ 1. ต้องมีบรรทัดนี้เพื่อสลับค่า True/False
    member.is_ready = not member.is_ready 
    
    # 2. อัปเดตเวลาเพื่อให้ฝั่ง Frontend รู้ตัวว่ามีการเปลี่ยนแปลง
    group = db.query(StudyGroup).filter(StudyGroup.group_id == member.group_id).first()
    if group:
        group.last_synced_at = datetime.datetime.utcnow()
    
    # ✅ 3. บันทึกข้อมูลลง Database
    db.commit()
    
    return {"is_ready": member.is_ready}

# 3. API สำหรับหัวหน้ากด "ลงทะเบียนทั้งกลุ่ม"
@app.post("/group/register-all/{leader_id}")
def register_group_all(leader_id: str, db: Session = Depends(get_db)):
    group = db.query(StudyGroup).filter(StudyGroup.leader_id == leader_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="ไม่พบกลุ่ม")

    approved_members = db.query(GroupMember).filter(
        GroupMember.group_id == group.group_id, 
        GroupMember.status == "APPROVED"
    ).all()

    for member in approved_members:
        if member.student_id == leader_id: continue 
        if not member.is_ready:
            raise HTTPException(status_code=400, detail=f"สมาชิกยังไม่พร้อม: {member.student_id}")

    leader_cart = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == leader_id).all()
    if not leader_cart:
        raise HTTPException(status_code=400, detail="ตะกร้าของหัวหน้ากลุ่มว่างเปล่า")

    # กระบวนการลงทะเบียน
    for member in approved_members:
        for item in leader_cart:
            exist = db.query(Enrollment).filter(
                Enrollment.student_id == member.student_id,
                Enrollment.course_id == item.course_id,
                Enrollment.section_type == item.section_type
            ).first()
            
            if not exist:
                # อัปเดตที่นั่ง
                sections = db.query(ClassSection).filter(
                    ClassSection.course_id == item.course_id,
                    ClassSection.section_number == item.section_number
                ).all()
                for s in sections:
                    if get_section_type_from_room(s.room or "") == item.section_type:
                        if s.max_seats and s.enrolled_seats >= s.max_seats:
                            raise HTTPException(status_code=400, detail=f"วิชา {item.course_id} ที่นั่งเต็มแล้ว")
                        s.enrolled_seats += 1
                        break

                new_enroll = Enrollment(
                    student_id=member.student_id,
                    course_id=item.course_id,
                    section_number=item.section_number,
                    section_type=item.section_type
                )
                db.add(new_enroll)
        
        db.query(EnrollmentCart).filter(EnrollmentCart.student_id == member.student_id).delete()

    group.is_registered = True
    group.last_action = "REGISTERED"
    db.commit()
    return {"message": "ลงทะเบียนให้สมาชิกทุกคนในกลุ่มสำเร็จ!"}

@app.post("/group/approve/{leader_id}/{target_id}/{action}")
def approve_member(leader_id: str, target_id: str, action: str, db: Session = Depends(get_db)):
    group = db.query(StudyGroup).filter(StudyGroup.leader_id == leader_id).first()
    if not group: raise HTTPException(status_code=403, detail="คุณไม่ใช่หัวหน้ากลุ่ม")
    
    target = db.query(GroupMember).filter(GroupMember.group_id == group.group_id, GroupMember.student_id == target_id).first()
    if not target: raise HTTPException(status_code=404, detail="ไม่พบคำขอ")
    
    if action == "APPROVE":
        count = db.query(GroupMember).filter(GroupMember.group_id == group.group_id, GroupMember.status == "APPROVED").count()
        if count >= 5: raise HTTPException(status_code=400, detail="กลุ่มเต็มแล้ว อนุมัติเพิ่มไม่ได้")
        target.status = "APPROVED"
    elif action == "REJECT":
        db.delete(target) # ใช้สำหรับเตะคนออกด้วย
        
    db.commit()
    return {"message": f"ดำเนินการ {action} สำเร็จ"}

@app.post("/group/sync/{leader_id}")
def sync_group_cart(leader_id: str, db: Session = Depends(get_db)):
    group = db.query(StudyGroup).filter(StudyGroup.leader_id == leader_id).first()
    if not group: raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์ Sync")
    
    leader_cart = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == leader_id).all()
    if not leader_cart:
        raise HTTPException(status_code=400, detail="ตะกร้าของหัวหน้ากลุ่มว่างเปล่า กรุณาเลือกวิชาก่อน Sync")

    approved_members = db.query(GroupMember).filter(GroupMember.group_id == group.group_id, GroupMember.status == "APPROVED").all()
    
    # ดึงข้อมูลเวลาเรียนของตะกร้าหัวหน้ามาไว้เช็คชน
    def get_slots(c_id, s_num, s_type):
        return [s for s in db.query(ClassSection).filter(ClassSection.course_id==c_id, cast(ClassSection.section_number, String)==str(s_num)).all() 
                if get_section_type_from_room(s.room or "") == s_type]
    
    leader_slots = []
    for item in leader_cart:
        leader_slots.extend(get_slots(item.course_id, item.section_number, item.section_type or "T"))

    for member in approved_members:
        if member.student_id == leader_id: continue 
        
        # 1. เช็ควิชาซ้ำกับตารางเรียนจริงของสมาชิก
        member_enrolls = db.query(Enrollment).filter(Enrollment.student_id == member.student_id).all()
        for le in leader_cart:
            if any(me.course_id == le.course_id and me.section_type == le.section_type for me in member_enrolls):
                raise HTTPException(status_code=400, detail=f"สมาชิก {member.student_id} มีวิชา {le.course_id} ในตารางเรียนแล้ว")

        # 2. เช็คเวลาชนกับตารางเรียนจริงของสมาชิก
        for ls in leader_slots:
            if not ls.start_time or not ls.end_time: continue
            for me in member_enrolls:
                me_secs = db.query(ClassSection).filter(ClassSection.course_id==me.course_id, cast(ClassSection.section_number, String)==str(me.section_number)).all()
                for mes in me_secs:
                    if get_section_type_from_room(mes.room or "") != (me.section_type or "T"): continue
                    if ls.day_of_week == mes.day_of_week:
                        if max(ls.start_time, mes.start_time) < min(ls.end_time, mes.end_time):
                            raise HTTPException(status_code=400, detail=f"วิชา {ls.course_id} ของหัวหน้า ชนกับวิชา {me.course_id} ในตารางเรียนของสมาชิก {member.student_id}")

        # ถ้าผ่านการเช็ค ให้เคลียร์ตะกร้าเก่าและ Sync ใหม่
        db.query(EnrollmentCart).filter(EnrollmentCart.student_id == member.student_id).delete()
        for item in leader_cart:
            new_item = EnrollmentCart(
                student_id=member.student_id, course_id=item.course_id,
                section_number=item.section_number, section_type=item.section_type
            )
            db.add(new_item)
            
    group.last_synced_at = datetime.datetime.utcnow() 
    group.last_action = "SYNC"
    group.is_registered = False # 🌟 Reset registration status on new sync
    db.commit()
    return {"message": "Sync ตะกร้าให้สมาชิกสำเร็จ"}

@app.delete("/group/leave/{student_id}")
def leave_group(student_id: str, db: Session = Depends(get_db)):
    member = db.query(GroupMember).filter(GroupMember.student_id == student_id).first()
    if not member: raise HTTPException(status_code=404, detail="คุณไม่ได้อยู่ในกลุ่มใด")
    db.delete(member)
    db.commit()
    return {"message": "ออกจากกลุ่มสำเร็จ"}

@app.delete("/group/delete/{leader_id}")
def delete_group(leader_id: str, db: Session = Depends(get_db)):
    group = db.query(StudyGroup).filter(StudyGroup.leader_id == leader_id).first()
    if not group: raise HTTPException(status_code=403, detail="คุณไม่ใช่หัวหน้ากลุ่ม")
    db.delete(group) # จะลบสมาชิกทั้งหมดในกลุ่มออกด้วยอัตโนมัติจาก ON DELETE CASCADE
    db.commit()
    return {"message": "ยุบกลุ่มสำเร็จ"}

@app.post("/cart/confirm/{student_id}")
def confirm_enrollment(student_id: str, db: Session = Depends(get_db)):
    # 1. ดึงวิชาทั้งหมดในตะกร้าของนักศึกษาคนนี้
    cart_items = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == student_id).all()
    
    if not cart_items:
        raise HTTPException(status_code=400, detail="ตะกร้าว่างเปล่า ไม่มีวิชาให้ยืนยันการลงทะเบียน")

    # 2. ย้ายข้อมูลจากตะกร้าไปที่ตาราง Enrollment (ตารางเรียนจริง)
    for item in cart_items:
        # เช็คก่อนว่าเคยลงทะเบียนวิชา+Type นี้ไปแล้วหรือยัง (กันลงซ้ำ)
        existing = db.query(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.course_id == item.course_id,
            Enrollment.section_type == item.section_type
        ).first()
        
        if not existing:
            # 🌟 แก้ไขตรงนี้: ดึง ClassSection มาทั้งหมดก่อน (ตัด .filter(section_type) ออก)
            sections = db.query(ClassSection).filter(
                ClassSection.course_id == item.course_id,
                ClassSection.section_number == item.section_number
            ).all()

            target_section = None
            
            # 🌟 ใช้ Python วนลูปหา Section ที่เป็น ทฤษฎี หรือ ปฏิบัติ ตามที่อยู่ในตะกร้า
            for s in sections:
                # เรียกใช้ฟังก์ชันแปลงชื่อห้องเป็น Type เหมือนที่คุณใช้ในจุดอื่นๆ
                s_type = get_section_type_from_room(s.room or "")
                if s_type == item.section_type:
                    target_section = s
                    break
            
            # ถ้าหาเป๊ะๆ ไม่เจอ ให้ดึงตัวแรกมาจัดการแทน (Fallback)
            if not target_section and sections:
                target_section = sections[0]

            if target_section:
                # เช็คว่าที่นั่งเต็มไหม
                cap = target_section.max_seats or 0
                enr = target_section.enrolled_seats or 0
                
                if cap > 0 and enr >= cap:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"ไม่สามารถลงทะเบียนได้: วิชา {item.course_id} กลุ่ม {item.section_number} ที่นั่งเต็มแล้ว"
                    )
                
                # เพิ่มยอดคนลงทะเบียน (+1)
                target_section.enrolled_seats = enr + 1

            # บันทึกวิชาลงตาราง Enrollment (ตารางเรียนหลัก)
            new_enrollment = Enrollment(
                student_id=student_id,
                course_id=item.course_id,
                section_number=item.section_number,
                section_type=item.section_type
            )
            db.add(new_enrollment)
            
    # 3. ลบวิชาออกจากตะกร้า หลังจากย้ายไปตารางเรียนแล้ว
    db.query(EnrollmentCart).filter(EnrollmentCart.student_id == student_id).delete()
    
    # 4. ยืนยันการบันทึกข้อมูลทั้งหมดลงฐานข้อมูล
    db.commit()
    
    return {"message": "ลงทะเบียนสำเร็จ"}

# =============================================================
# API สำหรับถอนรายวิชา
# =============================================================
@app.post("/enrollment/withdraw")
def withdraw_course(data: dict, db: Session = Depends(get_db)):
    student_id = data.get("student_id")
    course_code = data.get("course_code")
    section_type = data.get("section_type")

    # 1. ลบวิชาออกจากตารางเรียน (ตาราง Enrollment น่าจะมี section_type ตามที่คุณเคยลงไป)
    # ถ้าตาราง Enrollment ของคุณก็ไม่มี section_type ให้ลบบรรทัด Enrollment.section_type ทิ้งไปเลยครับ
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == student_id,
        Enrollment.course_id == course_code,
        Enrollment.section_type == section_type
    ).first()

    if not enrollment:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลการลงทะเบียนวิชานี้")

    # เก็บหมายเลขกลุ่มเรียนไว้ก่อนลบ เพื่อเอาไปคืนค่าที่นั่งให้ถูกกลุ่ม
    sec_num = enrollment.section_number 

    # ลบออกจากตารางเรียน
    db.delete(enrollment)

    # 2. คืนค่าที่นั่ง (ลบ enrolled_seats - 1)
    # 🌟 แก้ไขตรงนี้: เปลี่ยนจากการหาด้วย section_type เป็นหาด้วย section_number แทน
    section_to_update = db.query(ClassSection).filter(
        ClassSection.course_id == course_code,
        ClassSection.section_number == sec_num
    ).all()

    # บางวิชามี 2 แถว (ทฤษฎี/ปฏิบัติ) ใน 1 กลุ่มเรียน เลยต้องวนลูปเผื่อไว้
    for sec in section_to_update:
        if sec.enrolled_seats > 0:
            sec.enrolled_seats -= 1
        
    db.commit()
    return {"status": "success", "message": "ถอนรายวิชาสำเร็จ"}


Base.metadata.create_all(bind=engine)