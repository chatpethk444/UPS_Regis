
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
  Alert,
} from "react-native";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
// 🌟 1. Import getScheduleAPI เข้ามาเพื่อดึงวิชาที่เคยลงทะเบียนแล้ว
import {
  getCartAPI,
  removeFromCartAPI,
  confirmEnrollmentAPI,
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

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    setLoadingCart(true);
    try {
      // 🌟 3. ดึงข้อมูลทั้ง 2 แหล่ง (ตะกร้า และ ตารางเรียนปัจจุบัน)
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
            item.day_of_week === curr.day_of_week,
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
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoadingCart(false);
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
    Alert.alert("ลบวิชา", `ต้องการลบ ${courseCode} ออกจากตะกร้าหรือไม่?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          try {
            await removeFromCartAPI(
              student.student_id,
              courseCode,
              sectionType,
            );
            fetchCart();
          } catch (e) {
            Alert.alert("ข้อผิดพลาด", e.message);
          }
        },
      },
    ]);
  };

  // 🌟 4. ฟังก์ชันเช็คชนขั้นเด็ดขาด (จับรวมวิชาในตะกร้า + ตารางเรียนมาชนกัน)
  const checkConflicts = () => {
    // เอาข้อมูลตะกร้า และ ตารางเรียน มารวมกันชั่วคราวเพื่อตรวจการทับซ้อน
    const allItemsToVerify = [
      ...items.map((c) => ({ ...c, source: "ตะกร้า" })),
      ...enrolledItems.map((c) => ({ ...c, source: "ตารางเรียน" })),
    ];

    for (let i = 0; i < allItemsToVerify.length; i++) {
      for (let j = i + 1; j < allItemsToVerify.length; j++) {
        const c1 = allItemsToVerify[i];
        const c2 = allItemsToVerify[j];

        // ถ้าทั้ง 2 วิชามันอยู่ใน "ตารางเรียน" ทั้งคู่อยู่แล้ว ข้ามได้เลย ไม่ต้องตรวจ (เพราะลงไปแล้ว)
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

          // เช็คการลงวิชาซ้ำ (เช่น วิชานี้มีในตารางเรียนแล้ว แต่ดันมากดลงซ้ำในตะกร้า)
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

          // เช็คเวลาเหลื่อมกัน
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

  const confirmRegistration = () => {
    if (items.length === 0) {
      Alert.alert("แจ้งเตือน", "ตะกร้าว่างเปล่า ไม่มีวิชาให้ลงทะเบียน");
      return;
    }

    // 🌟 0. เช็คที่นั่งเต็มก่อน
    const fullItems = items.filter(
      (item) => (item.max_seats || 0) > 0 && (item.enrolled_seats || 0) >= (item.max_seats || 0),
    );

    if (fullItems.length > 0) {
      const courseNames = fullItems
        .map((c) => `${c.course_code || c.course_id} (Sec ${c.section_number})`)
        .join(", ");
      return Alert.alert(
        "ไม่สามารถลงทะเบียนได้",
        `วิชาต่อไปนี้ที่นั่งเต็มแล้ว: ${courseNames}\nกรุณาลบออกจากตะกร้าก่อนกดยืนยัน`,
      );
    }

    // 🌟 5. รันฟังก์ชันตรวจจับชนก่อนที่จะเด้ง Popup ยืนยัน
    const conflictCheck = checkConflicts();

    if (conflictCheck.hasConflict) {
      const c1 = conflictCheck.course1;
      const c2 = conflictCheck.course2;
      const code1 = c1.course_code || c1.course_id;
      const code2 = c2.course_code || c2.course_id;

      if (conflictCheck.isDuplicate) {
        Alert.alert(
          "🚨 ลงทะเบียนซ้ำซ้อน",
          `คุณได้ลงทะเบียนวิชา ${code1} ไปในตารางเรียนแล้ว!\nโปรดลบออกจากตะกร้าก่อน`,
          [{ text: "เข้าใจแล้ว", style: "cancel" }],
        );
      } else {
        Alert.alert(
          "🚨 พบเวลาเรียนทับซ้อน!",
          `วิชา ${code1} (ใน${c1.source})\nทับซ้อนกับ ${code2} (ใน${c2.source})\n\nโปรดแก้ไขให้เรียบร้อยก่อนกดยืนยัน`,
          [{ text: "ตกลง", style: "cancel" }],
        );
      }
      return; // ⛔️ เตะออก ไม่ยอมให้เรียก API ลงทะเบียนเด็ดขาด!
    }

    Alert.alert("ยืนยัน", "ต้องการลงทะเบียนวิชาในตะกร้าทั้งหมดหรือไม่?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ยืนยัน",
        onPress: async () => {
          try {
            await confirmEnrollmentAPI(student.student_id);
            Alert.alert("สำเร็จ", "ลงทะเบียนเรียบร้อย!");
            setView("SCHEDULE");
          } catch (e) {
            Alert.alert("ข้อผิดพลาด", e.message);
          }
        },
      },
    ]);
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
          <TouchableOpacity onPress={fetchCart}>
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
                                    key={`${item.course_code}-${idx}`}
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

              {/* Course Detail List */}
<Text style={styles.sectionTitle}>รายละเอียดวิชา</Text>
{items.map((item, idx) => {
  const dayStr = item.day_of_week || "";
  const startTime = item.start_time ? item.start_time.substring(0, 5) : "";
  const endTime = item.end_time ? item.end_time.substring(0, 5) : "";

  // 🌟 ดึงค่าจาก API: max_seats (ทั้งหมด) และ enrolled_seats (ลงแล้ว)
  const maxSeats = item.max_seats || 0;
  const enrolledSeats = item.enrolled_seats || 0;
  
  // เช็คว่าเต็มหรือยัง
  const isFull = enrolledSeats >= maxSeats && maxSeats > 0;

  return (
    <View
      key={`${item.course_code || item.course_id}-${item.section_type}-${idx}`}
      style={styles.detailCard}
    >
      <View style={styles.cardAccent} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.detailCode}>
            {item.course_code || item.course_id} Sec{" "}
            {item.section_number || "1"}{" "}
            {item.section_type ? `(${item.section_type})` : ""} 
          </Text>
          <Text style={styles.detailTime}>
            {dayStr && startTime
              ? `วัน${DAY_MAP[dayStr] || dayStr} ${startTime}-${endTime} น.`
              : "ไม่มีข้อมูลเวลาเรียน"}
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.courseName} numberOfLines={1}>
            {item.course_name}
          </Text>
          <TouchableOpacity
            onPress={() => removeItem(item.course_code || item.course_id, item.section_type)}
            style={{ padding: 4 }}
          >
            <Feather name="trash-2" size={18} color="#E53935" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.metaText}>
            {item.credits ? `${item.credits} หน่วยกิต` : "ไม่ระบุหน่วยกิต"}
          </Text>
          <Text style={styles.metaText}>
            {item.section_type === "T" ? "ทฤษฎี" : item.section_type === "L" ? "ปฏิบัติ" : ""}
          </Text>

          {/* 🌟 แสดงผลแบบ ลงแล้ว / ทั้งหมด (เช่น 1 / 40) */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.metaText}>ที่นั่ง: </Text>
            <Text
              style={[
                styles.metaText,
                {
                  // ถ้าเต็มจะขึ้นสีแดง ถ้ายังไม่เต็มจะเป็นสีเขียว/เทาเข้ม
                  color: isFull ? "#D32F2F" : "#2E7D32", 
                  fontWeight: "bold",
                },
              ]}
            >
              {`ลงแล้ว ${enrolledSeats} / ${maxSeats}`} 
            </Text>
            {isFull && <Text style={{ color: '#D32F2F', fontSize: 10, marginLeft: 4 }}>(เต็ม)</Text>}
          </View>
        </View>
      </View>
    </View>
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
            <MaterialIcons name="search" size={24} color="#837375" />
            <Text style={styles.navText}>SEARCH</Text>
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
});
