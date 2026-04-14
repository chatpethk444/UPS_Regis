import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
} from "react-native";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
// 🌟 1. Import getScheduleAPI เข้ามาเพื่อดึงวิชาที่เคยลงทะเบียนแล้ว
import {
  getCartAPI,
  removeFromCartAPI,
  confirmEnrollmentAPI,
  getScheduleAPI,
  getCourseSectionsAPI, // ดึงข้อมูลทุก section ของรายวิชานั้น
  addToCartAPI,         // เพิ่มวิชาเข้าตะกร้า
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
  พฤหัสบดี: "พฤหัสบดี",
  ศุกร์: "ศุกร์",
  เสาร์: "เสาร์",
  อาทิตย์: "อาทิตย์",
  จ: "จันทร์",
  อ: "อังคาร",
  พ: "พุธ",
  พฤ: "พฤหัสบดี",
  ศ: "ศุกร์",
  ส: "เสาร์",
  อา: "อาทิตย์",
};

export default function CartScreen({ student, setView }) {
  const [items, setItems] = useState([]);
  const [enrolledItems, setEnrolledItems] = useState([]); // 🌟 2. เพิ่ม State เก็บตารางเรียน
  const [loadingCart, setLoadingCart] = useState(false);
  const [scheduleData, setScheduleData] = useState([]);
  const [selectedToRemove, setSelectedToRemove] = useState([]);
  // 🌟 State แบบใหม่: รองรับการปรับเปลี่ยนหลายวิชาพร้อมกัน
  const [changeSectionModalVisible, setChangeSectionModalVisible] = useState(false);
  const [adjustments, setAdjustments] = useState([]); // [{ target, alternatives, selectedNewSection }]
  const [isSuppressed, setIsSuppressed] = useState(false); // 🌟 เพิ่ม flag เพื่อระงับ Pop-up ชั่วคราว

  // 🌟 โค้ดที่เพิ่มใหม่: เอาไว้คุม Pop-up สวยๆ
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: "success",
    title: "",
    message: "",
    confirmText: "ตกลง",
    showCancel: false,
    onConfirm: null,
  });

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
    const init = async () => {
      const cartData = await fetchCart(false);
      // 🌟 รอ 5 วินาทีหลังจากโหลดเสร็จ ก่อนจะเช็ควิชาเต็ม (ตามความต้องการของผู้ใช้)
      setTimeout(() => {
        if (cartData && cartData.length > 0) {
          checkFullItemsAndSuggest(cartData);
        }
      }, 10000);
    };
    init();

    const intervalId = setInterval(async () => {
      const cartData = await fetchCart(true);
      // 🌟 ในพื้นหลัง ถ้ามีวิชาเต็มและ Modal ยังไม่เปิด ให้เปิดขึ้นมา
      if (cartData && cartData.length > 0 && !changeSectionModalVisible) {
        checkFullItemsAndSuggest(cartData);
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [changeSectionModalVisible]);

  // 🌟 ฟังก์ชันใหม่: เช็ควิชาเต็มและเสนอทางเลือกทันที (ใช้ตอนโหลดหน้า หรือตอนกดยืนยัน)
  const checkFullItemsAndSuggest = async (currentItems = null) => {
    // 🌟 ถ้ากำลังระงับ (เพิ่งเปลี่ยนเสร็จ) หรือ Modal เปิดอยู่แล้ว ให้ข้ามไปเลย
    if (isSuppressed || changeSectionModalVisible) return false;

    try {
      setLoadingCart(true); // 🌟 โชว์ Loading เพื่อให้ผู้ใช้รู้ว่ากำลังเช็คข้อมูลล่าสุด
      
      // ถ้าไม่ได้ส่งข้อมูลมา ให้ Fetch ใหม่จากเซิร์ฟเวอร์โดยตรง เพื่อความชัวร์ 100%
      let itemsToCheck = currentItems;
      if (!itemsToCheck) {
        itemsToCheck = await fetchCart(true); // ดึงข้อมูลใหม่เงียบๆ มาใส่ variable
      }

      if (!itemsToCheck || itemsToCheck.length === 0) {
        setLoadingCart(false);
        return false;
      }

      // กรองหาเฉพาะตัวที่ที่นั่งเต็ม
      const fullItems = itemsToCheck.filter(
        (item) =>
          (item.max_seats || 0) > 0 &&
          (item.enrolled_seats || 0) >= (item.max_seats || 0),
      );

      if (fullItems.length > 0) {
        const uniqueCourseCodes = [...new Set(fullItems.map(it => it.course_code || it.course_id))];
        
        const responses = await Promise.all(
          uniqueCourseCodes.map(code => getCourseSectionsAPI(code).catch(() => []))
        );
        
        const sectionsMap = {};
        uniqueCourseCodes.forEach((code, idx) => {
          sectionsMap[code] = responses[idx];
        });

        const newAdjustments = fullItems.map(target => {
          const courseCode = target.course_code || target.course_id;
          const allSections = sectionsMap[courseCode] || [];
          
          const openSections = allSections.filter(
            (sec) =>
              (sec.max_seats || 0) > 0 &&
              (sec.enrolled_seats || 0) < (sec.max_seats || 0) &&
              (sec.section_number !== target.section_number || sec.section_type !== target.section_type) &&
              sec.section_type === target.section_type
          );

          return { target, alternatives: openSections, selectedNewSection: null };
        });

        setLoadingCart(false); // 🌟 ปิด Loading หลัก เมื่อเตรียมข้อมูลเสร็จ
        const hasAlternatives = newAdjustments.some(adj => adj.alternatives.length > 0);

        if (hasAlternatives) {
          setAdjustments(newAdjustments);
          setChangeSectionModalVisible(true);
          return true;
        } else {
          return false;
        }
      }
      
      setLoadingCart(false);
      return false;
    } catch (e) {
      console.log("Error checking full items:", e);
      setLoadingCart(false);
      return false;
    }
  };

  // 🌟 ปรับ fetchCart ให้รับค่า isBackground และคืนค่าข้อมูล
  const fetchCart = async (isBackground = false) => {
    if (!isBackground) {
      setLoadingCart(true);
      setSelectedToRemove([]);
    }

    try {
      const [cartData, scheduleResponse] = await Promise.all([
        getCartAPI(student.student_id).catch(() => []),
        getScheduleAPI(student.student_id).catch(() => []),
      ]);

      const validCartData = Array.isArray(cartData) ? cartData : [];
      const validScheduleData = Array.isArray(scheduleResponse)
        ? scheduleResponse
        : [];

      setItems(validCartData);
      setEnrolledItems(validScheduleData);

      const rawSchedule = [];
      const normalizeDayTh = (d) => {
        if (!d) return "";
        const dayStr = String(d).trim().toLowerCase();
        const key = Object.keys(DAY_MAP).find(
          (k) => k.toLowerCase() === dayStr,
        );
        return key ? DAY_MAP[key] : dayStr;
      };

      validCartData.forEach((item) => {
        if (item.day_of_week && item.start_time && item.end_time) {
          rawSchedule.push({
            course_code: item.course_code || item.course_id,
            day_of_week: normalizeDayTh(item.day_of_week),
            start_time: String(item.start_time).substring(0, 5),
            end_time: String(item.end_time).substring(0, 5),
            section_type: item.section_type || "T",
          });
        }
      });

      const merged = rawSchedule.reduce((acc, curr) => {
        const existingIdx = acc.findIndex(
          (item) =>
            item.course_code === curr.course_code &&
            item.day_of_week === curr.day_of_week &&
            item.section_type === curr.section_type,
        );

        if (existingIdx !== -1) {
          const parseToMins = (t) => {
            if (!t) return 0;
            const parts = String(t).split(":");
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
          };
          const formatFromMins = (mins) => {
            const h = Math.floor(mins / 60)
              .toString()
              .padStart(2, "0");
            const m = (mins % 60).toString().padStart(2, "0");
            return `${h}:${m}`;
          };

          const ex = acc[existingIdx];
          const s1 = parseToMins(ex.start_time);
          const e1 = parseToMins(ex.end_time);
          const s2 = parseToMins(curr.start_time);
          const e2 = parseToMins(curr.end_time);

          ex.start_time = formatFromMins(Math.min(s1, s2));
          ex.end_time = formatFromMins(Math.max(e1, e2));
        } else {
          acc.push({ ...curr });
        }
        return acc;
      }, []);

      setScheduleData(merged);
      return validCartData; // 🌟 คืนค่าข้อมูล
    } catch (e) {
      if (!isBackground) showCustomAlert("error", "Error", e.message);
      return [];
    } finally {
      if (!isBackground) setLoadingCart(false);
    }
  };

  const getBoxStyle = (startTime, endTime) => {
    const parseTime = (t) => {
      if (!t) return 0;
      let str = String(t);
      if (str.includes(":")) {
        const parts = str.split(":");
        return parseInt(parts[0]) + parseInt(parts[1]) / 60;
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
    if (!time) return "";
    let str = String(time);
    if (str.includes(":")) {
      const parts = str.split(":");
      return `${parseInt(parts[0])}.${parts[1]}`;
    }
    return str;
  };

  const removeItem = (courseCode, sectionType) => {
    showCustomAlert(
      "confirm", // 1. ประเภท: เป็นแบบยืนยัน (จะโชว์ไอคอนเครื่องหมายคำถาม/สีของแอป)
      "ลบวิชา", // 2. หัวข้อ:
      `ต้องการลบ ${courseCode} ออกจากตะกร้าหรือไม่?`, // 3. ข้อความรายละเอียด

      // 4. ฟังก์ชันที่จะรันเมื่อผู้ใช้กดปุ่ม "ตกลง/ลบวิชา"
      async () => {
        try {
          await removeFromCartAPI(student.student_id, courseCode, sectionType);
          fetchCart();
        } catch (e) {
          showCustomAlert("error", "ข้อผิดพลาด", e.message);
        }
      },

      true, // 5. โชว์ปุ่มยกเลิกไหม? (ใส่ true เพราะต้องการให้มีปุ่มยกเลิกด้วย)
      "ลบ", // 6. คำบนปุ่มตกลง (เปลี่ยนจากคำว่า "ตกลง" เป็น "ลบ")
    );
  };

  // 🌟 4. ฟังก์ชันเช็คชนขั้นเด็ดขาด (จับรวมวิชาในตะกร้า + ตารางเรียนมาชนกัน)
  const checkConflicts = () => {
    const allItemsToVerify = [
      ...items.map((c) => ({ ...c, source: "ตะกร้า" })),
      ...enrolledItems.map((c) => ({ ...c, source: "ตารางเรียน" })),
    ];

    for (let i = 0; i < allItemsToVerify.length; i++) {
      for (let j = i + 1; j < allItemsToVerify.length; j++) {
        const c1 = allItemsToVerify[i];
        const c2 = allItemsToVerify[j];

        if (c1.source === "ตารางเรียน" && c2.source === "ตารางเรียน") continue;

        if (
          !c1.day_of_week ||
          !c2.day_of_week ||
          !c1.start_time ||
          !c2.start_time
        )
          continue;

        const normalizeDay = (d) => {
          const str = String(d).replace(/\s+/g, "").toLowerCase();
          if (str.includes("จันทร์") || str.includes("mon")) return "จันทร์";
          if (str.includes("อังคาร") || str.includes("tue")) return "อังคาร";
          if (str.includes("พุธ") || str.includes("wed")) return "พุธ";
          if (str.includes("พฤหัส") || str.includes("thu")) return "พฤหัสบดี";
          if (str.includes("ศุกร์") || str.includes("fri")) return "ศุกร์";
          if (str.includes("เสาร์") || str.includes("sat")) return "เสาร์";
          if (str.includes("อาทิตย์") || str.includes("sun")) return "อาทิตย์";
          return str;
        };

        const day1 = normalizeDay(c1.day_of_week);
        const day2 = normalizeDay(c2.day_of_week);

        if (day1 === day2 && day1 !== "") {
          const parseToMins = (t) => {
            const cleanStr = String(t).replace(/[^\d:.]/g, "");
            const match = cleanStr.match(/(\d{1,2})[:.](\d{2})/);
            if (match)
              return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
            return 0;
          };

          const s1 = parseToMins(c1.start_time);
          const e1 = parseToMins(c1.end_time);
          const s2 = parseToMins(c2.start_time);
          const e2 = parseToMins(c2.end_time);

          const code1 = c1.course_code || c1.course_id || "Unknown1";
          const code2 = c2.course_code || c2.course_id || "Unknown2";

          if (
            code1 === code2 &&
            c1.section_number === c2.section_number &&
            c1.section_type === c2.section_type
          ) {
            if (c1.source !== c2.source) {
              return {
                hasConflict: true,
                isDuplicate: true,
                course1: c1,
                course2: c2,
              };
            }
            continue;
          }

          if (s1 > 0 && e1 > 0 && s2 > 0 && e2 > 0) {
            if (s1 < e2 && s2 < e1) {
              return {
                hasConflict: true,
                isDuplicate: false,
                course1: c1,
                course2: c2,
              };
            }
          }
        }
      }
    }
    return { hasConflict: false };
  };

  const confirmRegistration = async () => {
    // ✅ แก้: ใส่ "warning" เป็นตัวแรก
    if (items.length === 0) {
      showCustomAlert(
        "warning",
        "แจ้งเตือน",
        "ตะกร้าว่างเปล่า ไม่มีวิชาให้ลงทะเบียน",
      );
      return;
    }

    // 🌟 เช็ควิชาเต็มอีกครั้งก่อนกดยืนยันจริงๆ
    const hasFull = await checkFullItemsAndSuggest(items);
    if (hasFull) return; // ถ้ามี Modal เด้ง ให้หยุดการทำงานตรงนี้ก่อน

    const conflictCheck = checkConflicts();

    if (conflictCheck.hasConflict) {
      const c1 = conflictCheck.course1;
      const c2 = conflictCheck.course2;
      const code1 = c1.course_code || c1.course_id;
      const code2 = c2.course_code || c2.course_id;

      if (conflictCheck.isDuplicate) {
        // ✅ แก้: ถอดวงเล็บก้ามปู [{...}] ทิ้งไป ใช้ String เปล่าแทน
        showCustomAlert(
          "error",
          "🚨 ลงทะเบียนซ้ำซ้อน",
          `คุณได้ลงทะเบียนวิชา ${code1} ไปในตารางเรียนแล้ว!\nโปรดลบออกจากตะกร้าก่อน`,
        );
      } else {
        // ✅ แก้: ถอดวงเล็บก้ามปู [{...}] ทิ้งไป
        showCustomAlert(
          "error",
          "🚨 พบเวลาเรียนทับซ้อน!",
          `วิชา ${code1} (ใน${c1.source})\nทับซ้อนกับ ${code2} (ใน${c2.source})\n\nโปรดแก้ไขให้เรียบร้อยก่อนกดยืนยัน`,
        );
      }
      return; // ⛔️ เตะออก ไม่ยอมให้เรียก API ลงทะเบียนเด็ดขาด!
    }

    // ✅ แก้: ฟังก์ชันกดยืนยันที่ถูกต้อง จัดเรียงพารามิเตอร์ครบ 6 ตัว
    showCustomAlert(
      "confirm",
      "ยืนยัน",
      "ต้องการลงทะเบียนวิชาในตะกร้าทั้งหมดหรือไม่?",
      async () => {
        try {
          await confirmEnrollmentAPI(student.student_id);
          // ถ้าลงทะเบียนผ่าน ให้เด้ง Pop-up Success แล้วพอปิดค่อยไปหน้า Schedule
          showCustomAlert("success", "สำเร็จ", "ลงทะเบียนเรียบร้อย!", () =>
            setView("SCHEDULE"),
          );
        } catch (e) {
          showCustomAlert("error", "ข้อผิดพลาด", e.message);
        }
      },
      true,
      "ยืนยัน",
    );
  };

  
  // 🌟 ฟังก์ชันสลับ Section ในตะกร้า (แบบใหม่ รองรับหลายวิชา)
  const handleApplyNewSection = async () => {
    // กรองเอาเฉพาะรายการที่ผู้ใช้เลือกเปลี่ยนจริง
    const itemsToChange = adjustments.filter(adj => adj.selectedNewSection !== null);
    if (itemsToChange.length === 0) {
      setChangeSectionModalVisible(false);
      return;
    }

    try {
      setChangeSectionModalVisible(false);
      setIsSuppressed(true); // 🌟 ระงับการเช็คทันที
      setLoadingCart(true);

      // วนลูปเปลี่ยนทีละวิชา/ประเภท
      for (const adj of itemsToChange) {
        const { target, selectedNewSection: selected } = adj;
        const courseCode = target.course_code || target.course_id;

        // ลบวิชา (Section เก่าที่เต็ม)
        await removeFromCartAPI(student.student_id, courseCode, target.section_type);
        
        // Add วิชา (Section ใหม่ที่เลือก)
        await addToCartAPI(student.student_id, courseCode, selected.section_number, selected.section_type);
      }

      await fetchCart(false); // โหลดตะกร้าใหม่
      setLoadingCart(false);

      showCustomAlert("success", "เปลี่ยน Section สำเร็จ", `อัปเดตวิชาที่เลือกให้เรียบร้อยแล้ว`, () => {
        // 🌟 หลังจากกดตกลง ให้รออีก 5 วินาที แล้วค่อยเปิดการเช็คใหม่อีกรอบ
        setTimeout(() => {
          setIsSuppressed(false);
        }, 5000);
      });
    } catch (error) {
      console.log("สาเหตุที่ API พัง:", error);
      setLoadingCart(false);
      setIsSuppressed(false); // ถ้าพังให้เปิดการเช็คกลับมา
      showCustomAlert("error", "เปลี่ยน Section ไม่สำเร็จ", error.message);
    }
  };

  // Helper สำหรับการเลือก Section ในรายการ Adjustment
  const updateAdjustmentSelection = (adjIndex, section) => {
    const newAdjustments = [...adjustments];
    newAdjustments[adjIndex].selectedNewSection = section;
    setAdjustments(newAdjustments);
  };

  // 🌟 2. ฟังก์ชัน Toggle Checkbox
  const toggleSelection = (courseCode, sectionType) => {
    const id = `${courseCode}|${sectionType}`;
    if (selectedToRemove.includes(id)) {
      setSelectedToRemove((prev) => prev.filter((item) => item !== id));
    } else {
      setSelectedToRemove((prev) => [...prev, id]);
    }
  };

  // 🌟 3. ฟังก์ชันลบวิชาที่เลือกพร้อมกันหลายรายการ
  const removeMultipleItems = () => {
    showCustomAlert(
      "confirm",
      "ลบวิชาที่เลือก",
      `ต้องการลบวิชาที่เลือกทั้ง ${selectedToRemove.length} รายการออกจากตะกร้าหรือไม่?`,
      async () => {
        try {
          setLoadingCart(true);
          const promises = selectedToRemove.map((id) => {
            const [code, type] = id.split("|");
            return removeFromCartAPI(student.student_id, code, type);
          });
          await Promise.all(promises);

          showCustomAlert(
            "success",
            "สำเร็จ",
            "ลบวิชาออกจากตะกร้าเรียบร้อยแล้ว",
          );
          fetchCart(); // รีเฟรชตารางใหม่
        } catch (e) {
          showCustomAlert("error", "ข้อผิดพลาด", e.message);
          setLoadingCart(false);
        }
      },
      true,
      "ลบ",
    );
  };

  return (
    <LinearGradient colors={["#FFDAE4", "#FFF8F8"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setView("MENU")}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ตะกร้าของฉัน</Text>
          {/* 🌟 ปรับตรงนี้ */}
          <TouchableOpacity onPress={() => fetchCart(false)}>
            <MaterialIcons name="refresh" size={24} color="#a73355" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loadingCart ? (
            <ActivityIndicator
              size="large"
              color="#a73355"
              style={{ marginTop: 50 }}
            />
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="shopping-cart" size={80} color="#d6c2c4" />
              <Text style={styles.emptyText}>ยังไม่มีวิชาในตะกร้า</Text>
            </View>
          ) : (
            <>
              {/* 🗓️ Grid Preview */}
              <View style={styles.gridOuterContainer}>
                <ScrollView
                  horizontal={true}
                  showsHorizontalScrollIndicator={true}
                >
                  <View
                    style={{ width: TOTAL_GRID_WIDTH + DAY_COLUMN_WIDTH + 100 }}
                  >
                    {/* Time Labels */}
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

                    {/* Day Rows */}
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

                            {scheduleData
                              .filter(
                                (course) =>
                                  course.day_of_week === DAY_MAP[dayKey],
                              )
                              .map((item, idx) => {
                                const pos = getBoxStyle(
                                  item.start_time,
                                  item.end_time,
                                );
                                return (
                                  <View
                                    key={`${item.course_code}-${item.section_type}-${idx}`} // 🌟 เพิ่ม section_type ใน key กัน React แจ้งเตือน duplicate
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
                                      {/* 🌟 เพิ่ม (T) หรือ (L) ต่อท้ายรหัสวิชา */}
                                      {item.course_code}{" "}
                                      {item.section_type
                                        ? `(${item.section_type})`
                                        : ""}
                                    </Text>
                                    <Text
                                      style={styles.boxTime}
                                      numberOfLines={1}
                                    >
                                      {formatTimeDisplay(item.start_time)}-
                                      {formatTimeDisplay(item.end_time)}
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

              {/* 🌟 4. Course Detail Header พร้อมปุ่มลบรวม */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 20,
                  marginBottom: 10,
                }}
              >
                <Text style={styles.sectionTitle}>รายละเอียดวิชา</Text>
                {selectedToRemove.length > 0 && (
                  <TouchableOpacity
                    onPress={removeMultipleItems}
                    style={{
                      backgroundColor: "#E53935",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Feather
                      name="trash-2"
                      size={16}
                      color="#FFF"
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={{
                        color: "#FFF",
                        fontWeight: "bold",
                        fontSize: 12,
                      }}
                    >
                      ลบที่เลือก ({selectedToRemove.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {items.map((item, idx) => {
                const dayStr = item.day_of_week || "";
                const startTime = item.start_time
                  ? item.start_time.substring(0, 5)
                  : "";
                const endTime = item.end_time
                  ? item.end_time.substring(0, 5)
                  : "";

                const maxSeats = item.max_seats || 0;
                const enrolledSeats = item.enrolled_seats || 0;
                const isFull = enrolledSeats >= maxSeats && maxSeats > 0;

                // 🌟 ID สำหรับเช็คการกดเลือก
                const itemId = `${item.course_code || item.course_id}|${item.section_type}`;
                const isSelected = selectedToRemove.includes(itemId);

                return (
                  <TouchableOpacity
                    key={`${item.course_code || item.course_id}-${item.section_type}-${idx}`}
                    style={[
                      styles.detailCard,
                      isSelected && { borderColor: "#a73355", borderWidth: 2 }, // กรอบสีแดงเมื่อเลือก
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      toggleSelection(
                        item.course_code || item.course_id,
                        item.section_type,
                      )
                    }
                  >
                    <View style={styles.cardAccent} />
                    <View style={styles.cardBody}>
                      <View style={styles.cardTop}>
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          {/* 🌟 แสดงไอคอน Checkbox */}
                          <MaterialIcons
                            name={
                              isSelected
                                ? "check-box"
                                : "check-box-outline-blank"
                            }
                            size={22}
                            color={isSelected ? "#a73355" : "#ccc"}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.detailCode}>
                            {item.course_code || item.course_id} Sec{" "}
                            {item.section_number || "1"}{" "}
                            {item.section_type ? `(${item.section_type})` : ""}
                          </Text>
                        </View>
                        <Text style={styles.detailTime}>
                          {dayStr && startTime
                            ? `วัน${DAY_MAP[dayStr] || dayStr} ${startTime}-${endTime} น.`
                            : "ไม่มีข้อมูลเวลาเรียน"}
                        </Text>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginLeft: 30, // 🌟 เขยิบข้อความให้ตรงหลบ Checkbox
                        }}
                      >
                        <Text style={styles.courseName} numberOfLines={1}>
                          {item.course_name}
                        </Text>

                        {/* 🌟 ปุ่มลบทีละวิชา (ยังคงเก็บไว้เผื่ออยากกดลบแบบเร็วๆ ทีละตัว) */}
                        <TouchableOpacity
                          onPress={() =>
                            removeItem(
                              item.course_code || item.course_id,
                              item.section_type,
                            )
                          }
                          style={{ padding: 4 }}
                        >
                          <Feather name="trash-2" size={18} color="#E53935" />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.cardBottom, { marginLeft: 30 }]}>
                        <Text style={styles.metaText}>
                          {item.credits
                            ? `${item.credits} หน่วยกิต`
                            : "ไม่ระบุหน่วยกิต"}
                        </Text>
                        <Text style={styles.metaText}>
                          {item.section_type === "T"
                            ? "ทฤษฎี"
                            : item.section_type === "L"
                              ? "ปฏิบัติ"
                              : ""}
                        </Text>

                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          <Text style={styles.metaText}>ที่นั่ง: </Text>
                          <Text
                            style={[
                              styles.metaText,
                              {
                                color: isFull ? "#D32F2F" : "#2E7D32",
                                fontWeight: "bold",
                              },
                            ]}
                          >
                            {`ลงแล้ว ${enrolledSeats} / ${maxSeats}`}
                          </Text>
                          {isFull && (
                            <Text
                              style={{
                                color: "#D32F2F",
                                fontSize: 10,
                                marginLeft: 4,
                              }}
                            >
                              (เต็ม)
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmRegistration}
              >
                <LinearGradient
                  colors={["#a73355", "#7b1d3a"]}
                  style={styles.gradientButton}
                >
                  <MaterialIcons name="check-circle" size={24} color="white" />
                  <Text style={styles.confirmButtonText}>
                    ยืนยันการลงทะเบียน
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
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

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setView("MANUAL")}
          >
            <MaterialIcons name="list" size={24} color="#837375" />
            <Text style={styles.navText}>COURSES</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItemActive}>
            <MaterialIcons name="shopping-cart" size={24} color="#a73355" />
            <Text style={styles.navTextActive}>CART</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setView("SCHEDULE")}
          >
            <MaterialIcons name="calendar-today" size={24} color="#837375" />
            <Text style={styles.navText}>SCHEDULE</Text>
          </TouchableOpacity>
        </View>
        {/* 🌟 โค้ดที่เพิ่มใหม่: หน้าตา Pop-up 🌟 */}
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
                        : ["#a73355", "#87193e"]
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
                      paddingHorizontal: 50,
                    },
                  ]}
                  onPress={() => {
                    closeModal();
                    if (modalConfig.onConfirm) modalConfig.onConfirm();
                  }}
                >
                  <LinearGradient
                    colors={
                      modalConfig.type === "error"
                        ? ["#ef4444", "#dc2626"]
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

        {/* 🌟 Pop-up สำหรับเปลี่ยน Section อัตโนมัติ (แบบใหม่ รองรับหลายวิชาพร้อมกัน) 🌟 */}
        <Modal visible={changeSectionModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.sectionModalContainer}>
              
              <View style={styles.sectionModalHeader}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "bold", color: "#D32F2F" }}>🚨 ที่นั่งเต็ม!</Text>
                  <Text style={{ fontSize: 14, color: "#514345", marginTop: 4 }}>พบวิชาในตะกร้าที่ที่นั่งเต็มแล้ว</Text>
                </View>
                <TouchableOpacity onPress={() => setChangeSectionModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color="#837375" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {adjustments.map((adj, adjIdx) => {
                  const target = adj.target;
                  const typeLabel = target.section_type === "T" ? "ทฤษฎี" : "ปฏิบัติ";
                  
                  return (
                    <View key={adjIdx} style={{ marginBottom: 20, borderBottomWidth: adjIdx < adjustments.length - 1 ? 1 : 0, borderBottomColor: "#eee", pb: 16 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: "bold", color: "#a73355" }}>
                          {target.course_code || target.course_id} - {typeLabel}
                        </Text>
                        <View style={{ backgroundColor: "#ffebee", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 11, color: "#d32f2f" }}>เดิม: วัน{DAY_MAP[target.day_of_week] || target.day_of_week} Sec {target.section_number} เวลา {String(target.start_time).substring(0,5)}-{String(target.end_time).substring(0,5)} น.</Text>
                        </View>
                      </View>

                      {adj.alternatives.length > 0 ? (
                        <View>
                          <Text style={{ fontSize: 13, color: "#837375", marginBottom: 8 }}>เลือกกลุ่มเรียนใหม่ที่ยังว่าง:</Text>
                          {adj.alternatives.map((sec, secIdx) => {
                            const isSelected = adj.selectedNewSection?.section_number === sec.section_number;
                            return (
                              <TouchableOpacity
                                key={secIdx}
                                style={[
                                  styles.sectionOptionCard, 
                                  { paddingVertical: 10, marginBottom: 6 },
                                  isSelected && { borderColor: "#a73355", backgroundColor: "#fff5f7" }
                                ]}
                                onPress={() => updateAdjustmentSelection(adjIdx, sec)}
                              >
                                <MaterialIcons 
                                  name={isSelected ? "radio-button-checked" : "radio-button-unchecked"} 
                                  size={20} 
                                  color={isSelected ? "#a73355" : "#ccc"} 
                                />
                                <View style={{ marginLeft: 10, flex: 1 }}>
                                  <Text style={{ fontSize: 14, fontWeight: "bold", color: "#1f1a1c" }}>
                                    Sec {sec.section_number} ({sec.section_type})
                                  </Text>
                                  <Text style={{ fontSize: 11, color: "#837375" }}>
                                    วัน{DAY_MAP[sec.day_of_week] || sec.day_of_week} {String(sec.start_time).substring(0,5)}-{String(sec.end_time).substring(0,5)} น.
                                  </Text>
                                </View>
                                <View style={{ alignItems: "flex-end" }}>
                                  <Text style={{ fontSize: 11, color: "#837375" }}>{sec.enrolled_seats}/{sec.max_seats}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={{ padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8, alignItems: "center" }}>
                          <Text style={{ fontSize: 13, color: "#d32f2f", fontWeight: "bold" }}>❌ ไม่มีกลุ่มอื่นว่างแล้ว</Text>
                          <Text style={{ fontSize: 12, color: "#837375", marginTop: 2 }}>กรุณาลบวิชานี้ออกจากตะกร้า</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: "row", marginTop: 20, gap: 12 }}>
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: "#f5ebed", paddingVertical: 14, borderRadius: 12, alignItems: "center" }}
                  onPress={() => setChangeSectionModalVisible(false)}
                >
                  <Text style={{ color: "#837375", fontWeight: "bold" }}>ยกเลิก</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ 
                    flex: 1, 
                    opacity: adjustments.some(a => a.selectedNewSection !== null) ? 1 : 0.5 
                  }}
                  disabled={!adjustments.some(a => a.selectedNewSection !== null)}
                  onPress={handleApplyNewSection}
                >
                  <LinearGradient colors={["#a73355", "#7b5455"]} style={{ paddingVertical: 14, borderRadius: 12, alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>ยืนยันการเปลี่ยน</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </Modal>

        {/* 🌟 Loading Overlay สำหรับป้องกันการกดทับขณะประมวลผล 🌟 */}
        {loadingCart && (
          <View 
            style={{ 
              position: "absolute", 
              top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: "rgba(255,255,255,0.7)", 
              justifyContent: "center", 
              alignItems: "center", 
              zIndex: 9999 
            }}
          >
            <View style={{ backgroundColor: "white", padding: 30, borderRadius: 20, elevation: 10, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#a73355" />
              <Text style={{ marginTop: 15, fontWeight: "bold", color: "#7b5455" }}>กำลังอัปเดตข้อมูล...</Text>
            </View>
          </View>
        )}
        
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
    padding: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#7b5455" },
  backButton: { padding: 8, backgroundColor: "white", borderRadius: 12 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 150 },

  gridOuterContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    elevation: 3,
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
  dayTextTh: { fontSize: 8, fontWeight: "bold", color: "#514345" },
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
    top: 4,
    bottom: 4,
    backgroundColor: "#FFAEB5",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
  },

  boxCode: { fontSize: 7, fontWeight: "bold", color: "#333333" },
  boxTime: { fontSize: 6, color: "#666666", marginTop: 1 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f1a1c",
    marginBottom: 12,
  },
  detailCard: {
    flexDirection: "row",
    backgroundColor: "#FFF9FA",
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    elevation: 2,
  },
  cardAccent: { width: 5, backgroundColor: "#ffadaf" },
  cardBody: { flex: 1, padding: 12 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  detailCode: { fontSize: 14, fontWeight: "bold", color: "#1f1a1c" },
  detailTime: { fontSize: 11, color: "#837375" },
  courseName: { fontSize: 13, color: "#514345", marginBottom: 8, flex: 1 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: 11, color: "#837375" },

  confirmButton: {
    marginTop: 10,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 5,
  },
  gradientButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },

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
  navItem: { alignItems: "center", paddingHorizontal: 8, paddingVertical: 10 },
  navItemActive: {
    alignItems: "center",
    backgroundColor: "#FDEEF4",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  navText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#837375",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  navTextActive: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#a73355",
    marginTop: 4,
    letterSpacing: 0.5,
  },

  emptyBox: { alignItems: "center", marginTop: 100 },
  emptyText: { fontSize: 16, color: "#837375", marginTop: 10 },

  // 🌟 โค้ดที่เพิ่มใหม่: CSS ของ Pop-up
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
  modalCancelText: { color: "#6B7280", fontWeight: "bold", fontSize: 15 },
  modalConfirmBtn: { flex: 1, borderRadius: 15, overflow: "hidden" },
  modalGradientBtn: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: { color: "white", fontWeight: "bold", fontSize: 15 },

  /* 🌟 Modal เปลี่ยน Section 🌟 */
  sectionModalContainer: { width: "100%", backgroundColor: "#ffffff", borderRadius: 24, padding: 24, elevation: 10 },
  sectionModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: "#f0f0f0", paddingBottom: 12, marginBottom: 12 },
  sectionOptionCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fafafa", borderWidth: 1, borderColor: "#f0f0f0", padding: 16, borderRadius: 12, marginBottom: 8 },

  bottomNav: { position: "absolute", bottom: 20, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#ffffff", borderRadius: 40, paddingHorizontal: 8, paddingVertical: 8, elevation: 10, shadowColor: "#a73355", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20 },
  navItem: { alignItems: "center", paddingHorizontal: 8 },
  navText: { fontSize: 9, fontWeight: "bold", color: "#837375", marginTop: 4 },
  navItemActive: { alignItems: "center", backgroundColor: "#f5ebed", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  navTextActive: { fontSize: 9, fontWeight: "bold", color: "#a73355", marginTop: 4 },
});
