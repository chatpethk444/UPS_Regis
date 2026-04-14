import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Modal, 
} from "react-native";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

// Import API สำหรับดึงเกรด
import { getStudentGradesAPI } from "../api"; 

const { width } = Dimensions.get("window");

export default function ProfileScreen({ student, setView, onLogout }) {
  const [grades, setGrades] = useState({});
  const [termStats, setTermStats] = useState({});
  const [gpaStats, setGpaStats] = useState({ cgpa: "0.00", totalCredits: 0 });
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [isGradeModalVisible, setGradeModalVisible] = useState(false); 
  
  // 🌟 1. เพิ่ม State สำหรับจัดการ Modal ออกจากระบบ
  const [isLogoutModalVisible, setLogoutModalVisible] = useState(false);

  useEffect(() => {
    if (student?.student_id) {
      fetchGrades();
    }
  }, [student]);

  const getGradePoint = (grade) => {
    const g = String(grade).trim().toUpperCase();
    switch (g) {
      case 'A': return 4.0;
      case 'B+': return 3.5;
      case 'B': return 3.0;
      case 'C+': return 2.5;
      case 'C': return 2.0;
      case 'D+': return 1.5;
      case 'D': return 1.0;
      case 'F': return 0.0;
      default: return null; 
    }
  };

  const getCreditValue = (creditStr) => {
    if (!creditStr) return 0;
    const match = String(creditStr).match(/^(\d+)/); 
    return match ? parseInt(match[1], 10) : 0;
  };

  const fetchGrades = async () => {
    try {
      setLoadingGrades(true);
      const data = await getStudentGradesAPI(student.student_id);
      
      let cumPoints = 0; 
      let cumGpaCredits = 0; 
      let cumTotalCredits = 0; 

      const tStats = {};

      const grouped = data.reduce((acc, curr) => {
        const term = curr.semester || "ไม่ระบุเทอม";
        if (!acc[term]) acc[term] = [];
        acc[term].push(curr);
        return acc;
      }, {});

      Object.keys(grouped).forEach(term => {
        let termPoints = 0;
        let termGpaCredits = 0;
        let termTotalCredits = 0;

        grouped[term].forEach(item => {
          const credits = getCreditValue(item.credits); 
          const hasGrade = item.grade && item.grade.trim() !== "" && item.grade.trim() !== "-";

          if (hasGrade) {
            termTotalCredits += credits;
            const gp = getGradePoint(item.grade);
            if (gp !== null) { 
              termPoints += gp * credits;
              termGpaCredits += credits;
            }
          }
        });

        const termGPA = termGpaCredits > 0 ? (termPoints / termGpaCredits).toFixed(2) : "0.00";
        tStats[term] = {
          gpa: termGPA,
          credits: termTotalCredits 
        };

        cumPoints += termPoints;
        cumGpaCredits += termGpaCredits;
        cumTotalCredits += termTotalCredits; 
      });

      const cgpa = cumGpaCredits > 0 ? (cumPoints / cumGpaCredits).toFixed(2) : "0.00";

      setGrades(grouped);
      setTermStats(tStats);
      setGpaStats({ cgpa, totalCredits: cumTotalCredits });

    } catch (e) {
      console.log("Error fetching grades:", e.message);
    } finally {
      setLoadingGrades(false);
    }
  };

  // 🌟 2. เปลี่ยนให้ปุ่มออกจากระบบ เปิด Modal แทน Alert ธรรมดา
  const handleLogoutPress = () => {
    setLogoutModalVisible(true);
  };

  // 🌟 ฟังก์ชันกดยืนยันออกจากระบบจริงๆ
  const confirmLogout = () => {
    setLogoutModalVisible(false);
    onLogout();
  };

  const sortedSemesters = Object.keys(grades).sort((a, b) => {
    const [termA, yearA] = a.split("/");
    const [termB, yearB] = b.split("/");
    if (yearA !== yearB) return parseInt(yearB) - parseInt(yearA);
    return parseInt(termB) - parseInt(termA);
  });

  const getGradeColor = (grade) => {
    const g = String(grade).trim().toUpperCase();
    if (g === "A" || g === "B+" || g === "S") return "#10b981";
    if (g === "D" || g === "D+" || g === "F" || g === "W") return "#ef4444";
    return "#f59e0b";
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
          <TouchableOpacity onPress={() => setView("MENU")} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Student Profile</Text>
          <Text style={styles.brandLogo}>UPS</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Profile Hero Section */}
          <View style={styles.profileHero}>
            <View style={styles.imageWrapper}>
              <LinearGradient colors={["rgba(210, 54, 105, 0.2)", "transparent"]} style={styles.imageGlow} />
              <View style={styles.profileImageContainer}>
                <Image source={{ uri: student.avatar_url }} style={styles.profileImage} />
              </View>
            </View>
            <Text style={styles.studentIdLabel}>STUDENT ID: {student?.student_id || "66040408"}</Text>
            <Text style={styles.studentName}>{student?.first_name || "พชรพล"} {student?.last_name}</Text>
          </View>

          {/* CGPA Container */}
          <View style={styles.cgpaContainer}>
            <View style={styles.cgpaBox}>
              <Text style={styles.cgpaLabel}>เกรดเฉลี่ยสะสม (CGPA)</Text>
              <Text style={styles.cgpaValue}>{gpaStats.cgpa}</Text>
            </View>
            <View style={styles.cgpaDivider} />
            <View style={styles.cgpaBox}>
              <Text style={styles.cgpaLabel}>หน่วยกิตสะสม</Text>
              <Text style={styles.cgpaValue}>{gpaStats.totalCredits}/135</Text>
            </View>
          </View>

          {/* Academic Card */}
          <View style={styles.glassCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconBox}>
                <MaterialIcons name="account-balance" size={20} color="#a73355" />
              </View>
              <View>
                <Text style={styles.label}>คณะ & สาขาวิชา</Text>
                <Text style={styles.valueMain}>{student?.faculty || "-"}</Text>
                <Text style={styles.valueSub}>{student?.major || "-"}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.iconBox}>
                <MaterialIcons name="history-edu" size={20} color="#a73355" />
              </View>
              <View>
                <Text style={styles.label}>หลักสูตร</Text>
                <Text style={styles.valueMain}>หลักสูตรตรีเช้า</Text>
              </View>
            </View>
          </View>

          {/* ปุ่มเปิด Pop-up ดูเกรด */}
          <TouchableOpacity 
            style={styles.gradeButton} 
            onPress={() => setGradeModalVisible(true)}
          >
            <LinearGradient colors={["rgba(167, 51, 85, 0.1)", "rgba(167, 51, 85, 0.05)"]} style={styles.gradeButtonContent}>
              <MaterialIcons name="school" size={24} color="#a73355" />
              <Text style={styles.gradeButtonText}>ดูผลการเรียน</Text>
              <MaterialIcons name="chevron-right" size={24} color="#a73355" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Contact Card */}
          <View style={styles.glassCard}>
            <Text style={styles.cardHeader}>ข้อมูลส่วนตัว</Text>
            <View style={styles.credentialRow}>
              <View style={styles.credentialLeft}>
                <MaterialIcons name="mail" size={18} color="#7b5455" />
                <View>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.emailText}>{student?.email || "-"}</Text>
                </View>
              </View>
              <MaterialIcons name="content-copy" size={16} color="#837375" />
            </View>

            <View style={styles.credentialRow}>
              <View style={styles.credentialLeft}>
                <MaterialIcons name="phone" size={18} color="#7b5455" />
                <View>
                  <Text style={styles.label}>เบอร์โทรศัพท์</Text>
                  <Text style={styles.emailText}>{student?.phone_number || "-"}</Text>
                </View>
              </View>
              <MaterialIcons name="content-copy" size={16} color="#837375" />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.editBtn} onPress={handleLogoutPress}>
              <LinearGradient colors={["#7b5455", "#a73355"]} style={styles.editGradient}>
                <MaterialIcons name="logout" size={18} color="white" />
                <Text style={styles.editBtnText}>ออกจากระบบ</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* 🌟 Modal Pop-up สำหรับแสดงเกรด 🌟 */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isGradeModalVisible}
          onRequestClose={() => setGradeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>ผลการเรียน</Text>
                <TouchableOpacity onPress={() => setGradeModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color="#837375" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {loadingGrades ? (
                  <ActivityIndicator size="large" color="#a73355" style={{ marginVertical: 40 }} />
                ) : sortedSemesters.length === 0 ? (
                  <View style={{ alignItems: "center", padding: 40 }}>
                    <MaterialIcons name="inbox" size={48} color="#d6c2c4" />
                    <Text style={{ textAlign: "center", color: "#837375", marginTop: 16 }}>ยังไม่มีข้อมูลผลการเรียน</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.cgpaContainer}>
                      <View style={styles.cgpaBox}>
                        <Text style={styles.cgpaLabel}>เกรดเฉลี่ยสะสม (CGPA)</Text>
                        <Text style={styles.cgpaValue}>{gpaStats.cgpa}</Text>
                      </View>
                      <View style={styles.cgpaDivider} />
                      <View style={styles.cgpaBox}>
                        <Text style={styles.cgpaLabel}>หน่วยกิตสะสม</Text>
                        <Text style={styles.cgpaValue}>{gpaStats.totalCredits}/135</Text>
                      </View>
                    </View>

                    {sortedSemesters.map((semester) => (
                      <View key={semester} style={styles.semesterBlock}>
                        <View style={styles.semesterHeader}>
                          <Text style={styles.semesterTitle}>ภาคการศึกษา {semester}</Text>
                          <View style={styles.termStatsBadge}>
                            <Text style={styles.termStatsText}>
                              เกรดเฉลี่ย: <Text style={{fontWeight:'bold'}}>{termStats[semester]?.gpa}</Text>  |  
                              หน่วยกิต: <Text style={{fontWeight:'bold'}}>{termStats[semester]?.credits}</Text>
                            </Text>
                          </View>
                        </View>
                        
                        {grades[semester].map((item, idx) => (
                          <View key={idx} style={styles.gradeRow}>
                            <View>
                              <Text style={styles.courseCodeText}>{item.course_id}</Text>
                              <Text style={[styles.courseNameText, { fontSize: 12 }]}>
                                {item.course_name}
                              </Text>
                              <Text style={styles.creditText}>
                                {parseFloat(item.credits) || 3} หน่วยกิต
                              </Text>
                            </View>
                            <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(item.grade) + "20" }]}>
                              <Text style={[styles.gradeText, { color: getGradeColor(item.grade) }]}>
                                {item.grade || "-"}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 🌟 3. Modal Custom สำหรับ ยืนยันการออกจากระบบ 🌟 */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isLogoutModalVisible}
          onRequestClose={() => setLogoutModalVisible(false)}
        >
          <View style={styles.logoutModalOverlay}>
            <View style={styles.logoutModalContainer}>
              
              <View style={styles.logoutIconWrapper}>
                <MaterialIcons name="logout" size={32} color="#a73355" />
              </View>

              <Text style={styles.logoutTitle}>ออกจากระบบ</Text>
              <Text style={styles.logoutDescription}>
                คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?
              </Text>

              <View style={styles.logoutButtonRow}>
                <TouchableOpacity 
                  style={styles.cancelLogoutBtn} 
                  onPress={() => setLogoutModalVisible(false)}
                >
                  <Text style={styles.cancelLogoutText}>ยกเลิก</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.confirmLogoutBtn} 
                  onPress={confirmLogout}
                >
                  <LinearGradient 
                    colors={["#a73355", "#7b5455"]} 
                    style={styles.confirmLogoutGradient}
                  >
                    <Text style={styles.confirmLogoutText}>ออกจากระบบ</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </Modal>

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => setView("MENU")}>
            <MaterialIcons name="home" size={24} color="#837375" />
            <Text style={styles.navText}>HOME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setView("MANUAL")}>
            <MaterialIcons name="list" size={24} color="#837375" />
            <Text style={styles.navText}>COURSES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setView("CART")}>
            <MaterialIcons name="shopping-cart" size={24} color="#837375" />
            <Text style={styles.navText}>CART</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setView("SCHEDULE")}>
            <MaterialIcons name="calendar-today" size={24} color="#837375" />
            <Text style={styles.navText}>SCHEDULE</Text>
          </TouchableOpacity>
          <View style={styles.navItemActive}>
            <MaterialIcons name="person" size={24} color="#a73355" />
            <Text style={styles.navTextActive}>PROFILE</Text>
          </View>
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
    paddingHorizontal: 24,
    height: 64,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1f1a1c" },
  brandLogo: {
    fontSize: 20,
    fontWeight: "900",
    color: "#7b5455",
    letterSpacing: -1,
  },
  scrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 },

  profileHero: { alignItems: "center", marginBottom: 32 },
  imageWrapper: {
    position: "relative",
    width: 128,
    height: 128,
    marginBottom: 16,
  },
  imageGlow: { position: "absolute", inset: 0, borderRadius: 64, opacity: 0.5 },
  profileImageContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: "white",
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  profileImage: { width: "100%", height: "100%" },
  studentIdLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#a73355",
    letterSpacing: 2,
    marginBottom: 4,
  },
  studentName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#D23669",
    letterSpacing: -0.5,
  },

  glassCard: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(214, 194, 196, 0.2)",
  },
  infoRow: { flexDirection: "row", gap: 16, marginBottom: 20 },
  iconBox: {
    backgroundColor: "rgba(123, 84, 85, 0.1)",
    padding: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#837375",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  valueMain: { fontSize: 14, fontWeight: "bold", color: "#87193e" },
  valueSub: { fontSize: 14, fontWeight: "500", color: "#514345" },

  cardHeader: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#a73355",
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(131, 115, 117, 0.1)",
    paddingBottom: 8,
    marginBottom: 16,
  },

  gradeButton: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 51, 85, 0.3)",
  },
  gradeButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  gradeButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
    color: "#87193e",
    marginLeft: 12,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end", 
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    height: "85%", 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#87193e",
  },

  cgpaContainer: {
    flexDirection: "row",
    backgroundColor: "#a73355",
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 24,
    elevation: 4,
    shadowColor: "#a73355",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cgpaBox: {
    flex: 1,
    alignItems: "center",
  },
  cgpaDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  cgpaLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  cgpaValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  
  semesterBlock: { marginBottom: 24 },
  semesterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(167, 51, 85, 0.05)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  semesterTitle: { 
    fontSize: 14, 
    fontWeight: "bold", 
    color: "#87193e" 
  },
  termStatsBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(167, 51, 85, 0.1)",
  },
  termStatsText: {
    fontSize: 11,
    color: "#7b5455",
  },

  gradeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.03)",
  },
  courseCodeText: { fontSize: 16, fontWeight: "600", color: "#514345" },
  creditText: { fontSize: 12, color: "#999", marginTop: 2 },
  gradeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  gradeText: { fontSize: 14, fontWeight: "900" },

  credentialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  credentialLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  emailText: { fontSize: 12, fontWeight: "600", color: "#87193e" },

  buttonRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  editBtn: { flex: 1, borderRadius: 12, overflow: "hidden", elevation: 4 },
  editGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  editBtnText: { color: "white", fontWeight: "bold", fontSize: 14 },
  
  /* 🌟 4. สไตล์สำหรับ Modal ออกจากระบบ (Logout Modal) 🌟 */
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logoutModalContainer: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  logoutIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(167, 51, 85, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoutTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#87193e",
    marginBottom: 8,
  },
  logoutDescription: {
    fontSize: 14,
    color: "#837375",
    textAlign: "center",
    marginBottom: 24,
  },
  logoutButtonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelLogoutBtn: {
    flex: 1,
    backgroundColor: "#f5ebed",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelLogoutText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#837375",
  },
  confirmLogoutBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  confirmLogoutGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
  },
  confirmLogoutText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
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
    elevation: 10,
    shadowColor: "#a73355",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  navItem: { alignItems: "center", paddingHorizontal: 8 },
  navText: { fontSize: 9, fontWeight: "bold", color: "#837375", marginTop: 4 },
  navItemActive: {
    alignItems: "center",
    backgroundColor: "#f5ebed",
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
});