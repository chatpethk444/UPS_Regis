// screens/ManualScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Dimensions, // 🌟 เพิ่ม Dimensions
  Modal, // 🌟 เพิ่ม Modal
} from "react-native";
import { MaterialIcons, Feather } from "@expo/vector-icons"; // 🌟 เพิ่ม Feather
import { LinearGradient } from "expo-linear-gradient";
import {
  getAvailableCoursesAPI,
  getSectionsAPI,
  addToCartAPI,
  getCartAPI,
  getZOptionsAPI,
  getScheduleAPI,
  joinWaitlistAPI,
} from "../api";

const { width } = Dimensions.get("window"); // 🌟 กำหนด width สำหรับ Modal

// 🌟 Helper Function สำหรับจัดเรียง Section (เรียงเลข Sec ก่อน แล้วเอา Theory ขึ้นก่อน Lab)
const sortSectionsArray = (sections) => {
  if (!sections) return [];
  return [...sections].sort((a, b) => {
    // 1. เรียงตาม Sec Number (น้อยไปมาก)
    const secA = parseInt(a.section_number) || 0;
    const secB = parseInt(b.section_number) || 0;
    if (secA !== secB) return secA - secB;

    // 2. ถ้า Sec Number เท่ากัน ให้เช็กว่าเป็น Lab หรือ Theory
    const isLabA =
      a.type === "L" ||
      a.section_type === "L" ||
      (a.room && String(a.room).toLowerCase().includes("lab"));
    const isLabB =
      b.type === "L" ||
      b.section_type === "L" ||
      (b.room && String(b.room).toLowerCase().includes("lab"));

    if (!isLabA && isLabB) return -1; // A (Theory) มาก่อน B (Lab)
    if (isLabA && !isLabB) return 1; // B (Theory) มาก่อน A (Lab)
    return 0;
  });
};

// ✅ แยก api.js ให้รับ section_type ด้วย
async function addToCartWithType(
  student_id,
  course_code,
  section_number,
  section_type,
) {
  const { BASE_URL } = require("../api");
  const res = await fetch(`${BASE_URL}/cart/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      student_id,
      course_code,
      section_number,
      section_type,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "เกิดข้อผิดพลาด");
  return data;
}

export default function ManualScreen({ student, setView }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true); // เริ่มมาให้หมุนโหลดเลย
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [cart, setCart] = useState([]);
  const [zOptions, setZOptions] = useState(null);
  const [schedule, setSchedule] = useState([]);

  // 🌟 State สำหรับ Custom Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    type: "info", // "success", "error", "warning"
    title: "",
    message: "",
  });

  // 🌟 2. State สำหรับ Custom Modal แบบยืนยัน (Confirm Modal)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmDetail, setConfirmDetail] = useState({
    title: "",
    message: "",
  });

  // 🌟 ฟังก์ชันจัดการปุ่มกดต่อคิว
  const handleJoinWaitlistPrompt = (course, section, sectionType) => {
    setConfirmDetail({
      title: "ยืนยันการต่อคิว",
      message: `คุณต้องการเข้าคิวรายวิชา ${course.course_code} Sec ${section.section_number} (${sectionType === "T" ? "ทฤษฎี" : "ปฏิบัติ"}) ใช่หรือไม่?\n\nเมื่อถึงคิวของคุณ ระบบจะแจ้งเตือนและให้เวลา 30 นาทีในการยืนยันสิทธิ์`,
    });

    setConfirmAction(() => async () => {
      setConfirmModalVisible(false);
      try {
        await joinWaitlistAPI(
          student.student_id,
          course.course_code,
          section.section_number,
          sectionType,
        );
        showModal(
          "เข้าคิวสำเร็จ",
          `คุณได้เข้าคิววิชา ${course.course_code} Sec ${section.section_number} เรียบร้อยแล้ว`,
          "success",
        );
      } catch (error) {
        showModal("ไม่สำเร็จ", error.message || "ไม่สามารถต่อคิวได้", "error");
      }
    });

    setConfirmModalVisible(true);
  };

  // 🌟 ฟังก์ชันเรียก Modal แจ้งเตือน
  const showModal = (title, message, type = "info") => {
    setModalConfig({ title, message, type });
    setModalVisible(true);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // ✅ ดึงข้อมูลทุกอย่างมาพร้อมกันตอนเปิดหน้า (ตะกร้า, ตาราง, รายวิชาทั้งหมด)
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [cartData, scheduleData, allCoursesData] = await Promise.all([
        getCartAPI(student.student_id).catch(() => []),
        getScheduleAPI(student.student_id).catch(() => []),
        getAvailableCoursesAPI(student.student_id).catch(() => []),
      ]);

      setCart(cartData);
      setSchedule(scheduleData);

      // 📌 กรองวิชาตามเงื่อนไข (หน้าแรก)
      const filteredCourses = allCoursesData.filter((c) => {
        if (c.suggested_semester != student.current_semester) return false;

        const courseGroup = c.course_group ? c.course_group.toLowerCase() : "";
        const isFreeElective =
          courseGroup.includes("เลือกเสรี") ||
          courseGroup.includes("free elective");

        if (isFreeElective) {
          const major = student.major || "";
          // 🌟 เช็กจากชื่อสาขาภาษาไทยตาม Log
          if (
            major.includes("วิศวกรรมคอมพิวเตอร์") &&
            c.course_code.startsWith("CPE")
          )
            return false;
          if (
            major.includes("เทคโนโลยีสารสนเทศ") &&
            c.course_code.startsWith("ICT")
          )
            return false;
          if (major.includes("โลจิสติกส์") && c.course_code.startsWith("LSM"))
            return false;
        }
        return true;
      });

      setCourses(filteredCourses);
    } catch (err) {
      showModal("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลรายวิชาได้", "error"); // 🌟 ใช้ Modal แทน Alert
    } finally {
      setLoading(false);
    }
  };

  const isTimeOverlapping = (sec1, sec2) => {
    if (!sec1.day_of_week || !sec2.day_of_week) return false;
    if (sec1.day_of_week !== sec2.day_of_week) return false;
    const toInt = (t) => parseInt((t || "").replace(":", ""));
    const s1 = toInt(sec1.start_time),
      e1 = toInt(sec1.end_time);
    const s2 = toInt(sec2.start_time),
      e2 = toInt(sec2.end_time);
    return s1 < e2 && s2 < e1;
  };

  const handleSelectCourse = async (course) => {
    if (selectedCourse?.course_code === course.course_code) {
      setSelectedCourse(null);
      setSections([]);
      setZOptions(null);
      return;
    }

    setSelectedCourse(course);
    setLoading(true);
    try {
      if (course.course_code.startsWith("Z")) {
        const options = await getZOptionsAPI(
          student.student_id,
          course.course_code,
        );

        // 📌 กรองวิชาสาขาตัวเองออกจากหมวดวิชาเลือกเสรี Z
        const major = student.major || "";
        const filteredOptions = options.filter((opt) => {
          if (
            major.includes("วิศวกรรมคอมพิวเตอร์") &&
            opt.course_code.startsWith("CPE")
          )
            return false;
          if (
            major.includes("เทคโนโลยีสารสนเทศ") &&
            opt.course_code.startsWith("ICT")
          )
            return false;
          if (major.includes("โลจิสติกส์") && opt.course_code.startsWith("LSM"))
            return false;
          return true;
        });

        // กำจัดวิชาที่ซ้ำกัน (ป้องกัน Error children with the same key)
        const uniqueOptions = Array.from(
          new Map(
            filteredOptions.map((opt) => [opt.course_code, opt]),
          ).values(),
        );

        // 🌟 เรียง Section ย่อยๆ ในแต่ละวิชา Z Option
        const sortedZOptions = uniqueOptions.map((opt) => ({
          ...opt,
          sections: sortSectionsArray(opt.sections),
        }));

        setZOptions(sortedZOptions);
        setSections([]);
      } else {
        const data = await getSectionsAPI(course.course_code);
        // 🌟 เรียง Section สำหรับวิชาปกติ
        setSections(sortSectionsArray(data));
        setZOptions(null);
      }
    } catch (e) {
      showModal("ข้อผิดพลาด", e.message, "error"); // 🌟 ใช้ Modal แทน Alert
    } finally {
      setLoading(false);
    }
  };

  const handleAddSection = async (targetCourse, section, computedType) => {
    const sectionType = computedType || "T";
    let warningMsg = "";

    // 🌟 จัดการข้อความแจ้งเตือนเมื่อลงข้ามเทอม
    if (
      targetCourse.required_semester &&
      student.current_semester < targetCourse.required_semester
    ) {
      warningMsg = `\n\n⚠️ หมายเหตุ: วิชานี้แนะนำสำหรับนักศึกษาเทอม ${targetCourse.required_semester} (คุณอยู่เทอม ${student.current_semester})`;
    }

    if (section.enrolled_seats >= section.max_seats) {
      return showModal(
        "ที่นั่งเต็ม",
        `Section ${section.section_number} (${sectionType}) เต็มแล้ว` +
          warningMsg,
        "error",
      );
    }

    const allRegistered = [...cart, ...schedule];

    const alreadyInSchedule = schedule.find(
      (i) =>
        i.course_code === targetCourse.course_code &&
        (i.section_type === sectionType || i.type === sectionType),
    );
    if (alreadyInSchedule) {
      const typeLabel = sectionType === "T" ? "ทฤษฎี (T)" : "ปฏิบัติ (L)";
      return showModal(
        "ไม่สามารถเพิ่มได้",
        `คุณได้ลงทะเบียนวิชา ${targetCourse.course_code} ${typeLabel} ไปเรียบร้อยแล้วในตารางเรียน` +
          warningMsg,
        "error",
      );
    }

    const alreadyInCart = cart.find(
      (i) =>
        i.course_code === targetCourse.course_code &&
        i.section_type === sectionType,
    );
    if (alreadyInCart) {
      const typeLabel = sectionType === "T" ? "ทฤษฎี (T)" : "ปฏิบัติ (L)";
      return showModal(
        "ไม่สามารถเพิ่มได้",
        `วิชา ${targetCourse.course_code} ${typeLabel} มีอยู่ในตะกร้าของคุณแล้ว (Sec ${alreadyInCart.section_number})\nหากต้องการเปลี่ยนกลุ่ม กรุณาลบออกจากตะกร้าก่อน` +
          warningMsg,
        "warning",
      );
    }

    const conflict = allRegistered.find((i) => isTimeOverlapping(i, section));

    if (conflict) {
      const location = cart.some((c) => c.course_code === conflict.course_code)
        ? "ตะกร้า"
        : "ตารางเรียน";

      const conflictType = conflict.section_type || conflict.type;
      let typeLabel = "";
      if (conflictType === "T") typeLabel = "(ทฤษฎี)";
      else if (conflictType === "L") typeLabel = "(ปฏิบัติ)";

      return showModal(
        "เวลาเรียนชนกัน!",
        `Sec ที่คุณเลือก มีเวลาทับซ้อนกับวิชา:\n${conflict.course_code} Sec ${conflict.section_number} ${typeLabel}\nซึ่งอยู่ใน "${location}" ของคุณแล้ว` +
          warningMsg,
        "error",
      );
    }

    try {
      await addToCartWithType(
        student.student_id,
        targetCourse.course_code,
        String(section.section_number),
        sectionType,
      );
      const typeLabel = sectionType === "T" ? "ทฤษฎี (T)" : "ปฏิบัติ (L)";

      showModal(
        "สำเร็จ",
        `เพิ่ม Sec ${section.section_number} ${typeLabel} ลงตะกร้าแล้ว` +
          warningMsg,
        "success",
      );

      // โหลดเฉพาะตะกร้ากับตารางเรียนใหม่พอ ไม่ต้องโหลดวิชาทั้งหมดใหม่
      const [newCart, newSchedule] = await Promise.all([
        getCartAPI(student.student_id).catch(() => []),
        getScheduleAPI(student.student_id).catch(() => []),
      ]);
      setCart(newCart);
      setSchedule(newSchedule);
    } catch (err) {
      showModal("ไม่สำเร็จ", err.message + warningMsg, "error");
    }
  };

  const renderSectionItem = (course, sec, index) => {
    const isFull = sec.enrolled_seats >= sec.max_seats;

    // 🌟 แก้ไขการเช็ก Lab ให้ดูจากค่า type และ room ตรงๆ
    const isLab =
      sec.type === "L" ||
      sec.section_type === "L" ||
      (sec.room && String(sec.room).toLowerCase().includes("lab"));

    const isT = !isLab;
    const displayType = isT ? "T" : "L";

    return (
      <View
        key={`sec-${sec.section_number}-${index}-${displayType}`} // กัน key ซ้ำ
        style={styles.sectionCard}
      >
        <View style={styles.sectionInfo}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionNumText}>
              กลุ่ม: {sec.section_number}
            </Text>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: isT ? "#FDEEF4" : "#E8F0FE" },
              ]}
            >
              <Text
                style={[
                  styles.typeText,
                  { color: isT ? "#a73355" : "#1a73e8" },
                ]}
              >
                {isT ? "ทฤษฎี " : "ปฏิบัติ "}
              </Text>
            </View>
          </View>
          <Text style={styles.sectionTimeText}>
            📅 {sec.day_of_week} ⏰ {sec.start_time}–{sec.end_time}
          </Text>
          <Text style={styles.sectionRoomText}>📍 {sec.room}</Text>
          <Text
            style={[styles.seatText, { color: isFull ? "#ba1a1a" : "#22c55e" }]}
          >
            🪑 {sec.enrolled_seats}/{sec.max_seats}{" "}
            {isFull ? "(เต็ม)" : "(ว่าง)"}
          </Text>
        </View>
        {/* 🌟 3. เปลี่ยนปุ่มจากเพิ่มลงตะกร้า เป็นปุ่มต่อคิวเมื่อที่นั่งเต็ม */}
        <TouchableOpacity
          style={[
            styles.addBtn,
            isFull
              ? { backgroundColor: "#FF9800" } // สีส้มสำหรับปุ่มต่อคิว
              : { backgroundColor: isT ? "#D23669" : "#1a73e8" },
          ]}
          onPress={() =>
            isFull
              ? handleJoinWaitlistPrompt(course, sec, displayType) // ถ้าเต็มให้เรียกป๊อปอัปต่อคิว
              : handleAddSection(course, sec, displayType)
          }
        >
          <Text style={styles.addBtnText}>
            {isFull ? "ต่อคิว (Waitlist)" : "เลือก"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={["#FFDAE4", "#FFF8F8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.3 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* 🌟 Custom Modal ป็อปอัพสวยๆ แทรกตรงนี้ */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View
                style={[
                  styles.modalIconBg,
                  {
                    backgroundColor:
                      modalConfig.type === "success"
                        ? "#E8F5E9"
                        : modalConfig.type === "warning"
                          ? "#FFF3E0"
                          : "#FFEBEE",
                  },
                ]}
              >
                <Feather
                  name={
                    modalConfig.type === "success"
                      ? "check-circle"
                      : modalConfig.type === "warning"
                        ? "alert-triangle"
                        : "x-circle"
                  }
                  size={32}
                  color={
                    modalConfig.type === "success"
                      ? "#4CAF50"
                      : modalConfig.type === "warning"
                        ? "#FF9800"
                        : "#E53935"
                  }
                />
              </View>

              <Text style={styles.modalTitle}>{modalConfig.title}</Text>
              <Text style={styles.modalMessage}>{modalConfig.message}</Text>

              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor:
                        modalConfig.type === "success"
                          ? "#4CAF50"
                          : modalConfig.type === "warning"
                            ? "#FF9800"
                            : "#E53935",
                    },
                  ]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.confirmButtonText}>ตกลง</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 🌟 4. Custom Confirm Modal สำหรับยืนยันการเข้าคิว */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={confirmModalVisible}
          onRequestClose={() => setConfirmModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View
                style={[styles.modalIconBg, { backgroundColor: "#FFF3E0" }]}
              >
                <Feather name="clock" size={32} color="#FF9800" />
              </View>
              <Text style={styles.modalTitle}>{confirmDetail.title}</Text>
              <Text style={styles.modalMessage}>{confirmDetail.message}</Text>

              <View style={[styles.modalButtonContainer, { gap: 10 }]}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: "#E0E0E0", flex: 1 },
                  ]}
                  onPress={() => setConfirmModalVisible(false)}
                >
                  <Text
                    style={[styles.confirmButtonText, { color: "#514345" }]}
                  >
                    ยกเลิก
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: "#FF9800", flex: 1 },
                  ]}
                  onPress={confirmAction}
                >
                  <Text style={styles.confirmButtonText}>ยืนยันต่อคิว</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setView("MENU")}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>รายวิชาที่เปิดสอน</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {loading && courses.length === 0 ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color="#a73355" />
              <Text style={{ marginTop: 10, color: "#837375" }}>
                กำลังโหลดรายวิชา...
              </Text>
            </View>
          ) : (
            <FlatList
              data={courses}
              keyExtractor={(item) => item.course_code}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}
              renderItem={({ item }) => (
                <View style={styles.courseWrapper}>
                  <TouchableOpacity
                    onPress={() => handleSelectCourse(item)}
                    style={[
                      styles.courseCard,
                      selectedCourse?.course_code === item.course_code &&
                        styles.courseCardActive,
                    ]}
                    activeOpacity={0.9}
                  >
                    <View
                      style={[styles.courseInfo, { flex: 1, paddingRight: 10 }]}
                    >
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeText}>{item.course_code}</Text>
                      </View>
                      <Text style={styles.courseNameText}>
                        {item.course_name}
                      </Text>
                      <Text style={styles.courseMetaText}>
                        {item.credits} หน่วยกิต | {item.course_group}
                      </Text>
                    </View>
                    <MaterialIcons
                      name={
                        selectedCourse?.course_code === item.course_code
                          ? "expand-less"
                          : "expand-more"
                      }
                      size={24}
                      color="#a73355"
                    />
                  </TouchableOpacity>

                  {selectedCourse?.course_code === item.course_code && (
                    <View style={styles.bottomSheet}>
                      {loading ? (
                        <ActivityIndicator
                          size="large"
                          color="#a73355"
                          style={{ marginTop: 20 }}
                        />
                      ) : zOptions ? (
                        <FlatList
                          data={zOptions}
                          keyExtractor={(zItem) => zItem.course_code}
                          renderItem={({ item: zCourse }) => (
                            <View style={{ marginBottom: 16 }}>
                              <Text
                                style={{
                                  fontWeight: "bold",
                                  fontSize: 14,
                                  color: "#D23669",
                                  marginBottom: 8,
                                  flexShrink: 1,
                                }}
                              >
                                {zCourse.course_code} {zCourse.course_name}
                              </Text>
                              {zCourse.sections.map((sec, index) =>
                                renderSectionItem(zCourse, sec, index),
                              )}
                            </View>
                          )}
                          contentContainerStyle={{ paddingBottom: 20 }}
                        />
                      ) : (
                        <FlatList
                          data={sections}
                          keyExtractor={(secItem, index) =>
                            `sec-${secItem.section_number}-${index}`
                          }
                          renderItem={({ item: secItem, index }) =>
                            renderSectionItem(selectedCourse, secItem, index)
                          }
                          contentContainerStyle={{ paddingBottom: 20 }}
                        />
                      )}
                    </View>
                  )}
                </View>
              )}
            />
          )}
        </View>

        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setView("MENU")}
          >
            <MaterialIcons name="home" size={24} color="#837375" />
            <Text style={styles.navText}>HOME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItemActive}>
            <MaterialIcons name="list" size={24} color="#a73355" />
            <Text style={styles.navTextActive}>COURSES</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setView("CART")}
          >
            <MaterialIcons name="shopping-cart" size={24} color="#837375" />
            <Text style={styles.navText}>CART</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setView("SCHEDULE")}
          >
            <MaterialIcons name="calendar-today" size={24} color="#837375" />
            <Text style={styles.navText}>SCHEDULE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#7b5455" },
  bellButton: { padding: 4 },
  content: { flex: 1, paddingHorizontal: 20 },
  searchContainer: { flexDirection: "row", gap: 10, marginBottom: 24 },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#1f1a1c", fontWeight: "500" },
  searchBtn: { width: 80, borderRadius: 16, overflow: "hidden", elevation: 4 },
  searchBtnGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: 52,
  },
  searchBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  emptyState: { flex: 0.8, justifyContent: "center", alignItems: "center" },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.5)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: { fontSize: 14, color: "#837375", fontWeight: "bold" },
  courseWrapper: { marginBottom: 12 },
  courseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(214,194,196,0.2)",
  },
  courseCardActive: {
    backgroundColor: "#fff",
    borderColor: "#FDEEF4",
    borderWidth: 2,
  },
  courseInfo: { flex: 1 },
  codeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FDEEF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  codeText: { fontSize: 11, fontWeight: "bold", color: "#a73355" },
  courseNameText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1f1a1c",
    marginBottom: 4,
  },
  courseMetaText: { fontSize: 11, color: "#837375" },
  sectionsContainer: {
    backgroundColor: "rgba(255,255,255,0.4)",
    marginTop: -10,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  // ✅ Group header สำหรับแยก T / L
  groupHeader: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 8 },
  groupHeaderText: { fontSize: 12, fontWeight: "bold" },
  sectionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    elevation: 1,
  },
  sectionInfo: { flex: 1 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionNumText: { fontSize: 13, fontWeight: "bold", color: "#1f1a1c" },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeText: { fontSize: 10, fontWeight: "bold" },
  sectionTimeText: { fontSize: 11, color: "#514345", marginBottom: 2 },
  sectionRoomText: { fontSize: 11, color: "#837375", marginBottom: 4 },
  seatText: { fontSize: 11, fontWeight: "bold" },
  addBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  addBtnDisabled: { backgroundColor: "#ccc" },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  bottomNav: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 40,
    paddingHorizontal: 8,
    paddingVertical: 8,
    elevation: 10,
    zIndex: 30,
  },
  navItemActive: {
    alignItems: "center",
    backgroundColor: "#FDEEF4",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  navTextActive: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#a73355",
    marginTop: 4,
  },
  navItem: { alignItems: "center", paddingHorizontal: 8, paddingVertical: 10 },
  navText: { fontSize: 9, fontWeight: "bold", color: "#837375", marginTop: 4 },

  // 🌟 สไตล์สำหรับ Custom Modal (ป็อปอัพสวยๆ)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  modalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f1a1c",
    marginBottom: 8,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    color: "#837375",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
  },
  modalButton: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});
