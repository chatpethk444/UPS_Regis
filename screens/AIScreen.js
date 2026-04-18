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
  Modal,
  FlatList,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getAvailableCoursesAPI,
  aiSuggestAPI,
  addToCartAPI,
  getZOptionsAPI,
  getCartAPI,
  getScheduleAPI,
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

export default function AIScreen({ student, setView }) {
  const [availableCourses, setAvailableCourses] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [myCart, setMyCart] = useState([]);
  const [mySchedule, setMySchedule] = useState([]);
  const [cartCourseCodes, setCartCourseCodes] = useState([]);
  const [scheduleCourseCodes, setScheduleCourseCodes] = useState([]);

  const [zModalVisible, setZModalVisible] = useState(false);
  const [zOptions, setZOptions] = useState([]);
  const [zTargetCourse, setZTargetCourse] = useState(null);
  const [zLoading, setZLoading] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [enrolledSchedule, setEnrolledSchedule] = useState([]);

  // 🌟 1. เพิ่ม State สำหรับระบบ Custom Pop-up อัจฉริยะ 🌟
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: "success", // 'success', 'error', 'warning', 'confirm'
    title: "",
    message: "",
    confirmText: "ตกลง",
    showCancel: false,
    onConfirm: null,
  });

  // 🌟 2. Helper Function สำหรับเรียก Pop-up ใหม่
  const showCustomAlert = (
    type,
    title,
    message,
    onConfirm = null,
    showCancel = false,
    confirmText = "ตกลง",
  ) => {
    setModalConfig({
      visible: true,
      type,
      title,
      message,
      onConfirm,
      showCancel,
      confirmText,
    });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    if (student) {
      const fetchAllData = async () => {
        setLoadingCourses(true);
        try {
          const [cartData, scheduleData, coursesData] = await Promise.all([
            getCartAPI(student.student_id).catch(() => []),
            getScheduleAPI(student.student_id).catch(() => []),
            getAvailableCoursesAPI(student.student_id).catch(() => []),
          ]);

          const targetSemester = student.current_semester || 1;

          const carts = Array.isArray(cartData)
            ? cartData.filter((c) => c.suggested_semester == targetSemester)
            : [];
          const scheds = Array.isArray(scheduleData) ? scheduleData : [];
          const courses = Array.isArray(coursesData)
            ? coursesData.filter((c) => c.suggested_semester == targetSemester)
            : [];

          setCartItems(carts);
          setEnrolledSchedule(scheds);

          setCartCourseCodes(
            carts.map((c) => c.course_code || c.course_id || ""),
          );
          setScheduleCourseCodes(
            scheds.map((c) => c.course_code || c.course_id || ""),
          );
          setAvailableCourses(courses);

          // ซ้ำตามโค้ดเดิมของคุณ
          setCartCourseCodes(
            carts.map((c) => c.course_code || c.course_id || ""),
          );
          setScheduleCourseCodes(
            scheds.map((c) => c.course_code || c.course_id || ""),
          );
          setAvailableCourses(courses);
        } catch (error) {
          console.error("ดึงข้อมูลล้มเหลว:", error);
        } finally {
          setLoadingCourses(false);
        }
      };

      fetchAllData();
    }
  }, [student]);

  const fetchExistingCourses = async () => {
    try {
      const cartData = await getCartAPI(student.student_id);
      const scheduleData = await getScheduleAPI(student.student_id);

      const carts = Array.isArray(cartData) ? cartData : [];
      const scheds = Array.isArray(scheduleData) ? scheduleData : [];

      setCartCourseCodes(carts.map((c) => c.course_code || c.course_id || ""));
      setScheduleCourseCodes(
        scheds.map((c) => c.course_code || c.course_id || ""),
      );
    } catch (error) {
      console.error("ดึงข้อมูลเช็กวิชาซ้ำล้มเหลว:", error);
    }
  };

  const loadCourses = async () => {
    setLoadingCourses(true);
    try {
      const data = await getAvailableCoursesAPI(student.student_id);
      const targetSemester = student.current_semester || 1;

      setAvailableCourses(
        Array.isArray(data)
          ? data.filter((c) => c.suggested_semester == targetSemester)
          : [],
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const toggleCourse = (code) => {
    if (!code) return;

    const isSelected = selectedCodes.includes(code);

    if (!isSelected) {
      const inCart =
        Array.isArray(cartCourseCodes) && cartCourseCodes.includes(code);
      const inSchedule =
        Array.isArray(scheduleCourseCodes) &&
        scheduleCourseCodes.includes(code);

      if (inCart) {
        showCustomAlert(
          "warning",
          "ไม่สามารถเลือกได้",
          `รายวิชา ${code} มีอยู่ในตะกร้าของคุณแล้ว`,
        );
        return;
      }
      if (inSchedule) {
        showCustomAlert(
          "warning",
          "ไม่สามารถเลือกได้",
          `รายวิชา ${code} มีอยู่ในตารางเรียนของคุณแล้ว`,
        );
        return;
      }
    }

    setSelectedCodes((prev) =>
      isSelected ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleAIProcess = async () => {
    if (selectedCodes.length === 0)
      return showCustomAlert("warning", "แจ้งเตือน", "กรุณาเลือกวิชาเป้าหมาย");

    setCalculating(true);
    try {
      const result = await aiSuggestAPI(student.student_id, selectedCodes);
      setSuggestions(result || []);
    } catch (err) {
      showCustomAlert("error", "Error", err.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleAcceptSuggestion = async (plan) => {
    // 🌟 0. เช็คที่นั่งเต็มก่อนทำอย่างอื่น
    const fullCourses = plan.filter(
      (item) =>
        (item.max_seats || 0) > 0 &&
        (item.enrolled_seats || 0) >= (item.max_seats || 0),
    );

    if (fullCourses.length > 0) {
      const courseNames = fullCourses
        .map((c) => `${c.course_code} (Sec ${c.section_number})`)
        .join(", ");
      return showCustomAlert(
        "error",
        "ไม่สามารถเลือกแผนนี้ได้",
        `วิชาต่อไปนี้ที่นั่งเต็มแล้ว: ${courseNames}\nกรุณาเลือกแผนอื่นหรือกดจัดใหม่`,
      );
    }

    setCalculating(true);
    try {
      // 🌟 1. ดึงข้อมูลสด
      const [freshCart, freshSchedule] = await Promise.all([
        getCartAPI(student.student_id).catch(() => []),
        getScheduleAPI(student.student_id).catch(() => []),
      ]);

      const allExistingItems = [
        ...(Array.isArray(freshCart) ? freshCart : []).map((c) => ({
          ...c,
          source: "ตะกร้า",
        })),
        ...(Array.isArray(freshSchedule) ? freshSchedule : []).map((c) => ({
          ...c,
          source: "ตารางเรียน",
        })),
      ];

      // 🌟 2. แปลงวัน
      const normalizeDay = (d) => {
        if (!d) return "";
        const s = String(d).replace(/\s+/g, "").toLowerCase();
        if (
          s === "จ" ||
          s === "จ." ||
          s.includes("จันทร์") ||
          s.includes("mon")
        )
          return "จันทร์";
        if (
          s === "อ" ||
          s === "อ." ||
          s.includes("อังคาร") ||
          s.includes("tue")
        )
          return "อังคาร";
        if (
          s === "พ" ||
          s === "พ." ||
          s === "พุธ" ||
          s.includes("พุธ") ||
          s.includes("wed")
        )
          return "พุธ";
        if (s.includes("พฤ") || s.includes("thu")) return "พฤหัสบดี";
        if (s === "ศ" || s === "ศ." || s.includes("ศุกร์") || s.includes("fri"))
          return "ศุกร์";
        if (s === "ส" || s === "ส." || s.includes("เสาร์") || s.includes("sat"))
          return "เสาร์";
        if (
          s === "อา" ||
          s === "อา." ||
          s.includes("อาทิตย์") ||
          s.includes("sun")
        )
          return "อาทิตย์";
        return s;
      };

      // 🌟 3. ตัวแปลงเวลา
      const parseToMins = (t) => {
        if (t === null || t === undefined || t === "") return 0;
        let str = String(t).replace(/[^0-9:.]/g, "");
        if (!str) return 0;

        if (str.includes(":") || str.includes(".")) {
          str = str.replace(".", ":");
          let parts = str.split(":");
          let h = parseInt(parts[0], 10) || 0;
          let m = parseInt(parts[1], 10) || 0;
          return h * 60 + m;
        } else {
          let h = parseInt(str, 10) || 0;
          return h * 60;
        }
      };

      // 🌟 4. สกัดเวลาจาก Object
      const extractSlots = (course) => {
        let slots = [];
        if (course.day_of_week && course.start_time && course.end_time) {
          slots.push({
            day: normalizeDay(course.day_of_week),
            start: parseToMins(course.start_time),
            end: parseToMins(course.end_time),
          });
        }
        if (Array.isArray(course.class_times)) {
          course.class_times.forEach((ct) => {
            if (
              ct.day &&
              (ct.start !== undefined || ct.start_time) &&
              (ct.end !== undefined || ct.end_time)
            ) {
              slots.push({
                day: normalizeDay(ct.day),
                start: parseToMins(
                  ct.start !== undefined ? ct.start : ct.start_time,
                ),
                end: parseToMins(ct.end !== undefined ? ct.end : ct.end_time),
              });
            }
          });
        }
        if (
          slots.length === 0 &&
          course.day &&
          course.start !== undefined &&
          course.end !== undefined
        ) {
          slots.push({
            day: normalizeDay(course.day),
            start: parseToMins(course.start),
            end: parseToMins(course.end),
          });
        }
        return slots;
      };

      let conflictsList = [];

      // 🌟 5. ตรวจสอบการทับซ้อน
      for (let p of plan) {
        const pCode = p.course_code || p.course_id;
        const pSlots = extractSlots(p);

        if (pSlots.length === 0) continue;

        for (let ex of allExistingItems) {
          const exCode = ex.course_code || ex.course_id;
          const exSlots = extractSlots(ex);

          // ดักวิชาซ้ำ
          if (pCode === exCode) {
            const alreadyLogged = conflictsList.find(
              (c) => c.type === "duplicate" && c.pCode === pCode,
            );
            if (!alreadyLogged) {
              conflictsList.push({
                type: "duplicate",
                pCode,
                source: ex.source,
              });
            }
            continue;
          }

          // เทียบเวลา
          for (let pSlot of pSlots) {
            for (let exSlot of exSlots) {
              if (pSlot.day && exSlot.day && pSlot.day === exSlot.day) {
                if (
                  pSlot.start > 0 &&
                  pSlot.end > 0 &&
                  exSlot.start > 0 &&
                  exSlot.end > 0
                ) {
                  if (pSlot.start < exSlot.end && exSlot.start < pSlot.end) {
                    const alreadyLogged = conflictsList.find(
                      (c) =>
                        c.type === "time" &&
                        c.pCode === pCode &&
                        c.exCode === exCode &&
                        c.pSlot.day === pSlot.day,
                    );

                    if (!alreadyLogged) {
                      conflictsList.push({
                        type: "time",
                        pCode,
                        exCode,
                        source: ex.source,
                        pSlot,
                        exSlot,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 🌟 6. แสดงผลการทับซ้อน
      if (conflictsList.length > 0) {
        setCalculating(false);

        const formatMins = (mins) => {
          const h = Math.floor(mins / 60)
            .toString()
            .padStart(2, "0");
          const m = (mins % 60).toString().padStart(2, "0");
          return `${h}:${m}`;
        };

        let errorMessage = "พบข้อผิดพลาดในแผนการเรียนนี้:\n\n";

        conflictsList.forEach((c, idx) => {
          if (c.type === "duplicate") {
            errorMessage += `${idx + 1}. ⛔️ วิชา ${c.pCode} (คุณลงใน${c.source}ไว้แล้ว)\n\n`;
          } else if (c.type === "time") {
            const pTime = `${c.pSlot.day} ${formatMins(c.pSlot.start)}-${formatMins(c.pSlot.end)}`;
            const exTime = `${c.exSlot.day} ${formatMins(c.exSlot.start)}-${formatMins(c.exSlot.end)}`;

            errorMessage += `${idx + 1}. ⏰ เวลาชนกัน:\n   [ระบบ แนะนำ] ${c.pCode} เรียน ${pTime}\n   [${c.source}] ${c.exCode} เรียน ${exTime}\n\n`;
          }
        });

        // ✅ เรียก Custom Error Pop-up
        showCustomAlert(
          "error",
          "ไม่สามารถลงทะเบียนได้",
          errorMessage + "โปรดเลือก Plan อื่น หรือ ลบวิชาที่ชนกันออก",
          null,
          false,
          "เข้าใจแล้ว",
        );
        return;
      }

      // --- 🌟 7. ถ้ารอดมาได้ (ไม่มีชนเลย) ให้ส่ง API ยืนยันแผนลงตะกร้า ---
      const { BASE_URL } = require("../api");
      const uniqueCourses = [];
      const seenKeys = new Set();

      for (const item of plan) {
        let code = item?.course_code || item?.course_id || item?.code;
        let type = item?.section_type || "T";
        let key = `${code}-${type}`;

        if (code && !seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueCourses.push(item);
        }
      }

      const itemsToBackend = uniqueCourses.map((rawSec) => ({
        course_code: rawSec?.course_code || rawSec?.course_id || rawSec?.code,
        section_number: String(rawSec?.section_number || rawSec?.sec || 1),
        section_type: rawSec?.section_type || "T",
      }));

      const res = await fetch(`${BASE_URL}/cart/batch_add_with_check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.student_id,
          items: itemsToBackend,
        }),
      });

      const data = await res.json();

      if (data.status === "conflict") {
        showCustomAlert(
          "error",
          "พบเวลาเรียนชนกันจากระบบหลังบ้าน!",
          "กรุณาเคลียร์วิชาในตะกร้าออกก่อน",
        );
        return;
      }

      if (!res.ok) {
        throw new Error(data.detail || "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
      }

      // ✅ เรียก Custom Success Pop-up
      showCustomAlert(
        "success",
        "สำเร็จ!",
        "เพิ่มแผนการเรียนที่เลือก ลงตะกร้าเรียบร้อยแล้ว",
        () => setView("CART"),
      );
    } catch (err) {
      showCustomAlert("error", "ข้อผิดพลาด", err.message);
    } finally {
      setCalculating(false);
    }
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

  const handleZCourseClick = async (item) => {
    if (!item.course_code.startsWith("Z")) return;
    setZTargetCourse(item);
    setZModalVisible(true);
    setZLoading(true);
    try {
      const options = await getZOptionsAPI(
        student.student_id,
        item.course_code,
      );

      // 🌟 1. กรองวิชาของสาขาตัวเองออก (เช็คจาก student.major)
      let filteredOptions = options || [];
      const major = student.major || "";

      if (major.includes("วิศวกรรมคอมพิวเตอร์")) {
        filteredOptions = filteredOptions.filter(
          (c) => !c.course_code.startsWith("CPE"),
        );
      } else if (major.includes("เทคโนโลยีสารสนเทศ")) {
        filteredOptions = filteredOptions.filter(
          (c) => !c.course_code.startsWith("ICT"),
        );
      } else if (major.includes("โลจิสติกส์") || major.includes("โซ่อุปทาน")) {
        filteredOptions = filteredOptions.filter(
          (c) => !c.course_code.startsWith("LSM"),
        );
      }

      // 🌟 2. กำจัดวิชาที่ซ้ำกัน (ป้องกัน Error: two children with the same key)
      const uniqueOptions = Array.from(
        new Map(filteredOptions.map((opt) => [opt.course_code, opt])).values(),
      );

      setZOptions(uniqueOptions);
    } catch (error) {
      showCustomAlert(
        "error",
        "ข้อผิดพลาด",
        "ไม่สามารถดึงข้อมูลรายวิชาทดแทนได้",
      );
    } finally {
      setZLoading(false);
    }
  };

  const handleSelectZOption = async (selectedCourse) => {
    try {
      // ใช้ State เช็กวิชา Z ซ้ำ
      const codeToCheck = selectedCourse.course_code;
      if (
        cartCourseCodes.includes(codeToCheck) ||
        scheduleCourseCodes.includes(codeToCheck)
      ) {
        showCustomAlert(
          "warning",
          "ไม่สามารถเลือกได้",
          "คุณมีวิชานี้อยู่ในตะกร้าหรือตารางเรียนแล้ว!",
        );
        return;
      }

      const updatedCourses = availableCourses.map((c) => {
        if (c.course_code === zTargetCourse.course_code) {
          return {
            ...c,
            course_code: selectedCourse.course_code,
            course_name: selectedCourse.course_name,
          };
        }
        return c;
      });
      setAvailableCourses(updatedCourses);

      let newSelected = selectedCodes.filter(
        (code) => code !== zTargetCourse.course_code,
      );
      if (!newSelected.includes(selectedCourse.course_code)) {
        newSelected.push(selectedCourse.course_code);
      }
      setSelectedCodes(newSelected);

      setZModalVisible(false);
      showCustomAlert(
        "success",
        "สำเร็จ",
        `เลือกวิชา ${selectedCourse.course_code} เรียบร้อย`,
      );
    } catch (error) {
      showCustomAlert("error", "ข้อผิดพลาด", "ตรวจสอบข้อมูลล้มเหลว");
    }
  };

  return (
    <LinearGradient
      colors={["#FFDAE4", "#FFF8F8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.3 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setView("MENU")}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>AI Scheduler</Text>
          </View>
          <TouchableOpacity style={styles.bellButton}>
            <MaterialIcons name="more-vert" size={24} color="#514345" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          <View style={styles.heroSection}>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>ระบบจัดตารางเรียนอัจฉริยะ</Text>
              <Text style={styles.heroSubtitle}>
                ให้ ระบบ ช่วยวิเคราะห์และจัดแผนการเรียนที่ดีที่สุด
                สำหรับคุณในภาคเรียนนี้
              </Text>
            </View>
            <View style={styles.heroImageContainer}>
              <MaterialIcons name="auto-awesome" size={48} color="#D23669" />
            </View>
          </View>

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
                  <View style={styles.planHeaderRow}>
                    <Text style={styles.planTitle}>
                      Plan {String.fromCharCode(65 + index)}
                    </Text>
                    {index === 0 && (
                      <View style={styles.badgeRecommended}>
                        <Text style={styles.badgeText}>แนะนำ</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.gridOuterContainer}>
                    <ScrollView
                      horizontal={true}
                      showsHorizontalScrollIndicator={true}
                    >
                      <View
                        style={{
                          width: TOTAL_GRID_WIDTH + DAY_COLUMN_WIDTH + 100,
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

                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                          (dayKey) => (
                            <View key={dayKey} style={styles.dayRow}>
                              <View style={styles.dayLabelContainer}>
                                <Text style={styles.dayTextTh}>
                                  วัน{DAY_MAP[dayKey]}
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
                          ),
                        )}
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

                    return Object.entries(groupedByDay).map(
                      ([dayStr, courses], dIdx) => (
                        <View key={dIdx} style={styles.dayGroupContainer}>
                          <View style={styles.dayGroupHeader}>
                            <Text style={styles.dayGroupTitle}>{dayStr}</Text>
                            <Text style={styles.dayGroupCount}>
                              {courses.length} Subjects
                            </Text>
                          </View>
                          <View style={styles.dayGroupBody}>
                            {courses.map((item, idx) => {
                              const startTime =
                                item.start_time || item.class_times?.[0]?.start;
                              const endTime =
                                item.end_time || item.class_times?.[0]?.end;
                              const isLast = idx === courses.length - 1;
                              const courseInfo = availableCourses.find(
                                (c) => c.course_code === item.course_code,
                              );
                              const courseName =
                                courseInfo?.course_name ||
                                item.course_name ||
                                "ไม่ระบุชื่อวิชา";

                              const secNum = String(
                                item.section_number || item.sec || "1",
                              );
                              const secType =
                                item.section_type || item.type || "T";

                              let remainSeatsText = "";

                              if (
                                courseInfo &&
                                courseInfo.sections &&
                                courseInfo.sections[secNum]
                              ) {
                                const slots = courseInfo.sections[secNum];
                                const targetSlot =
                                  slots.find(
                                    (s) => s.section_type === secType,
                                  ) || slots[0];

                                if (
                                  targetSlot &&
                                  targetSlot.max_seats != null
                                ) {
                                  const cap = Number(targetSlot.max_seats) || 0;
                                  const enr =
                                    Number(targetSlot.enrolled_seats) || 0;
                                  const remain = cap - enr;
                                  remainSeatsText = `  |  ว่าง: ${remain > 0 ? remain : 0}/${cap}`;
                                }
                              } else if (item.max_seats != null) {
                                const cap = Number(item.max_seats) || 0;
                                const enr = Number(item.enrolled_seats) || 0;
                                const remain = cap - enr;
                                remainSeatsText = `  |  ว่าง: ${remain > 0 ? remain : 0}/${cap}`;
                              }

                              return (
                                <TouchableOpacity
                                  key={idx}
                                  style={styles.timelineRow}
                                  activeOpacity={
                                    item.course_code.startsWith("Z") ? 0.7 : 1
                                  }
                                  onPress={() => handleZCourseClick(item)}
                                >
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
                                          : secType === "L"
                                            ? " (ปฏิบัติ)"
                                            : ""}
                                      </Text>
                                    </Text>
                                    <Text
                                      style={styles.timelineCodeText}
                                      numberOfLines={1}
                                    >
                                      {courseName}
                                    </Text>
                                    <Text style={styles.timelineSubText}>
                                      กลุ่ม: {secNum}
                                      {remainSeatsText}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.metaText,
                                        {
                                          color:
                                            item.enrolled_seats >=
                                            item.max_seats
                                              ? "red"
                                              : "#837375",
                                        },
                                      ]}
                                    >
                                      ที่นั่ง: {item.enrolled_seats ?? 0}/
                                      {item.max_seats ?? 0}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ),
                    );
                  })()}

                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={() => handleAcceptSuggestion(plan)}
                  >
                    <LinearGradient
                      colors={["#D23669", "#D23669"]}
                      style={styles.confirmGradient}
                    >
                      <Text style={styles.confirmBtnText}>
                        เลือกแผนนี้ลงตะกร้า
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.plansSection}>
              <Text style={styles.sectionTitle}>1. เลือกวิชาเป้าหมาย</Text>
              <Text style={styles.subText}>
                เลือกวิชาที่คุณต้องการเรียน แล้วให้ AI จับคู่เวลาที่ไม่ชนกัน
              </Text>
              {loadingCourses ? (
                <ActivityIndicator
                  size="large"
                  color="#D23669"
                  style={{ marginTop: 40 }}
                />
              ) : (
                <View style={styles.coursesList}>
                  {(() => {
                    const cartSet = new Set(cartCourseCodes || []);
                    const scheduleSet = new Set(scheduleCourseCodes || []);
                    const selectedSet = new Set(selectedCodes || []);

                    return availableCourses.map((c, index) => {
                      const inCart = cartSet.has(c.course_code);
                      const inSchedule = scheduleSet.has(c.course_code);
                      const isSelected = selectedSet.has(c.course_code);

                      const isLocked = inCart || inSchedule;
                      let lockReason = "";
                      if (inCart) lockReason = " (มีรายวิชาอยู่ในตะกร้าแล้ว)";
                      else if (inSchedule)
                        lockReason = " (มีรายวิชาอยู่ในตารางแล้ว)";

                      return (
                        <TouchableOpacity
                          key={c.course_code}
                          disabled={isLocked}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={[
                            styles.courseSelectionCard,
                            isSelected
                              ? styles.courseSelectionCardSelected
                              : null,
                            isLocked
                              ? {
                                  opacity: 0.5,
                                  backgroundColor: "#F5F5F5",
                                  borderColor: "#E0E0E0",
                                }
                              : null,
                          ]}
                          activeOpacity={0.6}
                          onPress={() => {
                            if (c.course_code.startsWith("Z")) {
                              handleZCourseClick(c);
                            } else {
                              toggleCourse(c.course_code);
                            }
                          }}
                        >
                          <View
                            style={styles.courseSelectionInfo}
                            pointerEvents="none"
                          >
                            <Text
                              style={[
                                styles.csCode,
                                isSelected ? { color: "white" } : null,
                                isLocked ? { color: "#E53935" } : null,
                              ]}
                            >
                              {c.course_code}
                              {isLocked ? (
                                <Text
                                  style={{ fontSize: 10, color: "#E53935" }}
                                >
                                  {lockReason}
                                </Text>
                              ) : null}
                            </Text>
                            <Text
                              style={[
                                styles.csName,
                                isSelected ? { color: "white" } : null,
                              ]}
                              numberOfLines={1}
                            >
                              {c.course_name}
                            </Text>
                          </View>

                          <View
                            pointerEvents="none"
                            style={[
                              styles.csCreditBadge,
                              isSelected
                                ? { backgroundColor: "rgba(255,255,255,0.2)" }
                                : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.csCreditText,
                                isSelected ? { color: "white" } : null,
                              ]}
                            >
                              {c.credits || "-"} หน่วยกิต
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </View>
              )}
              <TouchableOpacity
                style={styles.generateButton}
                onPress={handleAIProcess}
                disabled={calculating}
              >
                <LinearGradient
                  colors={["#D23669", "#D23669"]}
                  style={styles.generateGradient}
                >
                  <MaterialIcons name="auto-awesome" size={20} color="#FFF" />
                  <Text style={styles.generateButtonText}>
                    {calculating ? "กำลังประมวลผล..." : "สร้างตารางอัตโนมัติ"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setView("MENU")}
          >
            <MaterialIcons name="home" size={24} color="#837375" />
            <Text style={styles.navText}>HOME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItemActive}>
            <MaterialIcons name="auto-awesome" size={24} color="#a73355" />
            <Text style={styles.navTextActive}>AI SCHEDULE</Text>
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

        {/* 🌟 Modal เลือกวิชาเสรี (Z-Modal) 🌟 */}
        <Modal visible={zModalVisible} transparent={true} animationType="slide">
          <View style={styles.modalBackground}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {zTargetCourse?.course_code} เลือกวิชาเสรี
                </Text>
                <TouchableOpacity onPress={() => setZModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color="#514345" />
                </TouchableOpacity>
              </View>

              {zLoading ? (
                <ActivityIndicator
                  size="large"
                  color="#D23669"
                  style={{ marginVertical: 20 }}
                />
              ) : (
                <FlatList
                  data={zOptions}
                  keyExtractor={(item, index) => `${item.course_code}-${index}`}
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.zCourseCard,
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        },
                      ]}
                    >
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={styles.zCourseCode}>
                          {item.course_code} {item.course_name}
                        </Text>
                        <Text style={styles.zCourseCredit}>
                          หน่วยกิต: {item.credits}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={{
                          backgroundColor: "#D23669",
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          borderRadius: 8,
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 90,
                        }}
                        onPress={() => handleSelectZOption(item)}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontWeight: "bold",
                            fontSize: 14,
                          }}
                        >
                          เลือกวิชานี้
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* 🌟 Custom Modal UI (ตัว Pop-up สวยๆ) 🌟 */}
        <Modal visible={modalConfig.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <LinearGradient
                colors={
                  modalConfig.type === "success"
                    ? ["#22c55e", "#16a34a"]
                    : modalConfig.type === "error"
                      ? ["#ef4444", "#dc2626"]
                      : modalConfig.type === "warning"
                        ? ["#f59e0b", "#d97706"]
                        : ["#a73355", "#87193e"] // แบบ Confirm ใช้สีแอป
                }
                style={styles.modalCircle}
              >
                <MaterialIcons
                  name={
                    modalConfig.type === "success"
                      ? "check"
                      : modalConfig.type === "error"
                        ? "close"
                        : modalConfig.type === "warning"
                          ? "priority-high"
                          : "help-outline"
                  }
                  size={40}
                  color="white"
                />
              </LinearGradient>

              <Text style={styles.modalTitleText}>{modalConfig.title}</Text>
              <Text style={styles.modalDescText}>{modalConfig.message}</Text>

              <View style={styles.modalButtonRow}>
                {modalConfig.showCancel && (
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={closeModal}
                  >
                    <Text style={styles.modalCancelText}>ยกเลิก</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.modalConfirmBtn,
                    !modalConfig.showCancel && {
                      flex: 0,
                      paddingHorizontal: 40,
                    },
                  ]}
                  onPress={() => {
                    closeModal(); // ปิด Modal ทันที
                    if (modalConfig.onConfirm) modalConfig.onConfirm(); // สั่งรันฟังก์ชันต่อ
                  }}
                >
                  <LinearGradient
                    colors={
                      modalConfig.type === "error"
                        ? ["#ef4444", "#dc2626"]
                        : modalConfig.type === "warning"
                          ? ["#f59e0b", "#d97706"]
                          : ["#D23669", "#a73355"]
                    }
                    style={styles.modalGradientBtn}
                  >
                    <Text style={styles.modalConfirmText}>
                      {modalConfig.confirmText}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 8 },

  heroSection: {
    flexDirection: "row",
    marginBottom: 24,
    padding: 24,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 24,
  },
  heroTextContainer: { flex: 1, paddingRight: 16, justifyContent: "center" },
  heroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1f1a1c",
    marginBottom: 8,
  },
  heroSubtitle: { fontSize: 12, color: "#514345", lineHeight: 20 },
  heroImageContainer: {
    width: 72,
    height: 72,
    backgroundColor: "#FDEEF4",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

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
  subText: { fontSize: 12, color: "#514345", marginBottom: 16 },
  resetText: { fontSize: 12, color: "#a73355", fontWeight: "bold" },

  planCard: {
    backgroundColor: "white",
    borderRadius: 25,
    padding: 12,
    marginBottom: 30,
    elevation: 5,
  },
  planHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  planTitle: { fontSize: 22, fontWeight: "bold", color: "#1f1a1c" },
  badgeRecommended: {
    backgroundColor: "#D23669",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: "white", fontSize: 12, fontWeight: "bold" },

  gridOuterContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  timeHeaderRow: { flexDirection: "row", height: 24, alignItems: "center" },
  timeLabel: { fontSize: 9, color: "#A0A0A0", fontWeight: "500" },

  dayRow: {
    flexDirection: "row",
    height: 42,
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
    padding: 0,
  },
  boxCode: { fontSize: 7, fontWeight: "bold", color: "#333333" },
  boxTime: { fontSize: 6, color: "#666666", marginTop: 1 },

  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  detailTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  detailCode: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f1a1c",
  },
  secBadge: {
    backgroundColor: "#D23669",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  secBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  detailName: {
    fontSize: 14,
    color: "#514345",
    marginBottom: 12,
    fontWeight: "600",
  },
  detailBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: "#837375",
    fontWeight: "500",
  },
  dayGroupContainer: {
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FDEEF4",
    elevation: 2,
    shadowColor: "#9c3b5b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  dayGroupHeader: {
    backgroundColor: "#a73355",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  dayGroupTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  dayGroupCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFDAE4",
  },
  dayGroupBody: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  timelineRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  timelineTimeCol: {
    width: 80,
    paddingLeft: 12,
    alignItems: "flex-end",
  },
  timelineTimeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#837375",
    marginTop: -2,
  },
  timelineCenterCol: {
    width: 30,
    alignItems: "center",
    position: "relative",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D23669",
    zIndex: 2,
  },
  timelineLine: {
    position: "absolute",
    top: 8,
    bottom: -24,
    width: 2,
    backgroundColor: "#FDEEF4",
    zIndex: 1,
  },
  timelineDetailCol: {
    flex: 1,
    paddingRight: 16,
    paddingBottom: 8,
  },
  timelineCodeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f1a1c",
    marginBottom: 6,
    marginTop: -4,
  },
  timelineSubText: {
    fontSize: 12,
    color: "#514345",
    marginBottom: 4,
    lineHeight: 18,
  },
  metaText: {
    fontSize: 11,
    color: "#837375",
    marginTop: 2,
  },

  courseSelectionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(214, 194, 196, 0.2)",
  },
  courseSelectionCardSelected: {
    backgroundColor: "#a73355",
    borderColor: "#a73355",
  },
  courseSelectionInfo: { flex: 1, paddingRight: 10 },
  csCode: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1f1a1c",
    marginBottom: 4,
  },
  csName: { fontSize: 12, color: "#514345" },
  csCreditBadge: {
    backgroundColor: "#FDEEF4",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  csCreditText: { fontSize: 10, fontWeight: "bold", color: "#a73355" },

  generateButton: { borderRadius: 24, overflow: "hidden" },
  generateGradient: {
    flexDirection: "row",
    paddingVertical: 18,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  generateButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },

  confirmBtn: {
    marginTop: 10,
    overflow: "hidden",
    borderRadius: 24,
    alignSelf: "flex-start",
  },
  confirmGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBtnText: { color: "#FFF", fontSize: 14, fontWeight: "bold" },

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
    shadowColor: "#a73355",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
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
    letterSpacing: 0.5,
  },
  navItem: { alignItems: "center", paddingHorizontal: 8, paddingVertical: 10 },
  navText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#837375",
    marginTop: 4,
    letterSpacing: 0.5,
  },

  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "80%",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#1f1a1c" },
  zCourseCard: {
    backgroundColor: "#FDEEF4",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  zCourseCode: { fontSize: 16, fontWeight: "bold", color: "#D23669" },
  zCourseCredit: { fontSize: 12, color: "#514345", marginBottom: 8 },

  // 🌟 Styles สำหรับ Custom Pop-up อัจฉริยะ 🌟
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 30,
    padding: 30,
    alignItems: "center",
    elevation: 10,
  },
  modalCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitleText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f1a1c",
    marginBottom: 10,
    textAlign: "center",
  },
  modalDescText: {
    fontSize: 14,
    color: "#514345",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "center",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
  },
  modalCancelText: {
    color: "#6B7280",
    fontWeight: "bold",
    fontSize: 15,
  },
  modalConfirmBtn: {
    flex: 1,
    borderRadius: 15,
    overflow: "hidden",
  },
  modalGradientBtn: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 15,
  },
});
