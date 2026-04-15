// api.js — จุดเดียวสำหรับ call ทุก API
// ✅ แก้ IP ที่นี่ที่เดียว ไม่ต้องแก้ทุกไฟล์

export const BASE_URL = "http://10.175.15.135:8000"; // ชี้ไปที่ Backend ตรงกัน
//export const BASE_URL = "http://localhost:8000";
// สำหรับเครื่องจริง: เปลี่ยนเป็น IP เครื่องคอม เช่น "http://192.168.1.x:8000"

/**
 * Wrapper fetch พร้อม error handling กลาง
 * ถ้า response ไม่ ok จะ throw error พร้อม detail จาก backend
 */
export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  // 1. อ่านข้อมูลเป็นข้อความดิบๆ ก่อน
  const text = await res.text();
  let data;

  try {
    // 2. พยายามแปลงเป็น JSON ถ้าปกติจะผ่านตรงนี้ไปได้
    data = JSON.parse(text);
  } catch (err) {
    // 3. ถ้าไม่ใช่ JSON (เช่นคำว่า "Internal...") ให้โยน Error ออกไปตรงๆ
    throw new Error(text || "เซิร์ฟเวอร์ตอบกลับมาเป็นรูปแบบที่ไม่รู้จัก");
  }

  if (!res.ok) {
    throw new Error(data.detail || "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
  }
  return data;
}

// --- Auth ---
export const loginAPI = (student_id, password) =>
  apiFetch("/login", {
    method: "POST",
    body: JSON.stringify({ student_id, password }),
  });

// --- Courses ---
export const getAvailableCoursesAPI = (student_id) =>
  apiFetch(`/courses/available/${student_id}`);

export const getSectionsAPI = (course_code) =>
  apiFetch(`/sections/${course_code}`);

export const getZOptionsAPI = (student_id, z_course_code) =>
  apiFetch(`/z-options/${student_id}/${z_course_code}`);

// --- Cart ---
// 🌟 เพิ่ม ?t=เวลาปัจจุบัน และใส่ Cache-Control
export const getCartAPI = (student_id) =>
  apiFetch(`/cart/${student_id}?t=${new Date().getTime()}`, { 
    method: "GET",
    headers: { "Cache-Control": "no-cache" }
  });



export const addToCartAPI = (student_id, course_code, section_number, section_type) =>
  apiFetch("/cart/add", {
    method: "POST",
    body: JSON.stringify({ 
      student_id: String(student_id), 
      course_code: String(course_code), 
      section_number: String(section_number), // 🌟 แปลงเลข 1 เป็น "1" ป้องกัน 422
      section_type: section_type ? String(section_type) : "T" 
    }),
  });

  // ดึงข้อมูล Section ทั้งหมดของวิชานั้นๆ
export const getCourseSectionsAPI = async (courseCode) => {
  // สมมติว่า Backend URL ของคุณคือ /courses/{courseCode}/sections
  // 💡(ถ้า URL หลังบ้านคุณตั้งเป็นแบบอื่น ให้เปลี่ยนตรงนี้ให้ตรงกันนะครับ)
  return apiFetch(`/courses/${courseCode}/sections`, { 
    method: "GET" 
  });
};

// แก้จากของเดิมเป็นแบบนี้
export const removeFromCartAPI = (student_id, course_code, section_type) =>
  apiFetch("/cart/remove", {
    method: "POST",
    body: JSON.stringify({ 
      student_id: String(student_id), 
      course_code: String(course_code),
      section_type: section_type ? String(section_type) : "T"
    }),
  });

// --- Enrollment ---
export const confirmEnrollmentAPI = (student_id) =>
  apiFetch(`/cart/confirm/${student_id}`, { method: "POST" });

export const getScheduleAPI = (student_id) =>
  apiFetch(`/enroll/my/${student_id}`);

// --- AI ---
export const aiSuggestAPI = (student_id, course_codes) =>
  apiFetch("/ai-suggest", {
    method: "POST",
    body: JSON.stringify({ student_id, course_codes }),
  });

// --- Batch ---
export const batchAddRequiredAPI = async (student_id) => {
  const courses = await getAvailableCoursesAPI(student_id);
  const required = courses.filter((c) => c.is_required);
  for (const c of required) {
    await addToCartAPI(student_id, c.course_code, "1");
  }
  return required.length;
};

// --- Group Sync ---
export const createGroupAPI = (student_id) =>
  apiFetch(`/group/create/${student_id}`, { method: "POST" });

export const joinGroupAPI = (student_id, group_code) =>
  apiFetch(`/group/join/${student_id}/${group_code}`, { method: "POST" });

export const getMyGroupAPI = (student_id) =>
  apiFetch(`/group/my/${student_id}`, { method: "GET" });

export const approveMemberAPI = (leader_id, target_id, action) =>
  apiFetch(`/group/approve/${leader_id}/${target_id}/${action}`, {
    method: "POST",
  });

export const syncGroupCartAPI = (leader_id) =>
  apiFetch(`/group/sync/${leader_id}`, { method: "POST" });

export const leaveGroupAPI = (student_id) =>
  apiFetch(`/group/leave/${student_id}`, { method: "DELETE" });

export const deleteGroupAPI = (leader_id) =>
  apiFetch(`/group/delete/${leader_id}`, { method: "DELETE" });

// เพิ่มต่อท้ายใน api.js
export const toggleReadyAPI = (student_id) =>
  apiFetch(`/group/ready/${student_id}`, { method: "POST" });

export const markSeenRegisteredAPI = (student_id) =>
  apiFetch(`/group/mark-seen-registered/${student_id}`, { method: "POST" });

export const registerGroupAllAPI = (leader_id) =>
  apiFetch(`/group/register-all/${leader_id}`, { method: "POST" });

// --- Batch Registration & Conflict Check ---
export const getSuggestedCoursesAPI = (student_id) =>
  apiFetch(`/courses/suggested/${student_id}`, { method: "GET" });

export const batchAddWithCheckAPI = (student_id, items) =>
  apiFetch(`/cart/batch_add_with_check`, {
    method: "POST",
    body: JSON.stringify({ student_id, items }),
  });

// เพิ่มที่ไฟล์ api.js
export const getStudentGradesAPI = (student_id) =>
  apiFetch(`/grades/${student_id}`, { method: "GET" });

// --- Waitlist ---
export const joinWaitlistAPI = (student_id, course_code, section_number, section_type) =>
  apiFetch("/waitlist/join", {
    method: "POST",
    body: JSON.stringify({ 
      student_id: String(student_id), 
      course_code: String(course_code), 
      section_number: parseInt(section_number),
      section_type: section_type ? String(section_type) : "T" 
    }),
  });

export const getWaitlistStatusAPI = (student_id) =>
  apiFetch(`/waitlist/status/${student_id}`);

export const confirmWaitlistSeatAPI = (waitlist_id) =>
  apiFetch(`/waitlist/confirm/${waitlist_id}`, { method: "POST" });

export const cancelWaitlistAPI = (waitlist_id) =>
  apiFetch(`/waitlist/cancel/${waitlist_id}`, { method: "POST" });

// --- Withdraw Course ---
export const withdrawCourseAPI = (student_id, course_code, section_number, section_type) =>
  apiFetch("/enrollment/withdraw", {
    method: "POST",
    body: JSON.stringify({ 
      student_id, 
      course_code, 
      section_number, 
      section_type 
    }),
  });
