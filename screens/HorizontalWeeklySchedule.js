// ไฟล์: HorizontalWeeklySchedule.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const START_HOUR = 8;
const END_HOUR = 18;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const CELL_WIDTH = 65; 
const CELL_HEIGHT = 60; 
const TIME_HEADER_HEIGHT = 40;
const DAY_SIDEBAR_WIDTH = 65;

const DAYS = [
  { key: 'MON', th: 'จันทร์', en: 'MON' },
  { key: 'TUE', th: 'อังคาร', en: 'TUE' },
  { key: 'WED', th: 'พุธ', en: 'WED' },
  { key: 'THU', th: 'พฤหัสบดี', en: 'THU' },
  { key: 'FRI', th: 'ศุกร์', en: 'FRI' },
  { key: 'SAT', th: 'เสาร์', en: 'SAT' },
  { key: 'SUN', th: 'อาทิตย์', en: 'SUN' },
];

const getCourseColor = (courseCode) => {
  if (!courseCode) return '#EAEAEA';
  const colors = ['#A8E6CF', '#FFD3B6', '#FFAAA5', '#DCD3FF', '#B2EBF2', '#FFCCBC', '#F9E79F', '#F5B7B1'];
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function HorizontalWeeklySchedule({ plan, availableCourses = [] }) {
  const rawClassesList = Array.isArray(plan) ? plan : (plan.classes || []);

  // ฟังก์ชันแปลงเวลา "15:00" -> 15.0 เพื่อใช้คำนวณแกน X
  const parseTime = (time) => {
    if (time === undefined || time === null || time === "") return 0;
    if (typeof time === 'number') return time;
    const [h, m] = String(time).split(':').map(Number);
    return h + (m || 0) / 60;
  };

  // --- 🛠 Normalize Data (ซ่อมแซมข้อมูลก่อนนำไปใช้วาด) ---
  let lastDay = "";
  const classesList = rawClassesList.map((c, idx, arr) => {
    let day = c.day_of_week || c.day || "";
    const currentCode = c.course_code || c.course_id || c.code;
    const prevCode = idx > 0 ? (arr[idx-1].course_code || arr[idx-1].course_id || arr[idx-1].code) : null;
    
    // 🔥 ถ้าข้อมูล "วัน" หายไป แต่เป็นรหัสวิชาเดียวกับตัวก่อนหน้า ให้ใช้ "วัน" ของตัวก่อนหน้า
    if (!day && currentCode === prevCode) {
        day = lastDay;
    }
    if (day) lastDay = day; 

    // ซ่อมแซมข้อมูลใน class_times (ถ้ามี)
    let times = c.class_times || [];
    let normTimes = times.map((t, tIdx) => {
        let tDay = t.day || t.day_of_week || day;
        if (!tDay && tIdx > 0) tDay = times[0].day || times[0].day_of_week || day;
        return {
            ...t,
            day: tDay,
            start: parseTime(t.start || t.start_time),
            end: parseTime(t.end || t.end_time)
        };
    });

    return {
        ...c,
        day_of_week: day, // วันที่ซ่อมแซมแล้ว
        class_times: normTimes,
        start_time: parseTime(c.start_time || c.start), // แปลงเป็นตัวเลขแล้ว
        end_time: parseTime(c.end_time || c.end)
    };
  });

  const getClassesForDay = (dayKey, dayTh) => {
    const classes = [];
    classesList.forEach((c) => {
      if (c.class_times && c.class_times.length > 0) {
        c.class_times.forEach((t) => {
          const d = (t.day || "").toUpperCase().trim();
          if (d === dayKey || d === dayTh) {
            classes.push({ ...c, start: t.start, end: t.end, room: t.room });
          }
        });
      } else {
        const d = (c.day_of_week || "").toUpperCase().trim();
        if (d === dayKey || d === dayTh) {
          classes.push({ ...c, start: c.start_time, end: c.end_time });
        }
      }
    });
    return classes;
  };

  const formatTime = (timeFloat) => {
    if (typeof timeFloat !== 'number' || timeFloat === 0) return "??:??";
    const h = Math.floor(timeFloat);
    const m = String(Math.round((timeFloat % 1) * 60)).padStart(2, "0");
    return `${h}:${m}`;
  };

  return (
    <View style={styles.container}>
      {/* ================= ส่วนตาราง ================= */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} bounces={false}>
        <View style={styles.tableWrapper}>
          <View style={styles.timeHeaderRow}>
            <View style={styles.topLeftCorner} />
            {HOURS.map((hour) => (
              <View key={hour} style={styles.timeHeaderCell}>
                <Text style={styles.timeText}>{hour}:00</Text>
              </View>
            ))}
          </View>

          <View>
            {DAYS.map((dayObj, dayIndex) => {
              const dayClasses = getClassesForDay(dayObj.key, dayObj.th);

              return (
                <View key={dayIndex} style={styles.dayRow}>
                  <View style={styles.daySidebar}>
                    <Text style={styles.dayTextTH}>{dayObj.th}</Text>
                    <Text style={styles.dayTextEN}>{dayObj.en}</Text>
                  </View>

                  <View style={styles.gridRowArea}>
                    {HOURS.map((hour) => (
                      <View key={`grid-${hour}`} style={styles.gridVerticalLine} />
                    ))}

                    {dayClasses.map((cls, idx) => {
                      if (!cls.start || !cls.end) return null;
                      const leftPos = (cls.start - START_HOUR) * CELL_WIDTH;
                      const width = (cls.end - cls.start) * CELL_WIDTH;
                      const code = cls.course_code || cls.course_id || cls.code || '??';

                      return (
                        <View
                          key={idx}
                          style={[
                            styles.courseBlock,
                            {
                              left: leftPos,
                              width: width - 4,
                              backgroundColor: getCourseColor(code),
                            },
                          ]}
                        >
                          <Text style={styles.courseBlockCode} numberOfLines={1}>{code}</Text>
                          <Text style={styles.courseBlockTime} numberOfLines={1}>
                            {formatTime(cls.start)}-{formatTime(cls.end)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ================= ส่วนรายละเอียดวิชา ================= */}
      <View style={styles.detailsContainer}>
        <Text style={styles.sectionTitle}>รายละเอียดวิชา</Text>
        {classesList.map((c, idx) => {
            const code = c.course_code || c.course_id || c.code;
            const courseInfo = availableCourses.find(av => av.course_code === code) || {};
            const name = c.course_name || courseInfo.course_name || "ไม่ระบุชื่อวิชา";
            const secNum = c.section_number || c.sec || "??";
            const instructor = c.instructor || "N/A";
            
            const firstTime = c.class_times?.[0] || {};
            const room = firstTime.room || c.room || "N/A";
            // วันและเวลา ดึงจากค่าที่ถูกซ่อมแซมแล้ว
            const day = firstTime.day || c.day_of_week || "";
            const start = firstTime.start || c.start_time || 0;
            const end = firstTime.end || c.end_time || 0;

          return (
            <View key={idx} style={styles.detailItem}>
              <View style={[styles.detailColorBar, { backgroundColor: getCourseColor(code) }]} />
              <View style={styles.detailContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailCourseCode}>{code}</Text>
                  <Text style={styles.detailTimeText}>
                    {day} {formatTime(start)}-{formatTime(end)} น.
                  </Text>
                </View>
                <Text style={styles.detailCourseName} numberOfLines={1}>{name}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailSubText}>Sec {secNum}, {instructor}</Text>
                  <Text style={styles.detailSubText}>Room {room}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f0e6e8', overflow: 'hidden', marginVertical: 12 },
  tableWrapper: { paddingBottom: 8 },
  timeHeaderRow: { flexDirection: 'row', height: TIME_HEADER_HEIGHT, borderBottomWidth: 1, borderBottomColor: '#f0e6e8' },
  topLeftCorner: { width: DAY_SIDEBAR_WIDTH, backgroundColor: '#FAFAFA', borderRightWidth: 1, borderRightColor: '#f0e6e8' },
  timeHeaderCell: { width: CELL_WIDTH, justifyContent: 'flex-end', alignItems: 'flex-start', paddingLeft: 4, paddingBottom: 4 },
  timeText: { fontSize: 10, color: '#837375' },
  dayRow: { flexDirection: 'row', height: CELL_HEIGHT, borderBottomWidth: 1, borderBottomColor: '#f0e6e8' },
  daySidebar: { width: DAY_SIDEBAR_WIDTH, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f0e6e8' },
  dayTextTH: { fontSize: 12, fontWeight: 'bold', color: '#1f1a1c' },
  dayTextEN: { fontSize: 9, color: '#837375', marginTop: 2 },
  gridRowArea: { flexDirection: 'row', position: 'relative', width: CELL_WIDTH * HOURS.length },
  gridVerticalLine: { width: CELL_WIDTH, borderRightWidth: 1, borderRightColor: '#f0e6e8', height: '100%' },
  courseBlock: { position: 'absolute', top: 4, bottom: 4, borderRadius: 8, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  courseBlockCode: { fontSize: 11, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  courseBlockTime: { fontSize: 9, color: '#555', textAlign: 'center', marginTop: 2 },
  
  detailsContainer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0e6e8' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#3F0017', marginBottom: 12 },
  detailItem: { flexDirection: 'row', backgroundColor: '#FAFAFA', borderRadius: 8, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0' },
  detailColorBar: { width: 6 },
  detailContent: { flex: 1, padding: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  detailCourseCode: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  detailTimeText: { fontSize: 12, color: '#666', fontWeight: '500' },
  detailCourseName: { fontSize: 12, color: '#888', marginBottom: 6 },
  detailSubText: { fontSize: 12, color: '#666' },
});