// screens/ManualScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from "react-native";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getAvailableCoursesAPI,
  getSectionsAPI,
  addToCartAPI,
  getCartAPI,
  getZOptionsAPI,
  getScheduleAPI
} from "../api";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearched, setIsSearched] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [cart, setCart] = useState([]);
  const [zOptions, setZOptions] = useState(null);
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    fetchUserData();
  }, []);

  // ✅ ดึงข้อมูลตะกร้าและตารางเรียนมาพร้อมกัน
  const fetchUserData = async () => {
    try {
      const [cartData, scheduleData] = await Promise.all([
        getCartAPI(student.student_id).catch(() => []),
        getScheduleAPI(student.student_id).catch(() => [])
      ]);
      setCart(cartData);
      setSchedule(scheduleData);
    } catch (err) {
      console.error("Fetch User Data Error:", err);
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return Alert.alert("⚠️ แจ้งเตือน", "กรุณากรอกรหัสวิชาหรือชื่อวิชา");
    }
    setLoading(true);
    try {
      const data = await getAvailableCoursesAPI(student.student_id);
      const q = searchQuery.toLowerCase();
      
      const filtered = data.filter(
        (c) =>
          // 1. เช็กว่าคำค้นหาตรงกับรหัสหรือชื่อวิชา
          (c.course_code.toLowerCase().includes(q) ||
           c.course_name.toLowerCase().includes(q)) 
          && 
          // ✅ 2. เปลี่ยนมาใช้ c.suggested_semester ให้ตรงกับ API
          (c.suggested_semester == student.current_semester) 
      );
      
      setCourses(filtered);
      setIsSearched(true);
      setSelectedCourse(null); 
      setSections([]);
      setZOptions(null);

      if (filtered.length === 0)
        Alert.alert("ไม่พบวิชา", `ไม่มีวิชาที่ตรงกับการค้นหาในเทอม ${student.current_semester} ครับ`);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }

    const data = await getAvailableCoursesAPI(student.student_id);
    console.log("ตัวอย่างข้อมูลวิชาที่ Backend ส่งมา:", data[0]); // ดูที่ Terminal
  };

  // ✅ แก้ไข: เพิ่มระบบ Toggle ถ้ากดวิชาเดิมซ้ำให้พับเก็บ
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
        setZOptions(options);
        setSections([]);
      } else {
        const data = await getSectionsAPI(course.course_code);
        setSections(data);
        setZOptions(null);
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ แก้ไข: รับ parameter targetCourse เข้ามาด้วย เพื่อรองรับวิชา Z ที่รหัสวิชาลูกจะไม่เหมือนวิชาแม่
  // ✅ 1. เพิ่ม parameter computedType เข้ามา
  const handleAddSection = async (targetCourse, section, computedType) => {
    const sectionType = computedType || "T"; 

    if (targetCourse.required_semester && student.current_semester < targetCourse.required_semester) {
      Alert.alert(
        "⚠️ คำเตือน", 
        `วิชานี้แนะนำสำหรับนักศึกษาเทอม ${targetCourse.required_semester} (คุณอยู่เทอม ${student.current_semester})`
      );
    }

    if (section.enrolled_seats >= section.max_seats) {
      return Alert.alert(
        "⚠️ ที่นั่งเต็ม",
        `Section ${section.section_number} (${sectionType}) เต็มแล้ว`,
      );
    }

    // 🌟 รวมวิชาในตะกร้าและในตารางเรียนเข้าด้วยกันเพื่อเช็กทีเดียว
    const allRegistered = [...cart, ...schedule];

    // ✅ 1. เช็กว่าในตารางเรียน (Schedule) มีประเภทนี้หรือยัง?
    const alreadyInSchedule = schedule.find(
      (i) => i.course_code === targetCourse.course_code && (i.section_type === sectionType || i.type === sectionType)
    );
    if (alreadyInSchedule) {
      const typeLabel = sectionType === "T" ? "ทฤษฎี (T)" : "ปฏิบัติ (L)";
      return Alert.alert(
        "❌ ไม่สามารถเพิ่มได้",
        `คุณได้ลงทะเบียนวิชา ${targetCourse.course_code} ${typeLabel} ไปเรียบร้อยแล้วในตารางเรียน`
      );
    }

    // ✅ 2. เช็กว่าในตะกร้า (Cart) มีประเภทนี้หรือยัง?
    const alreadyInCart = cart.find(
      (i) => i.course_code === targetCourse.course_code && i.section_type === sectionType
    );
    if (alreadyInCart) {
      const typeLabel = sectionType === "T" ? "ทฤษฎี (T)" : "ปฏิบัติ (L)";
      return Alert.alert(
        "❌ ไม่สามารถเพิ่มได้",
        `วิชา ${targetCourse.course_code} ${typeLabel} มีอยู่ในตะกร้าของคุณแล้ว (Sec ${alreadyInCart.section_number})\nหากต้องการเปลี่ยนกลุ่ม กรุณาลบออกจากตะกร้าก่อน`
      );
    }

    // ✅ 3. เช็กว่าเวลาเรียนชนกันหรือไม่
    const conflict = allRegistered.find((i) => isTimeOverlapping(i, section));
    
    if (conflict) {
      const location = cart.some(c => c.course_code === conflict.course_code) 
        ? "ตะกร้า" 
        : "ตารางเรียน";

      // 🌟 แก้ไขตรงนี้: ดึงค่าประเภทให้คลุมทั้งกรณี section_type และ type
      const conflictType = conflict.section_type || conflict.type; 
      let typeLabel = "";
      if (conflictType === "T") typeLabel = "(ทฤษฎี)";
      else if (conflictType === "L") typeLabel = "(ปฏิบัติ)";

      return Alert.alert(
        "⚠️ เวลาเรียนชนกัน!",
        `Sec ที่คุณเลือก มีเวลาทับซ้อนกับวิชา:\n${conflict.course_code} Sec ${conflict.section_number} ${typeLabel}\nซึ่งอยู่ใน "${location}" ของคุณแล้ว`
      );
    }

    // ถ้าผ่านด่านทั้งหมด ก็ทำการแอดลงตะกร้าได้ปกติ
    try {
      await addToCartWithType(
        student.student_id,
        targetCourse.course_code,
        String(section.section_number),
        sectionType,
      );
      const typeLabel = sectionType === "T" ? "ทฤษฎี (T)" : "ปฏิบัติ (L)";
      Alert.alert(
        "✅ สำเร็จ",
        `เพิ่ม Sec ${section.section_number} ${typeLabel} ลงตะกร้าแล้ว`,
      );
      fetchUserData(); // ✅ โหลดข้อมูลใหม่เพื่ออัปเดต state ทันที
    } catch (err) {
      Alert.alert("❌ ไม่สำเร็จ", err.message);
    }
  };

  // ✅ นำ UI ที่คุณเขียนไว้กลับมาใช้งานจริง
  // ✅ 2. นำฟังก์ชันนี้ไปทับ renderSectionItem เดิม
  const renderSectionItem = (course, sec, index) => {
    const isFull = sec.enrolled_seats >= sec.max_seats;
    
    // 🌟 ระบบ Auto-Detect T / L (เผื่อ Backend ส่งมาไม่ครบ)
    const isZCourse = course.course_code.startsWith("Z");
    const isLab = 
      sec.type === "L" || 
      (sec.room && sec.room.toLowerCase().includes("lab")) || 
      (isZCourse && index === 1); // วิชาหมวด Z คาบที่ 2 บังคับเป็น Lab

    const isT = !isLab;
    const displayType = isT ? "T" : "L"; // ตัวแปรนี้จะถูกส่งไปตอนกดเลือก

    return (
      <View key={`sec-${sec.section_number}-${index}`} style={styles.sectionCard}>
        <View style={styles.sectionInfo}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionNumText}>Sec {sec.section_number}</Text>
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
                {isT ? "Theory" : "Lab"}
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
        <TouchableOpacity
          style={[
            styles.addBtn,
            { backgroundColor: isT ? "#D23669" : "#1a73e8" },
            isFull && styles.addBtnDisabled,
          ]}
          disabled={isFull}
          // 🌟 ส่ง displayType (T หรือ L) พ่วงไปให้ handleAddSection ด้วย
          onPress={() => handleAddSection(course, sec, displayType)} 
        >
          <Text style={styles.addBtnText}>เลือก</Text>
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
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setView("MENU")}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>ค้นหาวิชาเรียน</Text>
              {/* ✅ เพิ่มการแสดงผล เทอมปัจจุบัน ตรงนี้
              <Text style={{ fontSize: 13, color: "#837375", marginTop: 2 }}>
                เทอมปัจจุบันของคุณ: {student?.current_semester || "ไม่ระบุ"}
              </Text> */}
            </View>
          </View>
          <TouchableOpacity style={styles.bellButton}>
            <MaterialIcons name="filter-list" size={24} color="#514345" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Feather
                name="search"
                size={18}
                color="#a73355"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="รหัสวิชา หรือ ชื่อวิชา..."
                placeholderTextColor="#837375"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <LinearGradient
                colors={["#D23669", "#D23669"]}
                style={styles.searchBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.searchBtnText}>ค้นหา</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {!isSearched ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <MaterialIcons
                  name="search"
                  size={40}
                  color="rgba(167,51,85,0.3)"
                />
              </View>
              <Text style={styles.emptyText}>
                พิมพ์รหัสวิชาเพื่อเริ่มจัดตารางเรียน
              </Text>
            </View>
          ) : (
            <FlatList
              data={courses}
              keyExtractor={(item) => item.course_code}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
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
                    {/* ✅ แก้ไข: ใส่ { flex: 1 } กันข้อความชื่อวิชาชนกับไอคอนลูกศร */}
                    <View style={[styles.courseInfo, { flex: 1, paddingRight: 10 }]}>
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

                  {/* ✅ แก้ไข: เช็กให้แสดงผลแค่เฉพาะวิชาที่กดเลือกเท่านั้น */}
                  {selectedCourse?.course_code === item.course_code && (
                    <View style={styles.bottomSheet}>
                      <View style={styles.sheetHeader}>
                

                      </View>

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
                              {/* ✅ แก้ไข: กันชื่อวิชาซ้อนกันในรายวิชา Z */}
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
                                renderSectionItem(zCourse, sec, index)
                                  
                                
                              )}
                            </View>
                          )}
                          contentContainerStyle={{ paddingBottom: 100 }}
                        />
                      ) : (
                        <FlatList
                          data={sections}
                          keyExtractor={(secItem, index) => `sec-${secItem.section_number}-${index}`}
                          renderItem={({ item: secItem, index }) => 
                            renderSectionItem(selectedCourse, secItem, index)
                          }
                          contentContainerStyle={{ paddingBottom: 100 }}
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
            <MaterialIcons name="search" size={24} color="#a73355" />
            <Text style={styles.navTextActive}>SEARCH</Text>
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

// ... Styles คงไว้เหมือนเดิมได้เลยครับ ...

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
});
