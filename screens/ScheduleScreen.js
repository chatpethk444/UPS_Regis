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
// 🌟 1. อย่าลืมเพิ่ม withdrawCourseAPI ไว้ใน api.js ของคุณด้วย (หรือใช้ API ถอนรายวิชาที่คุณมี)
import { getScheduleAPI, withdrawCourseAPI } from "../api";

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
  Tuesday: 2,
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
  จันทร์: 1,
  อังคาร: 2,
  พุธ: 3,
  พฤหัสบดี: 4,
  พฤหัส: 4,
  ศุกร์: 5,
  เสาร์: 6,
  อาทิตย์: 7,
};

export default function ScheduleScreen({ student, setView }) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🌟 2. เพิ่ม State สำหรับเก็บวิชาที่เลือกถอน
  const [selectedToWithdraw, setSelectedToWithdraw] = useState([]);

  useEffect(() => {
    if (student) fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    setLoading(true);
    setSelectedToWithdraw([]); // เคลียร์ Checkbox ทุกครั้งที่โหลดใหม่
    try {
      const data = await getScheduleAPI(student.student_id);

      if (Array.isArray(data)) {
        const parseTime = (t) => {
          if (!t) return 0;
          const str = String(t);
          if (str.includes(":"))
            return (
              parseInt(str.split(":")[0]) * 60 + parseInt(str.split(":")[1])
            );
          if (str.includes("."))
            return (
              parseInt(str.split(".")[0]) * 60 +
              Math.round(parseFloat(`0.${str.split(".")[1]}`) * 60)
            );
          return parseFloat(str) * 60;
        };

        const formatTime = (mins) => {
          const h = Math.floor(mins / 60)
            .toString()
            .padStart(2, "0");
          const m = (mins % 60).toString().padStart(2, "0");
          return `${h}:${m}`;
        };

        const mergedSchedule = data.reduce((acc, curr) => {
          const dayCurr = curr.day_of_week || curr.class_times?.[0]?.day;

          const startCurr = parseTime(
            curr.start_time || curr.class_times?.[0]?.start,
          );
          const endCurr = parseTime(
            curr.end_time || curr.class_times?.[0]?.end,
          );

          let currentType =
            curr.section_type || curr.type || curr.class_times?.[0]?.type;
          if (!currentType) {
            currentType = endCurr - startCurr > 120 ? "L" : "T";
          }

          const existingIdx = acc.findIndex((item) => {
            const dayItem = item.day_of_week || item.class_times?.[0]?.day;
            const isSameCourseAndDay =
              item.course_code === curr.course_code &&
              (dayItem === dayCurr || DAY_MAP[dayItem] === DAY_MAP[dayCurr]);

            if (isSameCourseAndDay) {
              const startEx = parseTime(
                item.start_time || item.class_times?.[0]?.start,
              );
              const endEx = parseTime(
                item.end_time || item.class_times?.[0]?.end,
              );
              return startCurr <= endEx + 15 && endCurr >= startEx - 15;
            }
            return false;
          });

          if (existingIdx !== -1) {
            const ex = acc[existingIdx];
            const startEx = parseTime(
              ex.start_time || ex.class_times?.[0]?.start,
            );
            const endEx = parseTime(ex.end_time || ex.class_times?.[0]?.end);

            ex.start_time = formatTime(Math.min(startEx, startCurr));
            ex.end_time = formatTime(Math.max(endEx, endCurr));

            const type1 = ex.section_type || "T";
            if (!type1.includes(currentType))
              ex.section_type = `${type1}+${currentType}`;
          } else {
            acc.push({ ...curr, section_type: currentType });
          }
          return acc;
        }, []);

        mergedSchedule.sort((a, b) => {
          const dayA = DAY_ORDER[a.day_of_week] || 99;
          const dayB = DAY_ORDER[b.day_of_week] || 99;

          if (dayA !== dayB) return dayA - dayB;
          return parseTime(a.start_time) - parseTime(b.start_time);
        });

        setSchedule(mergedSchedule);
      } else {
        setSchedule([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  // 🌟 3. ฟังก์ชัน Toggle Checkbox
  const toggleSelection = (courseCode, sectionType) => {
    const id = `${courseCode}|${sectionType}`;
    if (selectedToWithdraw.includes(id)) {
      setSelectedToWithdraw((prev) => prev.filter((item) => item !== id));
    } else {
      setSelectedToWithdraw((prev) => [...prev, id]);
    }
  };

  // 🌟 4. ฟังก์ชันส่งคำสั่งถอนรายวิชาแบบเลือกทีละหลายตัว
  const handleWithdrawMultiple = () => {
    if (selectedToWithdraw.length === 0) return;

    Alert.alert(
      "ถอนรายวิชา",
      `ต้องการถอน ${selectedToWithdraw.length} รายการที่เลือกออกจากตารางเรียนหรือไม่?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยันถอน",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const promises = [];
              selectedToWithdraw.forEach((id) => {
                const [code, combinedType] = id.split("|");
                const types = combinedType.split("+"); // เผื่อกรณีวิชาโดนยุบเป็น T+L ให้แยกส่งไปถอน
                types.forEach((type) => {
                  promises.push(
                    withdrawCourseAPI(student.student_id, code, type),
                  );
                });
              });

              await Promise.all(promises);
              Alert.alert("สำเร็จ", "ถอนรายวิชาเรียบร้อยแล้ว");
              fetchSchedule(); // โหลดตารางใหม่
            } catch (e) {
              Alert.alert("ข้อผิดพลาด", e.message);
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  // 🌟 5. ฟังก์ชันส่งคำสั่งถอนแบบตัวเดียว (กดผ่านถังขยะ)
  const handleWithdrawSingle = (courseCode, combinedType) => {
    Alert.alert(
      "ถอนรายวิชา",
      `ต้องการถอนวิชา ${courseCode} ออกจากตารางเรียนหรือไม่?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยันถอน",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const types = combinedType.split("+");
              const promises = types.map((type) =>
                withdrawCourseAPI(student.student_id, courseCode, type),
              );

              await Promise.all(promises);
              Alert.alert("สำเร็จ", "ถอนรายวิชาเรียบร้อยแล้ว");
              fetchSchedule();
            } catch (e) {
              Alert.alert("ข้อผิดพลาด", e.message);
              setLoading(false);
            }
          },
        },
      ],
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
          <Text style={styles.headerTitle}>ตารางเรียนของฉัน</Text>
          <TouchableOpacity onPress={fetchSchedule}>
            <MaterialIcons name="refresh" size={24} color="#a73355" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#a73355"
              style={{ marginTop: 50 }}
            />
          ) : schedule.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialIcons name="event-busy" size={80} color="#d6c2c4" />
              <Text style={styles.emptyText}>ยังไม่มีวิชาที่ลงทะเบียน</Text>
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

                            {schedule
                              .filter((course) => {
                                const d = course.day_of_week;
                                return (
                                  d === dayKey || DAY_MAP[d] === DAY_MAP[dayKey]
                                );
                              })
                              .map((item, idx) => {
                                const pos = getBoxStyle(
                                  item.start_time,
                                  item.end_time,
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
                                      {item.course_code} (
                                      {item.section_type || "T"})
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

              {/* Course Detail Header พร้อมปุ่มถอนรวม */}
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
                {selectedToWithdraw.length > 0 && (
                  <TouchableOpacity
                    onPress={handleWithdrawMultiple}
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
                      ถอนที่เลือก ({selectedToWithdraw.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 📝 รายละเอียดวิชาด้านล่างแบบเลือกถอนได้ */}
              {schedule.map((item, idx) => {
                let typeLabel = "ทฤษฎี";
                if (
                  item.section_type?.includes("T") &&
                  item.section_type?.includes("L")
                ) {
                  typeLabel = "ทฤษฎีและปฏิบัติ";
                } else if (item.section_type?.includes("L")) {
                  typeLabel = "ปฏิบัติ";
                }

                const itemId = `${item.course_code}|${item.section_type}`;
                const isSelected = selectedToWithdraw.includes(itemId);

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.detailCard,
                      isSelected && { borderColor: "#a73355", borderWidth: 2 },
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      toggleSelection(item.course_code, item.section_type)
                    }
                  >
                    <View style={styles.cardAccent} />
                    <View style={styles.cardBody}>
                      <View style={styles.cardTop}>
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          {/* 🌟 Checkbox */}
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
                            {item.course_code}
                          </Text>
                        </View>
                        <Text style={styles.detailTime}>
                          วัน{DAY_MAP[item.day_of_week]}{" "}
                          {formatTimeDisplay(item.start_time)} -{" "}
                          {formatTimeDisplay(item.end_time)} น.
                        </Text>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginLeft: 30,
                        }}
                      >
                        <Text style={styles.courseName} numberOfLines={1}>
                          {item.course_name}
                        </Text>

                        {/* 🌟 ปุ่มถังขยะสำหรับถอนรายวิชาแบบตัวเดียว */}
                        <TouchableOpacity
                          onPress={() =>
                            handleWithdrawSingle(
                              item.course_code,
                              item.section_type,
                            )
                          }
                          style={{ padding: 4 }}
                        >
                          <Feather name="trash-2" size={18} color="#E53935" />
                        </TouchableOpacity>
                      </View>

                      {/* 👇 แทรกชื่ออาจารย์ใน View นี้ 👇 */}
                      <View style={[styles.cardBottom, { marginLeft: 30 }]}>
                        <Text style={styles.metaText}>
                          กลุ่ม: {item.section_number} {typeLabel}
                        </Text>

                        {/* 🌟 เพิ่มชื่ออาจารย์ตรงนี้ครับ */}
                        <Text style={styles.metaText}>
                          ห้อง {item.room || "N/A"}
                        </Text>
                      </View>

                      <View style={[styles.cardBottom, { marginLeft: 30 }]}>
                        {item.instructor_name && (
                          <Text style={styles.metaText}>
                            อาจารย์: {item.instructor_name}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* Bottom Nav */}
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
            <View style={styles.navItemActive}>
              <MaterialIcons name="calendar-today" size={24} color="#a73355" />
              <Text style={styles.navText}>SCHEDULE</Text>
            </View>
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
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },

  // 🌟 Grid Table Styles (ดีไซน์เดียวกับ AIScreen)
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

  // กล่องวิชาพาสเทลแบบจิ๋ว (25px)
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

  // Detail List Styles
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
  courseName: { fontSize: 13, color: "#514345", marginBottom: 8 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: 11, color: "#837375" },

  emptyBox: { alignItems: "center", marginTop: 100 },
  emptyText: { fontSize: 16, color: "#837375", marginTop: 10 },

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
});
