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
            "avatar_url": student.avatar_url
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

    current_year = calculate_student_year(student_id)

    results = (
        db.query(Course, CurriculumCourse)
        .join(CurriculumCourse, Course.course_id == CurriculumCourse.course_id)
        .filter(
            CurriculumCourse.faculty == student.faculty,
            CurriculumCourse.major == student.major,
            CurriculumCourse.curriculum_year == student.curriculum_year,
            CurriculumCourse.suggested_year == current_year,
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

@app.post("/ai-suggest")
def ai_suggest(data: dict, db: Session = Depends(get_db)):
    course_codes = list(set(data.get("course_codes", [])))

    if len(course_codes) > MAX_AI_COURSES:
        raise HTTPException(
            status_code=400,
            detail=f"เลือกได้สูงสุด {MAX_AI_COURSES} วิชาต่อครั้ง"
        )

    all_course_options = []

    for code in course_codes:
        secs = db.query(ClassSection).filter(ClassSection.course_id == code).all()
        if not secs:
            continue

        theory_secs = [s for s in secs if "(ท)" in str(s.room or "")]
        practice_secs = [s for s in secs if "(ป)" in str(s.room or "")]
        other_secs = [s for s in secs if s not in theory_secs and s not in practice_secs]

        course_options = []
        if theory_secs and practice_secs:
            course_options = [[t, p] for t, p in product(theory_secs, practice_secs)]
        elif theory_secs:
            course_options = [[t] for t in theory_secs]
        elif practice_secs:
            course_options = [[p] for p in practice_secs]
        else:
            course_options = [[o] for o in other_secs]

        if course_options:
            all_course_options.append(course_options)

    if not all_course_options:
        raise HTTPException(status_code=400, detail="ไม่พบกลุ่มเรียนสำหรับวิชาที่เลือก")

    valid_plans = []
    for plan_combinations in product(*all_course_options):
        flat_plan = [sec for item in plan_combinations for sec in item]
        if not is_conflict(flat_plan):
            valid_plans.append(format_plan(flat_plan))
        if len(valid_plans) >= MAX_AI_PLANS:
            break

    if not valid_plans:
        raise HTTPException(
            status_code=400,
            detail="ไม่สามารถจัดตารางที่ไม่ชนกันได้เลย ลองลดจำนวนวิชาลงนะครับ"
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

    # เช็กลงทะเบียนจริงไปแล้ว
    already_enrolled = db.query(Enrollment).filter(
        Enrollment.student_id == request.student_id,
        Enrollment.course_id == request.course_code,
        Enrollment.section_number == sec_num_str,
    ).first()
    if already_enrolled:
        raise HTTPException(status_code=400, detail="คุณได้ลงทะเบียนกลุ่มเรียนนี้ไปแล้ว")

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
        times = []
        if sec_int is not None:
            for r in section_map.get((item.course_id, sec_int), []):
                # ✅ กรองเฉพาะ row ที่ตรง type
                row_type = get_section_type_from_room(r.room or "")
                if row_type != (item.section_type or "T"):
                    continue
                if r.start_time and r.end_time:
                    time_str = f"{r.day_of_week} {r.start_time.strftime('%H:%M')}-{r.end_time.strftime('%H:%M')}"
                    if time_str not in times:
                        times.append(time_str)

        result.append({
            "course_name": course.course_name,
            "course_code": item.course_id,
            "credits": course.credits,
            "section_number": item.section_number,
            "section_type": item.section_type or "T",  # ✅ ส่ง T/L กลับด้วย
            "time_info": " | ".join(times),
        })
    return result


# =============================================================
# 5. ยืนยันการลงทะเบียน + เพิ่ม enrolled_seats
# =============================================================

@app.post("/enroll/confirm/{student_id}")
def confirm_enrollment(student_id: str, db: Session = Depends(get_db)):
    cart_items = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == student_id).all()
    if not cart_items:
        raise HTTPException(status_code=400, detail="ตะกร้าว่างเปล่า")

    for item in cart_items:
        # ตรวจสอบว่าเคยลงวิชานี้และ section_type นี้หรือยัง
        existing = db.query(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.course_id == item.course_id,
            Enrollment.section_type == item.section_type  # 📌 เช็คแยก T กับ L
        ).first()
        
        if existing:
            continue

        new_enroll = Enrollment(
            student_id=student_id,
            course_id=item.course_id,
            section_number=item.section_number,
            section_type=item.section_type  # 📌 บันทึก Type ลงฐานข้อมูลด้วย
        )
        db.add(new_enroll)

    for item in cart_items:
        db.delete(item)

    db.commit()
    return {"message": "ยืนยันการลงทะเบียนสำเร็จ"}

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
                "room": sec.room
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


@app.delete("/cart/remove/{student_id}/{course_code}")
def remove_cart_item_delete(student_id: str, course_code: str, db: Session = Depends(get_db)):
    items = db.query(EnrollmentCart).filter(
        EnrollmentCart.student_id == student_id,
        EnrollmentCart.course_id == course_code,
    ).all()
    if not items:
        raise HTTPException(status_code=404, detail="ไม่พบวิชานี้ในตะกร้า")
    for item in items:
        db.delete(item)
    db.commit()
    return {"message": "ลบออกจากตะกร้าสำเร็จ"}


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
                "enrolled": cs.enrolled_seats if cs else 0,
                "capacity": cs.max_seats if cs else 0
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
            "avatar_url": s.avatar_url,  # <--- ต้องมีบรรทัดนี้ส่งไปด้วย!
            "status": m.status,
            "is_ready": m.is_ready 
        } for m, s in members]
    }

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

    # 1. ดึงสมาชิกที่ได้รับการอนุมัติทั้งหมด (ใช้ .all() เพื่อให้เป็น List ที่วนลูปได้)
    approved_members = db.query(GroupMember).filter(
        GroupMember.group_id == group.group_id, 
        GroupMember.status == "APPROVED"
    ).all()

    # 2. เช็คความพร้อมของสมาชิก (ยกเว้นหัวหน้า)
    for member in approved_members:
        if member.student_id == leader_id:
            continue 
            
        if not member.is_ready:
            # ส่งรหัสนักศึกษาคนที่ไม่พร้อมกลับไปบอกหัวหน้า
            raise HTTPException(status_code=400, detail=f"สมาชิกยังไม่พร้อม: {member.student_id}")

    # 3. ถ้าทุกคนพร้อมแล้ว เริ่มกระบวนการลงทะเบียน (Copy ตะกร้าหัวหน้าไปลงทะเบียนให้ทุกคน)
    leader_cart = db.query(EnrollmentCart).filter(EnrollmentCart.student_id == leader_id).all()
    if not leader_cart:
        raise HTTPException(status_code=400, detail="ตะกร้าของหัวหน้ากลุ่มว่างเปล่า")

    for member in approved_members:
        for item in leader_cart:
            # เช็คว่าเคยลงไปหรือยัง
            exist = db.query(Enrollment).filter(
                Enrollment.student_id == member.student_id,
                Enrollment.course_id == item.course_id,
                Enrollment.section_type == item.section_type
            ).first()
            
            if not exist:
                new_enroll = Enrollment(
                    student_id=member.student_id,
                    course_id=item.course_id,
                    section_number=item.section_number,
                    section_type=item.section_type
                )
                db.add(new_enroll)
        
        # ลบตะกร้าของสมาชิกคนนั้นๆ ออกด้วยหลังจากลงทะเบียนเสร็จ
        db.query(EnrollmentCart).filter(EnrollmentCart.student_id == member.student_id).delete()

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
    approved_members = db.query(GroupMember).filter(GroupMember.group_id == group.group_id, GroupMember.status == "APPROVED").all()
    
    for member in approved_members:
        if member.student_id == leader_id: continue 
        db.query(EnrollmentCart).filter(EnrollmentCart.student_id == member.student_id).delete()
        for item in leader_cart:
            new_item = EnrollmentCart(
                student_id=member.student_id, course_id=item.course_id,
                section_number=item.section_number, section_type=item.section_type
            )
            db.add(new_item)
            
    group.last_synced_at = datetime.datetime.utcnow() # 🌟 อัปเดตเวลาตอนกด Sync
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





Base.metadata.create_all(bind=engine)