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

// 🌟 ยืนยัน 25px ตามคำขอครับ! เล็กจิ๋วสะใจแน่นอน
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

  const [zModalVisible, setZModalVisible] = useState(false);
  const [zOptions, setZOptions] = useState([]);
  const [zTargetCourse, setZTargetCourse] = useState(null); // วิชา Z ที่ถูกกด
  const [zLoading, setZLoading] = useState(false);

  useEffect(() => {
    if (student) loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoadingCourses(true);
    try {
      const data = await getAvailableCoursesAPI(student.student_id);
      setAvailableCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const toggleCourse = (code) =>
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const handleAIProcess = async () => {
    if (selectedCodes.length === 0)
      return Alert.alert("แจ้งเตือน", "กรุณาเลือกวิชาเป้าหมาย");
    setCalculating(true);
    try {
      const result = await aiSuggestAPI(student.student_id, selectedCodes);
      setSuggestions(result || []);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleAcceptSuggestion = async (plan) => {
    setCalculating(true);
    try {
      const { BASE_URL } = require("../api"); // ดึง BASE_URL เผื่อ API เดิมไม่ได้รองรับการส่ง type

      // 🌟 1. กรองโดยใช้ รหัสวิชา + ประเภท (T/L) เป็นคีย์ เพื่อให้เก็บไว้ทั้ง T และ L
      const uniqueCourses = [];
      const seenKeys = new Set();

      for (const item of plan) {
        let code = item?.course_code || item?.course_id || item?.code;
        let type = item?.section_type || "T"; // ดึงประเภทมาด้วย

        let key = `${code}-${type}`; // คีย์จะเป็นเช่น "CPE407-T" และ "CPE407-L"

        if (code && !seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueCourses.push(item);
        }
      }

      // 🌟 2. ยิง API ลงตะกร้า โดยส่ง section_type ไปให้ Database ด้วย
      for (const rawSec of uniqueCourses) {
        let code = rawSec?.course_code || rawSec?.course_id || rawSec?.code;
        let secNum = rawSec?.section_number || rawSec?.sec || 1;
        let type = rawSec?.section_type;

        // ใช้ fetch ยิงตรงเพื่อให้ส่งค่า section_type เข้า database ได้แน่นอน
        const res = await fetch(`${BASE_URL}/cart/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: student.student_id,
            course_code: code,
            section_number: secNum,
            section_type: type, // ส่งประเภทกำกับไปด้วย Database จะได้เก็บเป็น 2 บรรทัด!
          }),
        });

        if (!res.ok) {
          console.warn(`เตือน: ลงวิชา ${code} (${type}) ไม่สำเร็จ`);
        }
      }

      Alert.alert("สำเร็จ!", "เพิ่มลงตะกร้าเรียบร้อยแล้ว", [
        { text: "ไปที่ตะกร้า", onPress: () => setView("CART") },
      ]);
    } catch (err) {
      Alert.alert("ข้อผิดพลาด", err.message);
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
    if (!item.course_code.startsWith("Z")) return; // ถ้าไม่ใช่วิชา Z ไม่ต้องทำอะไร
    setZTargetCourse(item);
    setZModalVisible(true);
    setZLoading(true);
    try {
      const options = await getZOptionsAPI(
        student.student_id,
        item.course_code,
      );
      setZOptions(options);
    } catch (error) {
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถดึงข้อมูลรายวิชาทดแทนได้");
    } finally {
      setZLoading(false);
    }
  };

  const handleSelectZOption = async (selectedCourse) => {
    try {
      // 1. เช็คว่าลงวิชานี้ไปแล้วหรือยัง (ในตะกร้า หรือ ตารางเรียน)
      const cart = await getCartAPI(student.student_id);
      const sched = await getScheduleAPI(student.student_id);
      
      const inCart = cart.some(c => c.course_id === selectedCourse.course_code);
      const inSched = sched.some(s => s.course_id === selectedCourse.course_code);
      
      if (inCart || inSched) {
        Alert.alert("ไม่สามารถเลือกได้", "คุณมีวิชานี้อยู่ในตะกร้าหรือตารางเรียนแล้ว!");
        return;
      }

      // 2. แทนที่รหัสวิชา Z ด้วยวิชาใหม่ ในบล็อคเลือกวิชา (availableCourses)
      const updatedCourses = availableCourses.map(c => {
        if (c.course_code === zTargetCourse.course_code) {
          return {
            ...c,
            course_code: selectedCourse.course_code, // สลับเป็นรหัสใหม่
            course_name: selectedCourse.course_name, // สลับชื่อใหม่
          };
        }
        return c;
      });
      setAvailableCourses(updatedCourses);

      // 3. ติ๊กเลือกวิชานี้ให้ AI นำไปประมวลผลอัตโนมัติ
      let newSelected = selectedCodes.filter(code => code !== zTargetCourse.course_code); // เอา Z ตัวเก่าออก
      if (!newSelected.includes(selectedCourse.course_code)) {
        newSelected.push(selectedCourse.course_code); // ใส่วิชาใหม่เข้าไป
      }
      setSelectedCodes(newSelected);

      setZModalVisible(false);
      Alert.alert("สำเร็จ", `เลือกวิชา ${selectedCourse.course_code} เรียบร้อย`);

    } catch (error) {
      Alert.alert("ข้อผิดพลาด", "ตรวจสอบข้อมูลล้มเหลว");
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>ระบบจัดตารางเรียนอัจฉริยะ</Text>
              <Text style={styles.heroSubtitle}>
                ให้ AI ช่วยวิเคราะห์และจัดแผนการเรียนที่ดีที่สุด
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
                      {/* 🌟 บังคับบวกความกว้างไปอีก 100px เพื่อให้มีพื้นที่เหลือให้ Scroll ทำงานได้ */}
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
                                          {item.course_code}
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
                    // จัดกลุ่มวิชาตามวัน
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
                          {/* Header ปรับสีให้เข้ากับธีม (ชมพู/เบอร์กันดี) */}
                          <View style={styles.dayGroupHeader}>
                            <Text style={styles.dayGroupTitle}>{dayStr}</Text>
                            <Text style={styles.dayGroupCount}>
                              {courses.length} Subjects
                            </Text>
                          </View>

                          {/* List วิชาแบบ Timeline */}
                          <View style={styles.dayGroupBody}>
                            {courses.map((item, idx) => {
                              const startTime =
                                item.start_time || item.class_times?.[0]?.start;
                              const endTime =
                                item.end_time || item.class_times?.[0]?.end;
                              const isLast = idx === courses.length - 1;

                              // 🌟 1. ค้นหาชื่อวิชาจาก availableCourses (เพิ่ม 2 บรรทัดนี้)
                              const courseInfo = availableCourses.find(
                                (c) => c.course_code === item.course_code,
                              );
                              const courseName =
                                courseInfo?.course_name ||
                                item.course_name ||
                                "ไม่ระบุชื่อวิชา";

                              // 🌟 (แถม) ทำเช็ค ทฤษฎี/ปฏิบัติ ให้เหมือนอันที่แล้ว
                              const isLab =
                                item.type === "L" ||
                                item.section_type === "L" ||
                                parseInt(item.section_number || "1") >= 50;
                              const typeLabel = isLab ? "ทฤษฎี" : "ปฏิบัติ";

                              const secNum = String(item.section_number || "1");
                              const roomStr = item.room
                                ? `ห้อง ${item.room}`
                                : "ห้อง 05-0309";

                              return (
                                <TouchableOpacity
                                  key={idx}
                                  style={styles.timelineRow}
                                  activeOpacity={
                                    item.course_code.startsWith("Z") ? 0.7 : 1
                                  }
                                  onPress={() => handleZCourseClick(item)}
                                >
                                  {/* ฝั่งซ้าย: เวลา */}
                                  <View style={styles.timelineTimeCol}>
                                    <Text style={styles.timelineTimeText}>
                                      {formatTimeDisplay(startTime)}-
                                      {formatTimeDisplay(endTime)}
                                    </Text>
                                  </View>

                                  {/* ตรงกลาง: แกนเวลา (สีเข้าธีม) */}
                                  <View style={styles.timelineCenterCol}>
                                    <View style={styles.timelineDot} />
                                    {!isLast && (
                                      <View style={styles.timelineLine} />
                                    )}
                                  </View>

                                  {/* ฝั่งขวา: รายละเอียด (ปรับฟอนต์และสี) */}
                                  <View style={styles.timelineDetailCol}>
                                    <Text style={styles.timelineCodeText}>
                                      {item.course_code}
                                    </Text>

                                    {/* 🌟 2. เปลี่ยนจาก item.course_name เป็นตัวแปร courseName ที่เราหามาได้ */}
                                    <Text style={styles.timelineCodeText}>
                                      {courseName}
                                    </Text>

                                    {/* 🌟 3. อัปเดตกลุ่มให้แสดง ทฤษฎี/ปฏิบัติ ด้วยเลย */}
                                    <Text style={styles.timelineSubText}>
                                      กลุ่ม: {secNum}
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
                  {availableCourses.map((c) => (
                    <TouchableOpacity
                      key={c.course_code}
                      style={[
                        styles.courseSelectionCard,
                        selectedCodes.includes(c.course_code) &&
                          styles.courseSelectionCardSelected,
                      ]}
                      // 🌟 แก้ตรง onPress ด้านล่างนี้
                      onPress={() => {
                        if (c.course_code.startsWith("Z")) {
                          handleZCourseClick(c); // ถ้าเป็น Z ให้เด้ง Popup
                        } else {
                          toggleCourse(c.course_code); // ถ้าปกติ ให้ติ๊กเลือก
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.courseSelectionInfo}>
                        <Text
                          style={[
                            styles.csCode,
                            selectedCodes.includes(c.course_code) && {
                              color: "white",
                            },
                          ]}
                        >
                          {c.course_code}
                        </Text>
                        <Text
                          style={[
                            styles.csName,
                            selectedCodes.includes(c.course_code) && {
                              color: "white",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {c.course_name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.csCreditBadge,
                          selectedCodes.includes(c.course_code) && {
                            backgroundColor: "rgba(255,255,255,0.2)",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.csCreditText,
                            selectedCodes.includes(c.course_code) && {
                              color: "white",
                            },
                          ]}
                        >
                          {c.credits || "-"} หน่วยกิต
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
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
        {/* Modal สำหรับเลือกวิชา Z */}
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
                  keyExtractor={(item) => item.course_code}
                  renderItem={({ item }) => (
                    <View style={styles.zCourseCard}>
                      <Text style={styles.zCourseCode}>{item.course_code} {item.course_name}</Text>
                      <Text style={styles.zCourseCredit}>หน่วยกิต: {item.credits}</Text>
                      
                      {/* แสดง Sec ไว้ให้ดูเฉยๆ */}
                  

                      {/* 🌟 ปุ่มสำหรับเลือกวิชานี้ไปแทนที่ Z */}
                      <TouchableOpacity 
                        style={{ backgroundColor: "#D23669", padding: 10, borderRadius: 8, marginTop: 12, alignItems: "center" }}
                        onPress={() => handleSelectZOption(item)}
                      >
                        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>เลือกวิชานี้</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
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
    backgroundColor: "#FFF9FA",
    borderRadius: 16,
    flexDirection: "row",
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  detailAccent: { width: 5, backgroundColor: "#ffadaf" },
  detailBody: { flex: 1, padding: 12 },
  detailTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  detailCode: { fontSize: 14, fontWeight: "bold", color: "#1f1a1c" },
  detailTime: { fontSize: 11, color: "#837375" },
  detailName: { fontSize: 12, color: "#837375", marginBottom: 8 },
  detailBottom: { flexDirection: "row", justifyContent: "space-between" },
  detailSec: { fontSize: 11, color: "#514345" },
  detailRoom: { fontSize: 11, color: "#837375" },

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
  // --- ส่วนรายละเอียดวิชา ---
  detailCard: {
    backgroundColor: "#FFFFFF", // การ์ดสีขาวล้วน
    borderRadius: 16,
    flexDirection: "row",
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    elevation: 2, // เพิ่มเงาบางๆ สไตล์ Modern
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  // --- ส่วนรายละเอียดวิชา (ล้างไพ่ใหม่) ---
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16, // ใส่ขอบตรงนี้เลย ไม่ต้องใช้ detailBody แล้ว
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
    backgroundColor: "#D23669", // 🌟 สีชมพูเข้ม
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16, // 🌟 ทำให้ขอบมนเป็นแคปซูล
  },
  secBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF", // 🌟 ตัวอักษรสีขาว
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
  // --- ส่วนรายละเอียดวิชา (Timeline สไตล์กลมกลืนกับธีมแอป) ---
  dayGroupContainer: {
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
    borderRadius: 16, // ขอบมนสวยๆ เข้ากับ Card อื่นๆ
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FDEEF4", // สีขอบชมพูอ่อน
    elevation: 2,
    shadowColor: "#9c3b5b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  dayGroupHeader: {
    backgroundColor: "#a73355", // เปลี่ยนจากเขียวเป็นชมพูเข้มให้ตรงกับปุ่ม
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  dayGroupTitle: {
    fontSize: 18,
    fontWeight: "900", // ตัวหนาเน้นๆ
    color: "#FFFFFF",
  },
  dayGroupCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFDAE4", // ชมพูอ่อนๆ สำหรับข้อความรอง
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
    width: 80, // ปรับให้กระชับขึ้น
    paddingLeft: 12,
    alignItems: "flex-end",
  },
  timelineTimeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#837375", // สีเทาอมชมพู
    marginTop: -2, // ขยับให้บรรทัดตรงกับจุด
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
    backgroundColor: "#D23669", // จุดเปลี่ยนเป็นสีชมพูเข้ม
    zIndex: 2,
  },
  timelineLine: {
    position: "absolute",
    top: 8,
    bottom: -24, // ให้เส้นยาวเชื่อมไปยังวิชาถัดไป
    width: 2,
    backgroundColor: "#FDEEF4", // เส้นเชื่อมสีชมพูอ่อน ดูละมุนตา
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
    color: "#1f1a1c", // เปลี่ยนจากสีน้ำเงินเป็นสีดำ/เทาเข้ม ตามธีมแอป
    marginBottom: 6,
    marginTop: -4,
  },
  timelineSubText: {
    fontSize: 12,
    color: "#514345", // สีเทาเข้ม อ่านง่าย สบายตา
    marginBottom: 4,
    lineHeight: 18,
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
  zSecCard: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFDAE4",
  },
  zSecText: { fontSize: 14, fontWeight: "bold", color: "#1f1a1c" },
  zSecDesc: { fontSize: 12, color: "#837375" },
});
