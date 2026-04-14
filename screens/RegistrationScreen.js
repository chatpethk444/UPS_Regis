import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal, // 🌟 เพิ่ม Modal
} from "react-native";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  getSuggestedCoursesAPI,
  batchAddWithCheckAPI,
  getCartAPI,
  getScheduleAPI,
  aiSuggestAPI,
} from "../api";

const { width } = Dimensions.get("window");
const GRID_START_HOUR = 8;
const GRID_END_HOUR = 19;
const COLUMN_COUNT = GRID_END_HOUR - GRID_START_HOUR;

const ONE_HOUR_WIDTH = 25;
const DAY_COLUMN_WIDTH = 60;
const TOTAL_GRID_WIDTH = ONE_HOUR_WIDTH * COLUMN_COUNT;

const DAY_MAP = {
  Mon: "จันทร์",
  Tue: "อังคาร",
  Wed: "พุธ",
  Thu: "พฤหัสบดี",
  Fri: "ศุกร์",
  Sat: "เสาร์",
  Sun: "อาทิตย์",
  Monday: "จันทร์",
  Tuesday: "อังคาร",
  Wednesday: "พุธ",
  Thursday: "พฤหัสบดี",
  Friday: "ศุกร์",
  จันทร์: "จันทร์",
  อังคาร: "อังคาร",
  พุธ: "พุธ",
  พฤหัส: "พฤหัสบดี",
  ศุกร์: "ศุกร์",
  เสาร์: "เสาร์",
  อาทิตย์: "อาทิตย์",
};

const DAY_ORDER = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
  จันทร์: 1,
  อังคาร: 2,
  พุธ: 3,
  พฤหัสบดี: 4,
  ศุกร์: 5,
  เสาร์: 6,
  อาทิตย์: 7,
};

export default function RegistrationScreen({ student, setView }) {
  const [courses, setCourses] = useState([]);
  const [cartCourseCodes, setCartCourseCodes] = useState([]);
  const [enrolledCourseCodes, setEnrolledCourseCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [calculating, setCalculating] = useState(false);

  // 🌟 State สำหรับ Custom Modal ป็อปอัพสวยๆ
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: "",
    message: "",
    type: "info", // "success", "error", "warning", "info"
    onConfirm: null,
    confirmText: "ตกลง",
  });

  // 🌟 ฟังก์ชันเรียกใช้ป็อปอัพแทน Alert.alert
  const showModal = (title, message, type = "info", onConfirm = null, confirmText = "ตกลง") => {
    setModalConfig({ title, message, type, onConfirm, confirmText });
    setModalVisible(true);
  };

  const handleModalConfirm = () => {
    setModalVisible(false);
    if (modalConfig.onConfirm) {
      modalConfig.onConfirm();
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cart, schedule, suggested] = await Promise.all([
        getCartAPI(student.student_id).catch(() => []),
        getScheduleAPI(student.student_id).catch(() => []),
        getSuggestedCoursesAPI(student.student_id).catch(() => []),
      ]);

      const cartCodes = cart.map((c) => c.course_code || c.course_id);
      const scheduleCodes = schedule.map((c) => c.course_code || c.course_id);

      setCartCourseCodes(cartCodes);
      setEnrolledCourseCodes(scheduleCodes);

      // ✅ ข้อมูลที่ได้จาก API จะถูกกรองปีและเทอมมาให้เรียบร้อยแล้วจาก Backend
      setCourses(suggested);

      const initialCodes = suggested
        .map((c) => c.course_code)
        .filter(
          (code) => !cartCodes.includes(code) && !scheduleCodes.includes(code),
        );

      setSelectedCodes(initialCodes);
    } catch (e) {
      // 🌟 เปลี่ยน Alert เป็น showModal
      showModal("ข้อผิดพลาด", e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (code) => {
    if (enrolledCourseCodes.includes(code)) {
      // 🌟 เปลี่ยน Alert เป็น showModal
      return showModal("ไม่สามารถเลือกได้", "คุณลงทะเบียนวิชานี้ไปแล้ว", "warning");
    }
    if (cartCourseCodes.includes(code)) {
      // 🌟 เปลี่ยน Alert เป็น showModal
      return showModal("ไม่สามารถเลือกได้", "วิชานี้อยู่ในตะกร้าแล้ว", "warning");
    }
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleGeneratePlans = async () => {
    if (selectedCodes.length === 0)
      return showModal("แจ้งเตือน", "กรุณาเลือกวิชาเป้าหมาย", "warning"); // 🌟 เปลี่ยน Alert เป็น showModal
    setCalculating(true);
    try {
      const result = await aiSuggestAPI(student.student_id, selectedCodes);
      setSuggestions(result || []);
    } catch (err) {
      showModal("Error", err.message, "error"); // 🌟 เปลี่ยน Alert เป็น showModal
    } finally {
      setCalculating(false);
    }
  };

  const handleAcceptPlan = async (plan) => {
    // 🌟 เพิ่มการเช็คที่นั่งเต็มก่อนส่งไป Backend
    const fullCourses = plan.filter(
      (item) => item.max_seats > 0 && item.enrolled_seats >= item.max_seats,
    );

    if (fullCourses.length > 0) {
      const courseNames = fullCourses
        .map((c) => `${c.course_code} (Sec ${c.section_number})`)
        .join(", ");
      // 🌟 เปลี่ยน Alert เป็น showModal
      return showModal(
        "ไม่สามารถเลือกแผนนี้ได้",
        `วิชาต่อไปนี้ที่นั่งเต็มแล้ว: ${courseNames}\nกรุณาเลือกแผนอื่นหรือกดจัดใหม่`,
        "error"
      );
    }

    setCalculating(true);
    try {
      const items = plan.map((item) => ({
        course_code: item.course_code,
        section_number: String(item.section_number),
        section_type: item.section_type,
      }));

      const res = await batchAddWithCheckAPI(student.student_id, items);
      if (res.status === "conflict") {
        // 🌟 เปลี่ยน Alert เป็น showModal
        showModal(
          "พบเวลาเรียนชนกัน",
          "กรุณาเคลียร์วิชาในตะกร้าหรือเลือกแผนอื่น",
          "warning"
        );
      } else {
        // 🌟 เปลี่ยน Alert เป็น showModal พร้อม Callback นำทางไปตะกร้า
        showModal(
          "สำเร็จ", 
          "เพิ่มแผนการเรียนลงตะกร้าเรียบร้อยแล้ว", 
          "success", 
          () => setView("CART"), 
          "ไปที่ตะกร้า"
        );
      }
    } catch (e) {
      showModal("ข้อผิดพลาด", e.message, "error"); // 🌟 เปลี่ยน Alert เป็น showModal
    } finally {
      setCalculating(false);
    }
  };

  const formatTimeDisplay = (time) => {
    if (time == null) return "";
    let str = String(time);
    if (str.includes(":")) {
      const [h, m] = str.split(":");
      return `${parseInt(h)}.${m}`;
    }
    if (str.includes(".")) {
      const [h, m] = str.split(".");
      const mins = Math.round(parseFloat(`0.${m}`) * 60)
        .toString()
        .padStart(2, "0");
      return `${h}.${mins}`;
    }
    return `${str}.00`;
  };

  const getBoxStyle = (startTime, endTime) => {
    const parseTime = (t) => {
      if (typeof t === "number") return t;
      if (typeof t === "string" && t.includes(":")) {
        const [h, m] = t.split(":").map(Number);
        return h + m / 60;
      }
      return parseFloat(t) || 0;
    };
    const s = parseTime(startTime);
    const e = parseTime(endTime);
    return {
      left: (s - GRID_START_HOUR) * ONE_HOUR_WIDTH,
      width: (e - s) * ONE_HOUR_WIDTH,
    };
  };

  // 🌟 ฟังก์ชันเลือกไอคอนและสีตามประเภทป็อปอัพ
  const getModalStyleConfig = () => {
    switch (modalConfig.type) {
      case "success": return { icon: "check-circle", color: "#4CAF50", bgColor: "#E8F5E9" };
      case "error": return { icon: "x-circle", color: "#F44336", bgColor: "#FFEBEE" };
      case "warning": return { icon: "alert-triangle", color: "#FF9800", bgColor: "#FFF3E0" };
      default: return { icon: "info", color: "#2196F3", bgColor: "#E3F2FD" };
    }
  };

  const modalStyle = getModalStyleConfig();

  return (
    <LinearGradient colors={["#FFDAE4", "#FFF8F8"]} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* 🌟 Custom Modal ป็อปอัพสวยๆ แทรกตรงนี้ */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[styles.modalIconBg, { backgroundColor: modalStyle.bgColor }]}>
                <Feather name={modalStyle.icon} size={32} color={modalStyle.color} />
              </View>
              <Text style={styles.modalTitle}>{modalConfig.title}</Text>
              <Text style={styles.modalMessage}>{modalConfig.message}</Text>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: modalStyle.color }]}
                onPress={handleModalConfirm}
              >
                <Text style={styles.modalButtonText}>{modalConfig.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setView("MENU")}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ลงทะเบียนยกภาค</Text>
          <TouchableOpacity onPress={fetchData}>
            <MaterialIcons name="refresh" size={24} color="#a73355" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#a73355"
            style={{ marginTop: 100 }}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {suggestions.length > 0 ? (
              <View style={styles.plansSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>แผนการเรียนที่แนะนำ</Text>
                  <TouchableOpacity
                    onPress={() => setSuggestions([])}
                    style={styles.resetButton}
                  >
                    <Text style={styles.resetText}>จัดใหม่</Text>
                  </TouchableOpacity>
                </View>

                {suggestions.map((plan, index) => (
                  <View key={index} style={styles.planCard}>
                    <Text style={styles.planTitle}>
                      Plan {String.fromCharCode(65 + index)}
                    </Text>

                    <View style={styles.gridOuterContainer}>
                      <ScrollView
                        horizontal={true}
                        showsHorizontalScrollIndicator={true}
                      >
                        <View
                          style={{
                            width: TOTAL_GRID_WIDTH + DAY_COLUMN_WIDTH + 50,
                          }}
                        >
                          <View style={styles.timeHeaderRow}>
                            <View style={{ width: DAY_COLUMN_WIDTH }} />
                            <View
                              style={{
                                flex: 1,
                                flexDirection: "row",
                                position: "relative",
                              }}
                            >
                              {Array.from(
                                { length: COLUMN_COUNT + 1 },
                                (_, i) => GRID_START_HOUR + i,
                              ).map((h, i) => (
                                <Text
                                  key={h}
                                  style={[
                                    styles.timeLabel,
                                    {
                                      position: "absolute",
                                      left: i * ONE_HOUR_WIDTH - 10,
                                      width: 20,
                                      textAlign: "center",
                                    },
                                  ]}
                                >
                                  {h}
                                </Text>
                              ))}
                            </View>
                          </View>

                          {[
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                            "Sun",
                          ].map((dayKey) => (
                            <View key={dayKey} style={styles.dayRow}>
                              <View style={styles.dayLabelContainer}>
                                <Text style={styles.dayTextTh}>
                                  {DAY_MAP[dayKey]}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.gridContent,
                                  { width: TOTAL_GRID_WIDTH },
                                ]}
                              >
                                {Array.from({ length: COLUMN_COUNT + 1 }).map(
                                  (_, i) => (
                                    <View
                                      key={i}
                                      style={[
                                        styles.vLine,
                                        { left: i * ONE_HOUR_WIDTH },
                                      ]}
                                    />
                                  ),
                                )}
                                {plan
                                  .filter((c) => {
                                    const d =
                                      c.day_of_week || c.class_times?.[0]?.day;
                                    return (
                                      d === dayKey ||
                                      DAY_MAP[d] === DAY_MAP[dayKey]
                                    );
                                  })
                                  .map((item, idx) => {
                                    const t = item.class_times?.[0] || item;
                                    const pos = getBoxStyle(
                                      t.start || item.start_time,
                                      t.end || item.end_time,
                                    );
                                    return (
                                      <View
                                        key={idx}
                                        style={[
                                          styles.courseBox,
                                          {
                                            left: pos.left + 1,
                                            width: pos.width - 2,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={styles.boxCode}
                                          numberOfLines={1}
                                        >
                                          {item.course_code}{" "}
                                          {item.section_type
                                            ? `(${item.section_type})`
                                            : ""}
                                        </Text>
                                        <Text
                                          style={styles.boxTime}
                                          numberOfLines={1}
                                        >
                                          {formatTimeDisplay(
                                            t.start || item.start_time,
                                          )}
                                          -
                                          {formatTimeDisplay(
                                            t.end || item.end_time,
                                          )}
                                        </Text>
                                      </View>
                                    );
                                  })}
                              </View>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>

                    <Text style={styles.sectionTitleSmall}>รายละเอียดวิชา</Text>
                    {(() => {
                      const groupedByDay = plan.reduce((acc, item) => {
                        const dayKey =
                          item.day_of_week || item.class_times?.[0]?.day;
                        const dName = DAY_MAP[dayKey] || "ไม่ระบุ";
                        if (!acc[dName]) acc[dName] = [];
                        acc[dName].push(item);
                        return acc;
                      }, {});

                      return Object.entries(groupedByDay)
                        .sort(
                          ([dayA], [dayB]) =>
                            (DAY_ORDER[dayA] || 9) - (DAY_ORDER[dayB] || 9),
                        )
                        .map(([dayStr, items], dIdx) => (
                          <View key={dIdx} style={styles.dayGroupContainer}>
                            <View style={styles.dayGroupHeader}>
                              <Text style={styles.dayGroupTitle}>{dayStr}</Text>
                              <Text style={styles.dayGroupCount}>
                                {items.length} Subjects
                              </Text>
                            </View>
                            <View style={styles.dayGroupBody}>
                              {items
                                .sort(
                                  (a, b) =>
                                    (a.start_time ||
                                      a.class_times?.[0]?.start) -
                                    (b.start_time || b.class_times?.[0]?.start),
                                )
                                .map((item, idx) => {
                                  const startTime =
                                    item.start_time ||
                                    item.class_times?.[0]?.start;
                                  const endTime =
                                    item.end_time || item.class_times?.[0]?.end;
                                  const isLast = idx === items.length - 1;
                                  const courseInfo = courses.find(
                                    (c) =>
                                      String(
                                        c.course_code || c.course_id,
                                      ).trim() ===
                                      String(
                                        item.course_code || item.course_id,
                                      ).trim(),
                                  );
                                  const secNum = String(
                                    item.section_number || "1",
                                  );
                                  const secType = item.section_type || "T";
                                  const enrolledSeats = item.enrolled_seats ?? 0;
                                  const maxSeats = item.max_seats ?? 0;

                                  return (
                                    <View key={idx} style={styles.timelineRow}>
                                      <View style={styles.timelineTimeCol}>
                                        <Text style={styles.timelineTimeText}>
                                          {formatTimeDisplay(startTime)}-
                                          {formatTimeDisplay(endTime)}
                                        </Text>
                                      </View>
                                      <View style={styles.timelineCenterCol}>
                                        <View style={styles.timelineDot} />
                                        {!isLast && (
                                          <View style={styles.timelineLine} />
                                        )}
                                      </View>
                                      <View style={styles.timelineDetailCol}>
                                        <Text style={styles.timelineCodeText}>
                                          {item.course_code}
                                          <Text
                                            style={{
                                              color:
                                                secType === "T"
                                                  ? "#2E7D32"
                                                  : "#C62828",
                                              fontSize: 13,
                                              fontWeight: "normal",
                                            }}
                                          >
                                            {secType === "T"
                                              ? " (ทฤษฎี)"
                                              : " (ปฏิบัติ)"}
                                          </Text>
                                        </Text>
                                        <Text
                                          style={styles.timelineNameText}
                                          numberOfLines={1}
                                        >
                                          {courseInfo?.course_name || "ไม่มีชื่อวิชา"}
                                        </Text>
                                        <Text style={styles.timelineSubText}>
                                          กลุ่ม: {secNum}
                                        </Text>
                                        {maxSeats > 0 && (
                                          <Text
                                            style={[
                                              styles.metaText,
                                              {
                                                color:
                                                  maxSeats -
                                                    enrolledSeats <=
                                                  0
                                                    ? "red"
                                                    : "#837375",
                                              },
                                            ]}
                                          >
                                            ที่นั่ง: {enrolledSeats}/
                                            {maxSeats} (ว่าง{" "}
                                            {maxSeats -
                                              enrolledSeats}
                                            )
                                          </Text>
                                        )}
                                      </View>
                                    </View>
                                  );
                                })}
                            </View>
                          </View>
                        ));
                    })()}

                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleAcceptPlan(plan)}
                    >
                      <LinearGradient
                        colors={["#D23669", "#a73355"]}
                        style={styles.acceptGradient}
                      >
                        <Text style={styles.acceptBtnText}>
                          เลือกแผนนี้ลงตะกร้า
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View>
                <Text style={styles.infoText}>
                  เลือกวิชาบังคับ/แนะนำ เพื่อให้ AI จัดแผนให้
                </Text>
                {courses.map((item) => {
                  const inCart = cartCourseCodes.includes(item.course_code);
                  const inSchedule = enrolledCourseCodes.includes(
                    item.course_code,
                  );
                  const isLocked = inCart || inSchedule;
                  const isSelected = selectedCodes.includes(item.course_code);

                  return (
                    <TouchableOpacity
                      key={item.course_code}
                      style={[
                        styles.courseCard,
                        isSelected && styles.courseCardSelected,
                        isLocked && styles.courseCardLocked,
                      ]}
                      onPress={() => toggleCourse(item.course_code)}
                      disabled={isLocked}
                    >
                      <View style={styles.cardHeader}>
                        <MaterialIcons
                          name={
                            isLocked
                              ? "lock"
                              : isSelected
                                ? "check-box"
                                : "check-box-outline-blank"
                          }
                          size={24}
                          color={
                            isLocked
                              ? "#ff0000"
                              : isSelected
                                ? "#FFF"
                                : "#a73355"
                          }
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={[
                                styles.courseCode,
                                (isSelected || isLocked) && {
                                  color: isLocked ? "#D23669" : "#FFF",
                                },
                              ]}
                            >
                              {item.course_code}
                            </Text>
                            {/* 🌟 เพิ่มป้ายบอก ปี และ เทอม */}
                            {item.suggested_year && (
                              <View
                                style={{
                                  backgroundColor: isSelected
                                    ? "rgba(255,255,255,0.2)"
                                    : "#ffe4ec",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                  marginLeft: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    color: isSelected ? "#FFF" : "#a73355",
                                    fontWeight: "bold",
                                  }}
                                >
                                  ปี {item.suggested_year} เทอม{" "}
                                  {item.suggested_semester}
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text
                            style={[
                              styles.courseCode,
                              (isSelected || isLocked) && {
                                color: isLocked ? "#D23669" : "#FFF",
                                fontSize: 12,
                              },
                            ]}
                          >
                            {inCart && " (ในตะกร้า)"}
                            {inSchedule && " (ในตาราง)"}
                          </Text>
                          <Text
                            style={[
                              styles.courseName,
                              isSelected && { color: "#FFDAE4" },
                            ]}
                          >
                            {item.course_name || "ไม่มีชื่อวิชา"}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.credits,
                            isSelected && { color: "#FFF" },
                          ]}
                        >
                          {item.credits}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={styles.generateBtn}
                  onPress={handleGeneratePlans}
                  disabled={calculating}
                >
                  <LinearGradient
                    colors={["#D23669", "#D23669"]}
                    style={styles.generateGradient}
                  >
                    {calculating ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <MaterialIcons
                          name="auto-awesome"
                          size={20}
                          color="white"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.generateBtnText}>
                          สร้างแผนการเรียนอัตโนมัติ
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#7b5455" },
  backButton: { padding: 8, backgroundColor: "white", borderRadius: 12 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  infoText: {
    fontSize: 14,
    color: "#837375",
    marginBottom: 15,
    fontWeight: "bold",
  },

  courseCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#FDEEF4",
  },
  courseCardSelected: { backgroundColor: "#a73355", borderColor: "#a73355" },
  courseCardLocked: { backgroundColor: "#F5F5F5", opacity: 0.7 },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  courseCode: { fontSize: 16, fontWeight: "bold", color: "#1f1a1c" },
  courseName: { fontSize: 12, color: "#837375", marginTop: 2 },
  credits: { fontSize: 13, fontWeight: "bold", color: "#a73355" },

  generateBtn: { marginTop: 10, borderRadius: 16, overflow: "hidden" },
  generateGradient: {
    paddingVertical: 18,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  generateBtnText: { color: "white", fontSize: 16, fontWeight: "bold" },

  plansSection: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#1f1a1c" },
  sectionTitleSmall: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#514345",
    marginBottom: 12,
  },
  resetText: { fontSize: 12, color: "#a73355", fontWeight: "bold" },

  planCard: {
    backgroundColor: "white",
    borderRadius: 25,
    padding: 15,
    marginBottom: 30,
    elevation: 5,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f1a1c",
    marginBottom: 15,
  },

  gridOuterContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  timeHeaderRow: { flexDirection: "row", height: 24, alignItems: "center" },
  timeLabel: { fontSize: 9, color: "#A0A0A0", fontWeight: "500" },
  dayRow: {
    flexDirection: "row",
    height: 35,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  dayLabelContainer: {
    width: DAY_COLUMN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFBFB",
    borderRightWidth: 1,
    borderRightColor: "#F5F5F5",
  },
  dayTextTh: { fontSize: 9, fontWeight: "bold", color: "#514345" },
  gridContent: { position: "relative" },
  vLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#F5F5F5",
  },
  courseBox: {
    position: "absolute",
    top: 2,
    bottom: 2,
    backgroundColor: "#FFAEB5",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  boxCode: { fontSize: 7, fontWeight: "bold", color: "#333333" },
  boxTime: { fontSize: 6, color: "#666666", marginTop: 1 },

  dayGroupContainer: {
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FDEEF4",
    elevation: 2,
  },
  dayGroupHeader: {
    backgroundColor: "#a73355",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  dayGroupTitle: { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
  dayGroupCount: { fontSize: 11, fontWeight: "600", color: "#FFDAE4" },
  dayGroupBody: { paddingTop: 12, paddingBottom: 8 },
  timelineRow: { flexDirection: "row", marginBottom: 12 },
  timelineTimeCol: { width: 70, paddingLeft: 10, alignItems: "flex-end" },
  timelineTimeText: { fontSize: 11, fontWeight: "600", color: "#837375" },
  timelineCenterCol: { width: 25, alignItems: "center", position: "relative" },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D23669",
    zIndex: 2,
  },
  timelineLine: {
    position: "absolute",
    top: 6,
    bottom: -18,
    width: 2,
    backgroundColor: "#FDEEF4",
    zIndex: 1,
  },
  timelineDetailCol: { flex: 1, paddingRight: 10 },
  timelineCodeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f1a1c",
    marginBottom: 4,
  },
  timelineNameText: { fontSize: 12, color: "#514345", marginBottom: 2 },
  timelineSubText: { fontSize: 11, color: "#837375" },
  metaText: { fontSize: 11, fontWeight: "bold", marginTop: 2 },

  acceptBtn: { marginTop: 10, borderRadius: 20, overflow: "hidden" },
  acceptGradient: { paddingVertical: 12, alignItems: "center" },
  acceptBtnText: { color: "white", fontWeight: "bold", fontSize: 14 },

  // 🌟 สไตล์สำหรับ Custom Modal ป็อปอัพสวยๆ
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
  modalButton: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});