import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  Modal,
  RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NavBar } from "../components/shared";
import {
  getAvailableCoursesAPI,
  getSectionsAPI,
  addToCartAPI,
  getCartAPI,
  getZOptionsAPI,
  getScheduleAPI,
  joinWaitlistAPI,
} from "../api";

const { width } = Dimensions.get("window");

const THEME = {
  primary: "#a73355",
  accent: "#D23669",
  theory: "#a73355",
  lab: "#1a73e8",
  theoryBg: "#FDEEF4",
  labBg: "#E8F0FE",
  text: "#1f1a1c",
  textMid: "#514345",
  textMuted: "#837375",
  success: "#22c55e",
  danger: "#ba1a1a",
  waitlist: "#FF9800",
};

const sortSectionsArray = (sections) => {
  if (!sections) return [];
  return [...sections].sort((a, b) => {
    const secA = parseInt(a.section_number) || 0;
    const secB = parseInt(b.section_number) || 0;
    if (secA !== secB) return secA - secB;

    const isLabA =
      a.type === "L" ||
      a.section_type === "L" ||
      (a.room && String(a.room).toLowerCase().includes("lab"));
    const isLabB =
      b.type === "L" ||
      b.section_type === "L" ||
      (b.room && String(b.room).toLowerCase().includes("lab"));

    if (!isLabA && isLabB) return -1;
    if (isLabA && !isLabB) return 1;
    return 0;
  });
};

const filterCoursesForStudent = (courses, student) =>
  courses.filter((c) => {
    if (c.suggested_semester != student.current_semester) return false;

    const courseGroup = c.course_group ? c.course_group.toLowerCase() : "";
    const isFreeElective =
      courseGroup.includes("เลือกเสรี") ||
      courseGroup.includes("free elective");

    if (isFreeElective) {
      const major = student.major || "";
      if (major.includes("วิศวกรรมคอมพิวเตอร์") && c.course_code.startsWith("CPE"))
        return false;
      if (major.includes("เทคโนโลยีสารสนเทศ") && c.course_code.startsWith("ICT"))
        return false;
      if (major.includes("โลจิสติกส์") && c.course_code.startsWith("LSM"))
        return false;
    }
    return true;
  });

const filterZOptionsForMajor = (options, major) =>
  Array.from(
    new Map(
      options
        .filter((opt) => {
          if (major.includes("วิศวกรรมคอมพิวเตอร์") && opt.course_code.startsWith("CPE"))
            return false;
          if (major.includes("เทคโนโลยีสารสนเทศ") && opt.course_code.startsWith("ICT"))
            return false;
          if (major.includes("โลจิสติกส์") && opt.course_code.startsWith("LSM"))
            return false;
          return true;
        })
        .map((opt) => [opt.course_code, opt]),
    ).values(),
  );

function AlertModal({ visible, config, onClose, onConfirm, confirmLabel }) {
  const iconMap = {
    success: { name: "check-circle", color: "#4CAF50", bg: "#E8F5E9" },
    warning: { name: "warning", color: "#FF9800", bg: "#FFF3E0" },
    error: { name: "error-outline", color: "#E53935", bg: "#FFEBEE" },
    info: { name: "info-outline", color: THEME.primary, bg: "#FDEEF4" },
  };
  const icon = iconMap[config.type] || iconMap.info;
  const isConfirm = Boolean(onConfirm);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={[styles.modalIconBg, { backgroundColor: icon.bg }]}>
            <MaterialIcons name={icon.name} size={32} color={icon.color} />
          </View>
          <Text style={styles.modalTitle}>{config.title}</Text>
          <Text style={styles.modalMessage}>{config.message}</Text>
          <View style={[styles.modalButtonRow, isConfirm && { gap: 10 }]}>
            {isConfirm && (
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="ยกเลิก"
              >
                <Text style={styles.modalButtonSecondaryText}>ยกเลิก</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: icon.color, flex: isConfirm ? 1 : undefined },
              ]}
              onPress={onConfirm || onClose}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel || "ตกลง"}
            >
              <Text style={styles.modalButtonText}> {confirmLabel || "ตกลง"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SectionMetaRow({ icon, children }) {
  return (
    <View style={styles.metaRow}>
      <MaterialIcons name={icon} size={14} color={THEME.textMuted} />
      <Text style={styles.metaText}>{children}</Text>
    </View>
  );
}

export default function ManualScreen({ student, setView }) {
  const [courses, setCourses] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [cart, setCart] = useState([]);
  const [zOptions, setZOptions] = useState(null);
  const [schedule, setSchedule] = useState([]);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: "info",
    title: "",
    message: "",
  });

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmDetail, setConfirmDetail] = useState({ title: "", message: "" });

  const showAlert = (title, message, type = "info") => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const fetchInitialData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingInitial(true);

    try {
      const [cartData, scheduleData, allCoursesData] = await Promise.all([
        getCartAPI(student.student_id).catch(() => []),
        getScheduleAPI(student.student_id).catch(() => []),
        getAvailableCoursesAPI(student.student_id).catch(() => []),
      ]);

      setCart(cartData);
      setSchedule(scheduleData);
      setCourses(filterCoursesForStudent(allCoursesData, student));
    } catch {
      showAlert("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลรายวิชาได้", "error");
    } finally {
      setLoadingInitial(false);
      setRefreshing(false);
    }
  }, [student]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleJoinWaitlistPrompt = (course, section, sectionType) => {
    setConfirmDetail({
      title: "ยืนยันการต่อคิว",
      message: `คุณต้องการเข้าคิวรายวิชา ${course.course_code} Sec ${section.section_number} (${sectionType === "T" ? "ทฤษฎี" : "ปฏิบัติ"}) ใช่หรือไม่?\n\nเมื่อถึงคิวของคุณ ระบบจะแจ้งเตือนและให้เวลา 30 นาทีในการยืนยันสิทธิ์`,
    });

    setConfirmAction(() => async () => {
      setConfirmVisible(false);
      try {
        await joinWaitlistAPI(
          student.student_id,
          course.course_code,
          section.section_number,
          sectionType,
        );
        showAlert(
          "เข้าคิวสำเร็จ",
          `คุณได้เข้าคิววิชา ${course.course_code} Sec ${section.section_number} เรียบร้อยแล้ว`,
          "success",
        );
      } catch (error) {
        showAlert("ไม่สำเร็จ", error.message || "ไม่สามารถต่อคิวได้", "error");
      }
    });

    setConfirmVisible(true);
  };

  const isTimeOverlapping = (sec1, sec2) => {
    if (!sec1.day_of_week || !sec2.day_of_week) return false;
    if (sec1.day_of_week !== sec2.day_of_week) return false;
    const toInt = (t) => parseInt((t || "").replace(":", ""), 10);
    const s1 = toInt(sec1.start_time);
    const e1 = toInt(sec1.end_time);
    const s2 = toInt(sec2.start_time);
    const e2 = toInt(sec2.end_time);
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
    setLoadingSections(true);
    setSections([]);
    setZOptions(null);

    try {
      if (course.course_code.startsWith("Z")) {
        const options = await getZOptionsAPI(student.student_id, course.course_code);
        const major = student.major || "";
        const sortedZOptions = filterZOptionsForMajor(options, major).map((opt) => ({
          ...opt,
          sections: sortSectionsArray(opt.sections),
        }));
        setZOptions(sortedZOptions);
      } else {
        const data = await getSectionsAPI(course.course_code);
        setSections(sortSectionsArray(data));
      }
    } catch (e) {
      showAlert("ข้อผิดพลาด", e.message, "error");
      setSelectedCourse(null);
    } finally {
      setLoadingSections(false);
    }
  };

  const handleAddSection = async (targetCourse, section, computedType) => {
    const sectionType = computedType || "T";
    let warningMsg = "";

    if (
      targetCourse.required_semester &&
      student.current_semester < targetCourse.required_semester
    ) {
      warningMsg = `\n\nหมายเหตุ: วิชานี้แนะนำสำหรับนักศึกษาเทอม ${targetCourse.required_semester} (คุณอยู่เทอม ${student.current_semester})`;
    }

    if (section.enrolled_seats >= section.max_seats) {
      return showAlert(
        "ที่นั่งเต็ม",
        `Section ${section.section_number} (${sectionType}) เต็มแล้ว${warningMsg}`,
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
      return showAlert(
        "ไม่สามารถเพิ่มได้",
        `คุณได้ลงทะเบียนวิชา ${targetCourse.course_code} ${typeLabel} ไปเรียบร้อยแล้วในตารางเรียน${warningMsg}`,
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
      return showAlert(
        "ไม่สามารถเพิ่มได้",
        `วิชา ${targetCourse.course_code} ${typeLabel} มีอยู่ในตะกร้าของคุณแล้ว (Sec ${alreadyInCart.section_number})\nหากต้องการเปลี่ยนกลุ่ม กรุณาลบออกจากตะกร้าก่อน${warningMsg}`,
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

      return showAlert(
        "เวลาเรียนชนกัน",
        `Sec ที่คุณเลือก มีเวลาทับซ้อนกับวิชา:\n${conflict.course_code} Sec ${conflict.section_number} ${typeLabel}\nซึ่งอยู่ใน "${location}" ของคุณแล้ว${warningMsg}`,
        "error",
      );
    }

    try {
      await addToCartAPI(
        student.student_id,
        targetCourse.course_code,
        String(section.section_number),
        sectionType,
      );
      const typeLabel = sectionType === "T" ? "ทฤษฎี (T)" : "ปฏิบัติ (L)";
      showAlert(
        "สำเร็จ",
        `เพิ่ม Sec ${section.section_number} ${typeLabel} ลงตะกร้าแล้ว${warningMsg}`,
        "success",
      );

      const [newCart, newSchedule] = await Promise.all([
        getCartAPI(student.student_id).catch(() => []),
        getScheduleAPI(student.student_id).catch(() => []),
      ]);
      setCart(newCart);
      setSchedule(newSchedule);
    } catch (err) {
      showAlert("ไม่สำเร็จ", err.message + warningMsg, "error");
    }
  };

  const renderSectionItem = (course, sec, index) => {
    const isFull = sec.enrolled_seats >= sec.max_seats;
    const isLab =
      sec.type === "L" ||
      sec.section_type === "L" ||
      (sec.room && String(sec.room).toLowerCase().includes("lab"));
    const isT = !isLab;
    const displayType = isT ? "T" : "L";

    return (
      <View
        key={`sec-${sec.section_number}-${index}-${displayType}`}
        style={styles.sectionCard}
      >
        <View style={styles.sectionInfo}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionNumText}>กลุ่ม {sec.section_number}</Text>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: isT ? THEME.theoryBg : THEME.labBg },
              ]}
            >
              <Text
                style={[
                  styles.typeText,
                  { color: isT ? THEME.theory : THEME.lab },
                ]}
              >
                {isT ? "ทฤษฎี" : "ปฏิบัติ"}
              </Text>
            </View>
          </View>
          <SectionMetaRow icon="event">
            {sec.day_of_week} · {sec.start_time}–{sec.end_time}
          </SectionMetaRow>
          <SectionMetaRow icon="place">{sec.room || "ไม่ระบุห้อง"}</SectionMetaRow>
          <View style={styles.metaRow}>
            <MaterialIcons
              name="event-seat"
              size={14}
              color={isFull ? THEME.danger : THEME.success}
            />
            <Text
              style={[
                styles.seatText,
                { color: isFull ? THEME.danger : THEME.success },
              ]}
            >
              {sec.enrolled_seats}/{sec.max_seats} {isFull ? "เต็ม" : "ว่าง"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.addBtn,
            isFull
              ? styles.addBtnWaitlist
              : isT
                ? styles.addBtnTheory
                : styles.addBtnLab,
          ]}
          onPress={() =>
            isFull
              ? handleJoinWaitlistPrompt(course, sec, displayType)
              : handleAddSection(course, sec, displayType)
          }
          accessibilityRole="button"
          accessibilityLabel={isFull ? "ต่อคิว" : "เลือกกลุ่มเรียน"}
        >
          <Text style={styles.addBtnText}>
            {isFull ? "ต่อคิว" : "เลือก"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderExpandedSections = () => {
    if (loadingSections) {
      return (
        <View style={styles.sectionsLoading}>
          <ActivityIndicator size="small" color={THEME.primary} />
          <Text style={styles.sectionsLoadingText}>กำลังโหลดกลุ่มเรียน...</Text>
        </View>
      );
    }

    if (zOptions) {
      if (zOptions.length === 0) {
        return (
          <Text style={styles.noSectionsText}>ไม่พบวิชาในหมวดนี้สำหรับสาขาของคุณ</Text>
        );
      }
      return zOptions.map((zCourse) => (
        <View key={zCourse.course_code} style={styles.zOptionGroup}>
          <Text style={styles.zOptionTitle}>
            {zCourse.course_code} {zCourse.course_name}
          </Text>
          {zCourse.sections.map((sec, index) =>
            renderSectionItem(zCourse, sec, index),
          )}
        </View>
      ));
    }

    if (sections.length === 0) {
      return (
        <Text style={styles.noSectionsText}>ยังไม่มีกลุ่มเรียนที่เปิดรับ</Text>
      );
    }

    return sections.map((sec, index) =>
      renderSectionItem(selectedCourse, sec, index),
    );
  };

  const renderCourseItem = ({ item }) => {
    const isActive = selectedCourse?.course_code === item.course_code;
    return (
      <View style={styles.courseWrapper}>
        <TouchableOpacity
          onPress={() => handleSelectCourse(item)}
          style={[styles.courseCard, isActive && styles.courseCardActive]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ expanded: isActive }}
        >
          <View style={styles.courseInfo}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{item.course_code}</Text>
            </View>
            <Text style={styles.courseNameText} numberOfLines={2}>
              {item.course_name}
            </Text>
            <Text style={styles.courseMetaText}>
              {item.credits} หน่วยกิต · {item.course_group}
            </Text>
          </View>
          <MaterialIcons
            name={isActive ? "expand-less" : "expand-more"}
            size={24}
            color={THEME.primary}
          />
        </TouchableOpacity>

        {isActive && (
          <View style={styles.bottomSheet}>{renderExpandedSections()}</View>
        )}
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
        <AlertModal
          visible={alertVisible}
          config={alertConfig}
          onClose={() => setAlertVisible(false)}
        />
        <AlertModal
          visible={confirmVisible}
          config={{ ...confirmDetail, type: "warning" }}
          onClose={() => setConfirmVisible(false)}
          onConfirm={confirmAction}
          confirmLabel="ยืนยันต่อคิว"
        />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setView("MENU")}
              style={styles.backButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="กลับหน้าหลัก"
            >
              <MaterialIcons name="arrow-back" size={24} color={THEME.textMid} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>รายวิชาที่เปิดสอน</Text>
              <Text style={styles.headerSubtitle}>
                เทอม {student.current_semester} · {courses.length} วิชา
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {loadingInitial ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={THEME.primary} />
              <Text style={styles.centerStateText}>กำลังโหลดรายวิชา...</Text>
            </View>
          ) : courses.length === 0 ? (
            <View style={styles.centerState}>
              <View style={styles.emptyIconCircle}>
                <MaterialIcons name="menu-book" size={36} color={THEME.primary} />
              </View>
              <Text style={styles.emptyTitle}>ไม่มีรายวิชาในเทอมนี้</Text>
              <Text style={styles.emptyText}>
                ยังไม่มีวิชาที่เปิดให้ลงทะเบียนในเทอมปัจจุบัน
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => fetchInitialData()}
              >
                <Text style={styles.retryBtnText}>โหลดใหม่</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={courses}
              keyExtractor={(item) => item.course_code}
              renderItem={renderCourseItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchInitialData(true)}
                  tintColor={THEME.primary}
                  colors={[THEME.primary]}
                />
              }
            />
          )}
        </View>

        <NavBar setView={setView} active="COURSES" />
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
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  backButton: { padding: 4, marginLeft: -4, minWidth: 44, minHeight: 44, justifyContent: "center" },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.textMid,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  content: { flex: 1, paddingHorizontal: 20 },
  listContent: { paddingBottom: 120, paddingTop: 4 },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  centerStateText: { marginTop: 12, color: THEME.textMuted, fontSize: 14 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: THEME.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    minHeight: 44,
    justifyContent: "center",
  },
  retryBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  courseWrapper: { marginBottom: 12 },
  courseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(214,194,196,0.25)",
    shadowColor: "rgba(167, 51, 85, 0.06)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  courseCardActive: {
    backgroundColor: "#fff",
    borderColor: THEME.theoryBg,
    borderWidth: 2,
  },
  courseInfo: { flex: 1, paddingRight: 10 },
  codeBadge: {
    alignSelf: "flex-start",
    backgroundColor: THEME.theoryBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  codeText: { fontSize: 11, fontWeight: "bold", color: THEME.primary },
  courseNameText: {
    fontSize: 15,
    fontWeight: "bold",
    color: THEME.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  courseMetaText: { fontSize: 12, color: THEME.textMuted },
  bottomSheet: {
    backgroundColor: "rgba(255,255,255,0.55)",
    marginTop: 8,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 4,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "rgba(214,194,196,0.2)",
  },
  sectionsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  sectionsLoadingText: { fontSize: 13, color: THEME.textMuted },
  noSectionsText: {
    fontSize: 13,
    color: THEME.textMuted,
    textAlign: "center",
    paddingVertical: 16,
  },
  zOptionGroup: { marginBottom: 16 },
  zOptionTitle: {
    fontWeight: "bold",
    fontSize: 14,
    color: THEME.accent,
    marginBottom: 8,
  },
  sectionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionInfo: { flex: 1, paddingRight: 8 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sectionNumText: { fontSize: 13, fontWeight: "bold", color: THEME.text },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 10, fontWeight: "bold" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  metaText: { fontSize: 12, color: THEME.textMid, flex: 1 },
  seatText: { fontSize: 12, fontWeight: "600" },
  addBtn: {
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 72,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnTheory: { backgroundColor: THEME.accent },
  addBtnLab: { backgroundColor: THEME.lab },
  addBtnWaitlist: { backgroundColor: THEME.waitlist },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: width * 0.88,
    maxWidth: 360,
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
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
    fontSize: 18,
    fontWeight: "bold",
    color: THEME.text,
    marginBottom: 8,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    color: THEME.textMuted,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtonRow: {
    flexDirection: "row",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalButtonSecondary: {
    backgroundColor: "#f0f0f0",
  },
  modalButtonSecondaryText: {
    color: THEME.textMid,
    fontWeight: "bold",
    fontSize: 16,
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});
