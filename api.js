// api.js — จุดเดียวสำหรับ call ทุก API
// ✅ แก้ IP ที่นี่ที่เดียว ไม่ต้องแก้ทุกไฟล์

export const BASE_URL = "http://10.230.252.135:8000";
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
export const getCartAPI = (student_id) => apiFetch(`/cart/${student_id}`);

export const addToCartAPI = (student_id, course_code, section_number) =>
  apiFetch("/cart/add", {
    method: "POST",
    body: JSON.stringify({ student_id, course_code, section_number }),
  });

// แก้จากของเดิมเป็นแบบนี้
export const removeFromCartAPI = (student_id, course_code, section_type) =>
  apiFetch(
    `/cart/remove/${student_id}/${course_code}?section_type=${section_type || ""}`,
    { method: "DELETE" },
  );

// --- Enrollment ---
export const confirmEnrollmentAPI = (student_id) =>
  apiFetch(`/enroll/confirm/${student_id}`, { method: "POST" });

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