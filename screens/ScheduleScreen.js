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
} from "react-native";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getScheduleAPI } from "../api";

const { width } = Dimensions.get("window");

// 🌟 ตั้งค่าให้เหมือน AIScreen.js เป๊ะๆ (25px เล็กกะทัดรัด เลื่อนได้)
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

export default function ScheduleScreen({ student, setView }) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student) fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const data = await getScheduleAPI(student.student_id);

      if (Array.isArray(data)) {
        // 🌟 ยุบรวม T และ L ที่เรียนวันเดียวกันและวิชาเดียวกัน ให้แสดงเป็นก้อนเดียว
        const mergedSchedule = data.reduce((acc, curr) => {
          const dayCurr = curr.day_of_week || curr.class_times?.[0]?.day;

          const existingIdx = acc.findIndex((item) => {
            const dayItem = item.day_of_week || item.class_times?.[0]?.day;
            return item.course_code === curr.course_code && dayItem === dayCurr;
          });

          if (existingIdx !== -1) {
            // เจอว่ามีวิชานี้ในวันเดียวกันแล้ว -> รวมเวลาให้คลุมทั้งหมด
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

            const ex = acc[existingIdx];
            const start1 = parseTime(
              ex.start_time || ex.class_times?.[0]?.start,
            );
            const end1 = parseTime(ex.end_time || ex.class_times?.[0]?.end);
            const start2 = parseTime(
              curr.start_time || curr.class_times?.[0]?.start,
            );
            const end2 = parseTime(curr.end_time || curr.class_times?.[0]?.end);

            ex.start_time = formatTime(Math.min(start1, start2));
            ex.end_time = formatTime(Math.max(end1, end2));

            // อัปเดต Type ให้รู้ว่ามีทั้ง T และ L (เพื่อความสวยงามในรายละเอียด)
            const type1 = ex.section_type || "T";
            const type2 = curr.section_type || "L";
            if (!type1.includes(type2)) ex.section_type = `${type1}+${type2}`;
          } else {
            acc.push({ ...curr });
          }
          return acc;
        }, []);

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
    // 🌟 สมการจัดกล่องให้พอดีกับ 25px
    return {
      left: (s - GRID_START_HOUR) * ONE_HOUR_WIDTH,
      width: (e - s) * ONE_HOUR_WIDTH,
    };
  };

  // 🌟 เพิ่มฟังก์ชันแปลงเวลา 9.00-11.00 ให้เหมือน AIScreen.js
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
              {/* 🗓️ ตารางกริดแบบไถข้าง (แฝด AIScreen.js) */}
              <View style={styles.gridOuterContainer}>
                <ScrollView
                  horizontal={true}
                  showsHorizontalScrollIndicator={true}
                >
                  
                  {/* 🌟 บวก +100px หลอกระบบให้เลื่อนได้ */}
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
                            {/* 🌟 แสดงชื่อวันแบบเต็ม "วันจันทร์" */}
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
                            {/* เส้นแบ่งเวลาแนวตั้ง */}
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

                            {/* วิชาที่เรียนในวันนี้ */}
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
                                      {item.course_code}
                                    </Text>
                                    {/* 🌟 แสดงเวลาแบบ 9.00-11.00 */}
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

              {/* 📝 รายละเอียดวิชาด้านล่าง */}
              <Text style={styles.sectionTitle}>รายละเอียดวิชา</Text>
              {schedule.map((item, idx) => (
                <View key={idx} style={styles.detailCard}>
                  <View style={styles.cardAccent} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <Text style={styles.detailCode}>{item.course_code}</Text>
                      {/* 🌟 ปรับวันเวลาด้านล่างให้ตรงกับข้างบน */}
                      <Text style={styles.detailTime}>
                        วัน{DAY_MAP[item.day_of_week]}{" "}
                        {formatTimeDisplay(item.start_time)} น.
                      </Text>
                    </View>
                    <Text style={styles.courseName}>{item.course_name}</Text>
                    <View style={styles.cardBottom}>
                      <Text style={styles.metaText}>
                        Sec {item.section_number}
                      </Text>
                      <Text style={styles.metaText}>
                        Room {item.room || "N/A"}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
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
            onPress={() => setView("CART")}
          >
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setView("MANUAL")}
            >
              <MaterialIcons name="search" size={24} color="#837375" />
              <Text style={styles.navText}>SEARCH</Text>
            </TouchableOpacity>
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
            <TouchableOpacity style={styles.navItemActive}>
              <MaterialIcons name="calendar-today" size={24} color="#a73355" />
              <Text style={styles.navText}>SCHEDULE</Text>
            </TouchableOpacity>
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
