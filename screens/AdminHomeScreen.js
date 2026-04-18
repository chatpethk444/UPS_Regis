import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from "react-native";
import { MaterialIcons, FontAwesome5, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getAdminConfigAPI,
  toggleRegistrationAPI,
  searchStudentsAPI,
  getMaintenanceStatusAPI,
  toggleMaintenanceAPI,
} from "../api";

// --- Custom Modal Component ---
const CustomModal = ({ visible, title, children, onClose }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody}>{children}</ScrollView>
      </View>
    </View>
  </Modal>
);

// --- Custom Alert Modal ---
const CustomAlert = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "ตกลง",
  isDestructive = false,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.alertBox}>
        <Ionicons
          name={
            isDestructive ? "warning-outline" : "information-circle-outline"
          }
          size={50}
          color={isDestructive ? "#E53935" : "#a73355"}
          style={{ marginBottom: 15 }}
        />
        <Text style={styles.alertTitle}>{title}</Text>
        <Text style={styles.alertMessage}>{message}</Text>
        <View style={styles.alertButtons}>
          <TouchableOpacity style={styles.alertBtnCancel} onPress={onCancel}>
            <Text style={styles.alertBtnCancelText}>ยกเลิก</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.alertBtnConfirm,
              isDestructive && { backgroundColor: "#E53935" },
            ]}
            onPress={onConfirm}
          >
            <Text style={styles.alertBtnConfirmText}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export default function AdminHomeScreen({ student, setView, onLogout }) {
  const [isRegisOpen, setIsRegisOpen] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("68"); // Default 68
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // States for Modals
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [gradesModal, setGradesModal] = useState(false);
  const [coursesModal, setCoursesModal] = useState(false);
  const [yearPickerVisible, setYearPickerModal] = useState(false);

  // States for Custom Alerts
  const [logoutAlert, setLogoutAlert] = useState(false);
  const [regisToggleAlert, setRegisToggleAlert] = useState(false);
  const [maintToggleAlert, setMaintToggleAlert] = useState(false);

  const years = ["68", "67", "66", "65", "64"];

  useEffect(() => {
    loadAllConfigs();
  }, []);

  const loadAllConfigs = async () => {
    try {
      const config = await getAdminConfigAPI();
      const maint = await getMaintenanceStatusAPI();
      setIsRegisOpen(
        config.registration_open === "true" ||
          config.registration_open === true,
      );
      setIsMaintenance(
        maint.maintenance_mode === "true" || maint.maintenance_mode === true,
      );
    } catch (e) {
      console.error("Load config error:", e);
    } finally {
      setLoadingConfig(false);
    }
  };

  const confirmToggleRegistration = async () => {
    setRegisToggleAlert(false);
    try {
      const res = await toggleRegistrationAPI(student.student_id);
      setIsRegisOpen(res.registration_open);
    } catch (e) {
      Alert.alert("ผิดพลาด", e.message);
    }
  };

  const confirmToggleMaintenance = async () => {
    setMaintToggleAlert(false);
    try {
      const res = await toggleMaintenanceAPI(student.student_id);
      setIsMaintenance(res.maintenance_mode);
    } catch (e) {
      Alert.alert("ผิดพลาด", e.message);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      let fullQuery = "";
      const query = searchQuery.trim();

      if (!query) {
        fullQuery = selectedYear;
      } else {
        const isNumeric = /^\d+$/.test(query);

        if (isNumeric) {
          if (query.length <= 4) {
            fullQuery = selectedYear + query;
          } else {
            fullQuery = query;
          }
        } else {
          fullQuery = query;
        }
      } // รับข้อมูลจาก API มาก่อน

      let results = await searchStudentsAPI(fullQuery); // 🌟 เพิ่มส่วนนี้: ถ้าไม่ได้พิมพ์อะไรในช่องค้นหา ให้กรองเอาเฉพาะคนที่รหัส "ขึ้นต้นด้วย" ปีที่เลือกจริงๆ

      if (!query) {
        results = results.filter((student) =>
          student.profile.student_id.startsWith(selectedYear),
        );
      }

      setSearchResults(results);
    } catch (e) {
      Alert.alert("ผิดพลาด", e.message);
    } finally {
      setSearching(false);
    }
  };

  const openGrades = (item) => {
    setSelectedStudent(item);
    setGradesModal(true);
  };

  const openCourses = (item) => {
    setSelectedStudent(item);
    setCoursesModal(true);
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 🌟 ฟังก์ชันคำนวณและจัดกลุ่มเกรดตามเทอม
  const gradeSummary = React.useMemo(() => {
    if (!selectedStudent?.grades || selectedStudent.grades.length === 0) {
      return { cumulativeGPA: "0.00", totalCredits: 0, groupedByTerm: [] };
    }

    const gradePoints = {
      A: 4.0, "B+": 3.5, B: 3.0, "C+": 2.5, C: 2.0, "D+": 1.5, D: 1.0, F: 0.0,
    };

    let overallPoints = 0;
    let overallGpaCredits = 0; // 🌟 สำหรับเป็นตัวหาร GPA รวม
    let overallCredits = 0;    // 🌟 สำหรับแสดงผลหน่วยกิตรวมทั้งหมด
    const termMap = {};

    selectedStudent.grades.forEach((g) => {
      const term = g.semester || "ไม่ระบุเทอม";

      // ดึงข้อมูลหน่วยกิต (ใช้ Regex จับเฉพาะตัวเลขชุดแรก ป้องกันปัญหาพวก 3-0-6 หรือ 3(0-2-1))
      let rawCredit = g.credit !== undefined ? g.credit : g.credits;
      let match = String(rawCredit).match(/^[\s]*(\d+(\.\d+)?)/);
      let credit = match ? Number(match[1]) : 0;

      g.cleanCredit = credit;

      if (!termMap[term]) {
        termMap[term] = { term, grades: [], termPoints: 0, termCredits: 0, termGpaCredits: 0 };
      }

      termMap[term].grades.push(g);

      // 🌟 บวกหน่วยกิต "ทุกวิชา" เข้ายอดรวมเสมอ (เพื่อให้แสดง 15 หน่วยกิตครบ)
      termMap[term].termCredits += credit;
      overallCredits += credit;

      const gradeStr = g.grade ? g.grade.trim().toUpperCase() : "";

      // 🌟 คำนวณ GPA เฉพาะวิชาที่มีเกรด A-F
      if (gradePoints[gradeStr] !== undefined) {
        const point = gradePoints[gradeStr] * credit;
        termMap[term].termPoints += point;
        termMap[term].termGpaCredits += credit; // ยอดรวมสำหรับนำไปหาร GPA ของเทอมนี้

        overallPoints += point;
        overallGpaCredits += credit; // ยอดรวมสำหรับนำไปหาร GPA สะสม
      }
    });

    const groupedByTerm = Object.values(termMap).sort((a, b) =>
      b.term.localeCompare(a.term),
    );

    return {
      cumulativeGPA:
        overallGpaCredits > 0
          ? (overallPoints / overallGpaCredits).toFixed(2)
          : "0.00",
      totalCredits: overallCredits, // ใช้หน่วยกิตที่ลงเรียนทั้งหมดมาแสดง
      groupedByTerm,
    };
  }, [selectedStudent]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#a73355", "#6e1a32"]} style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.adminTitle}>Admin Dashboard</Text>
          <TouchableOpacity
            onPress={() => setLogoutAlert(true)}
            style={styles.logoutBtn}
          >
            <MaterialIcons name="logout" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.adminName}>
          {student.first_name} (Administrator)
        </Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* System Control Panel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>การจัดการระบบ</Text>

          <View style={styles.controlCard}>
            <View style={styles.controlIconContainer}>
              <MaterialIcons
                name="app-registration"
                size={24}
                color="#a73355"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.controlLabel}>ระบบการลงทะเบียน</Text>
              <Text
                style={[
                  styles.controlSubLabel,
                  { color: isRegisOpen ? "#4CAF50" : "#F44336" },
                ]}
              >
                {isRegisOpen
                  ? "เปิดให้ลงทะเบียนปกติ"
                  : "ปิดการลงทะเบียนชั่วคราว"}
              </Text>
            </View>
            {loadingConfig ? (
              <ActivityIndicator color="#a73355" />
            ) : (
              <Switch
                value={isRegisOpen}
                onValueChange={() => setRegisToggleAlert(true)}
                trackColor={{ false: "#ccc", true: "#fbc2c2" }}
                thumbColor={isRegisOpen ? "#a73355" : "#f4f3f4"}
              />
            )}
          </View>

          <View style={[styles.controlCard, { marginTop: 12 }]}>
            <View
              style={[
                styles.controlIconContainer,
                { backgroundColor: "#FFF3E0" },
              ]}
            >
              <MaterialIcons name="build" size={24} color="#FF9800" />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.controlLabel}>โหมดปิดปรับปรุงแอป</Text>
              <Text
                style={[
                  styles.controlSubLabel,
                  { color: isMaintenance ? "#FF9800" : "#888" },
                ]}
              >
                {isMaintenance
                  ? "แจ้งเตือนระบบปิดปรับปรุง"
                  : "เปิดใช้งานแอปปกติ"}
              </Text>
            </View>
            {loadingConfig ? (
              <ActivityIndicator color="#a73355" />
            ) : (
              <Switch
                value={isMaintenance}
                onValueChange={() => setMaintToggleAlert(true)}
                trackColor={{ false: "#ccc", true: "#ffe0b2" }}
                thumbColor={isMaintenance ? "#FF9800" : "#f4f3f4"}
              />
            )}
          </View>
        </View>

        {/* Student Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ค้นหาและจัดการนักศึกษา</Text>

          {/* New ID Search with Year Picker */}
          <View style={styles.idSearchContainer}>
            <TouchableOpacity
              style={styles.yearPickerBtn}
              onPress={() => setYearPickerModal(true)}
            >
              <Text style={styles.yearText}>ปี{selectedYear}</Text>
              <MaterialIcons name="arrow-drop-down" size={24} color="#a73355" />
            </TouchableOpacity>

            <View style={styles.idInputWrapper}>
              <TextInput
                style={styles.idInput}
                placeholder="รหัส หรือ ชื่อนักศึกษา..." // 🌟 เปลี่ยนคำใบ้
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search" // 🌟 เพิ่มปุ่มแว่นขยายในคีย์บอร์ด
              />
            </View>
            <TouchableOpacity style={styles.idSearchBtn} onPress={handleSearch}>
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {searching && (
            <ActivityIndicator color="#a73355" style={{ marginTop: 20 }} />
          )}

          {searchResults.map((item) => (
            <View key={item.profile.student_id} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Image
                  source={{
                    uri:
                      item.profile.avatar_url ||
                      "https://api.dicebear.com/7.x/avataaars/png?seed=" +
                        item.profile.student_id,
                  }}
                  style={styles.avatar}
                />
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{item.profile.name}</Text>
                  <Text style={styles.studentId}>
                    ID: {item.profile.student_id}
                  </Text>
                  <Text style={styles.infoLine}>
                    <MaterialIcons name="business" size={14} color="#888" />{" "}
                    คณะ: {item.profile.faculty}
                  </Text>
                  <Text style={styles.infoLine}>
                    <MaterialIcons name="school" size={14} color="#888" />{" "}
                    สาขา: {item.profile.major}
                  </Text>
                </View>
              </View>

              <View style={styles.contactBar}>
                <View style={styles.contactItem}>
                  <MaterialIcons name="email" size={14} color="#a73355" />
                  <Text style={styles.contactText}>
                    {item.profile.email || "ไม่ระบุ"}
                  </Text>
                </View>
                <View style={styles.contactItem}>
                  <MaterialIcons name="phone" size={14} color="#a73355" />
                  <Text style={styles.contactText}>
                    {item.profile.phone_number || "ไม่ระบุ"}
                  </Text>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openCourses(item)}
                >
                  <MaterialIcons name="list-alt" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>วิชาที่ลงทะเบียน</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#4A90E2" }]}
                  onPress={() => openGrades(item)}
                >
                  <MaterialIcons name="grade" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>ดูเกรด</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {!searching && searchResults.length === 0 && searchQuery !== "" && (
            <Text style={styles.emptyText}>ไม่พบข้อมูลนักศึกษา</Text>
          )}
        </View>
      </ScrollView>

      {/* --- Modals --- */}

      {/* Year Picker Modal */}
      <Modal visible={yearPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.yearPickerBox}>
            <Text style={styles.yearPickerTitle}>เลือกปีรหัสนักศึกษา</Text>
            <View style={styles.yearGrid}>
              {years.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[
                    styles.yearOption,
                    selectedYear === y && styles.yearOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedYear(y);
                    setYearPickerModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.yearOptionText,
                      selectedYear === y && styles.yearOptionTextSelected,
                    ]}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.yearCloseBtn}
              onPress={() => setYearPickerModal(false)}
            >
              <Text style={styles.yearCloseBtnText}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Grades Modal */}
      <CustomModal
        visible={gradesModal}
        title={`ผลการเรียน: ${selectedStudent?.profile.name}`}
        onClose={() => setGradesModal(false)}
      >
        <View style={styles.modalInner}>
          {selectedStudent?.grades && selectedStudent.grades.length > 0 ? (
            <>
              {/* ส่วนแสดงเกรดเฉลี่ยสะสมและหน่วยกิตสะสม */}
              <View
                style={{
                  backgroundColor: "#FFF3E0",
                  padding: 15,
                  borderRadius: 8,
                  marginBottom: 15,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color: "#E65100",
                    textAlign: "center",
                  }}
                >
                  เกรดเฉลี่ยสะสม (CGPA): {gradeSummary.cumulativeGPA}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#E65100",
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  หน่วยกิตสะสมรวม: {gradeSummary.totalCredits} หน่วยกิต
                </Text>
              </View>

              {/* แสดงข้อมูลแยกตามเทอม */}
              {gradeSummary.groupedByTerm.map((termData, index) => (
                <View key={index} style={{ marginBottom: 20 }}>
                  {/* แถบหัวข้อของแต่ละเทอม */}
                  <View
                    style={{
                      backgroundColor: "#a73355",
                      padding: 10,
                      borderRadius: 6,
                      marginBottom: 10,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      เทอม: {termData.term}
                    </Text>
                    <Text style={{ color: "#fff", fontSize: 13 }}>
                      GPA:{" "}
                      {termData.termGpaCredits > 0
                        ? (termData.termPoints / termData.termGpaCredits).toFixed(2)
                        : "0.00"}{" "}
                      | หน่วยกิต: {termData.termCredits}
                    </Text>
                  </View>

                  {/* รายชื่อวิชาในเทอมนั้นๆ */}
                  {termData.grades.map((g, idx) => (
                    <View key={idx} style={styles.gradeRow}>
                      <View style={styles.gradeCodeBox}>
                        <Text style={styles.gradeCodeText}>{g.course_id}</Text>
                      </View>
                      <View style={{ flex: 1, paddingHorizontal: 10 }}>
                        <Text style={styles.gradeCourseName} numberOfLines={1}>
                          {g.course_name || "รายวิชา"}
                        </Text>
                        <Text style={styles.gradeSem}>
                          หน่วยกิต: {g.cleanCredit}
                        </Text>
                      </View>
                      <View style={styles.gradeValueBox}>
                        <Text style={styles.gradeValueText}>{g.grade}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.emptyCenter}>ไม่มีข้อมูลเกรด</Text>
          )}
        </View>
      </CustomModal>

      {/* Courses Modal (Enhanced Details) */}
      <CustomModal
        visible={coursesModal}
        title={`รายวิชาของ: ${selectedStudent?.profile.name}`}
        onClose={() => setCoursesModal(false)}
      >
        <View style={styles.modalInner}>
          <Text style={styles.modalSubTitle}>
            ลงทะเบียนสำเร็จ ({selectedStudent?.enrolled.length})
          </Text>
          {selectedStudent?.enrolled.map((c, idx) => (
            <View key={idx} style={styles.detailCourseCard}>
              <View style={styles.detailRow}>
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: c.type === "L" ? "#4A90E2" : "#a73355" },
                  ]}
                >
                  {/* 🌟 เปลี่ยนตรงนี้ */}
                  <Text style={styles.typeBadgeText}>
                    {c.type === "L" ? "ปฏิบัติ" : "ทฤษฎี"}
                  </Text>
                </View>
                <Text style={styles.detailCourseCode}>
                  {c.course_id} (กลุ่ม {c.section})
                </Text>
              </View>
              <Text style={styles.detailCourseName}>{c.course_name}</Text>
              <View style={styles.detailInfoGrid}>
                <View style={styles.detailInfoItem}>
                  <MaterialIcons name="event" size={14} color="#666" />
                  <Text style={styles.detailInfoText}>{c.day || "-"}</Text>
                </View>
                <View style={styles.detailInfoItem}>
                  <MaterialIcons name="schedule" size={14} color="#666" />
                  <Text style={styles.detailInfoText}>{c.time || "-"}</Text>
                </View>
              </View>
              <View style={[styles.detailInfoItem, { marginTop: 4 }]}>
                <MaterialIcons name="person" size={14} color="#666" />
                <Text style={styles.detailInfoText}>
                  อาจารย์: {c.instructor_name || "ไม่ระบุ"}
                </Text>
              </View>
            </View>
          ))}

          <Text style={[styles.modalSubTitle, { marginTop: 20 }]}>
            Waitlist ({selectedStudent?.waitlist.length})
          </Text>
          {selectedStudent?.waitlist.map((w, idx) => (
            <View
              key={idx}
              style={[styles.detailCourseCard, { borderLeftColor: "#FF9800" }]}
            >
              <View style={styles.detailRow}>
                <View
                  style={[styles.typeBadge, { backgroundColor: "#FF9800" }]}
                >
                  {/* 🌟 และเปลี่ยนตรงนี้ */}
                  <Text style={styles.typeBadgeText}>
                    {w.type === "L" ? "ปฏิบัติ" : "ทฤษฎี"}
                  </Text>
                </View>
                <Text style={styles.detailCourseCode}>
                  {w.course_id} (กลุ่ม {w.section})
                </Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{w.status}</Text>
                </View>
              </View>
              <Text style={styles.detailCourseName}>{w.course_name}</Text>
              <View style={styles.detailInfoGrid}>
                <View style={styles.detailInfoItem}>
                  <MaterialIcons name="event" size={14} color="#666" />
                  <Text style={styles.detailInfoText}>{w.day || "-"}</Text>
                </View>
                <View style={styles.detailInfoItem}>
                  <MaterialIcons name="schedule" size={14} color="#666" />
                  <Text style={styles.detailInfoText}>{w.time || "-"}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.detailInfoItem,
                  {
                    marginTop: 8,
                    backgroundColor: "#FFF3E0",
                    padding: 5,
                    borderRadius: 5,
                  },
                ]}
              >
                <MaterialIcons name="history" size={14} color="#FF9800" />
                <Text style={[styles.detailInfoText, { color: "#E65100" }]}>
                  เข้าคิวเมื่อ: {formatDateTime(w.created_at)}
                </Text>
              </View>
            </View>
          ))}
          {selectedStudent?.enrolled.length === 0 &&
            selectedStudent?.waitlist.length === 0 && (
              <Text style={styles.emptyCenter}>ไม่มีข้อมูลการลงทะเบียน</Text>
            )}
        </View>
      </CustomModal>

      {/* --- Custom Alerts --- */}
      <CustomAlert
        visible={logoutAlert}
        title="ออกจากระบบ"
        message="ยืนยันการออกจากระบบผู้ดูแลใช่หรือไม่?"
        onCancel={() => setLogoutAlert(false)}
        onConfirm={onLogout}
        isDestructive
      />

      <CustomAlert
        visible={regisToggleAlert}
        title="ยืนยันการตั้งค่า"
        message={`คุณต้องการ ${!isRegisOpen ? "เปิด" : "ปิด"} ระบบการลงทะเบียนรายวิชาใช่หรือไม่?`}
        onCancel={() => setRegisToggleAlert(false)}
        onConfirm={confirmToggleRegistration}
      />

      <CustomAlert
        visible={maintToggleAlert}
        title="โหมดปิดปรับปรุง"
        message={`คุณต้องการ ${!isMaintenance ? "เปิด" : "ปิด"} โหมดปิดปรับปรุงแอปหรือไม่? (นักศึกษาจะไม่สามารถล็อคอินได้)`}
        onCancel={() => setMaintToggleAlert(false)}
        onConfirm={confirmToggleMaintenance}
        isDestructive={!isMaintenance}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f7f6" },
  header: {
    padding: 25,
    paddingTop: 45,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  adminTitle: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  adminName: { color: "#ffdada", fontSize: 16, marginTop: 5 },
  logoutBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    borderRadius: 12,
  },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    marginLeft: 5,
  },
  controlCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  controlIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: "#fdeef4",
    justifyContent: "center",
    alignItems: "center",
  },
  controlLabel: { fontSize: 16, fontWeight: "bold", color: "#444" },
  controlSubLabel: { fontSize: 13, marginTop: 2 },

  // New Search Styles
  idSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  yearPickerBtn: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#eee",
    marginRight: 10,
    elevation: 2,
  },
  yearText: { fontSize: 16, fontWeight: "bold", color: "#a73355" },
  idInputWrapper: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#eee",
    elevation: 2,
  },
  idInput: {
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    color: "#333",
  },
  idSearchBtn: {
    backgroundColor: "#a73355",
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 15,
    marginLeft: 10,
    elevation: 3,
  },

  // Student Card
  resultCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 25,
    marginBottom: 18,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  resultHeader: { flexDirection: "row", marginBottom: 15 },
  avatar: {
    width: 75,
    height: 75,
    borderRadius: 25,
    marginRight: 18,
    backgroundColor: "#f0f0f0",
  },
  studentInfo: { flex: 1 },
  studentName: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 2,
  },
  studentId: {
    fontSize: 14,
    color: "#a73355",
    fontWeight: "bold",
    marginBottom: 6,
  },
  infoLine: { fontSize: 13, color: "#777", marginBottom: 2 },
  contactBar: {
    flexDirection: "column",
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderRadius: 15,
    marginBottom: 15,
  },
  contactItem: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  contactText: { fontSize: 13, color: "#555", marginLeft: 8 },
  actionButtons: { flexDirection: "row", justifyContent: "space-between" },
  actionBtn: {
    flex: 0.48,
    backgroundColor: "#a73355",
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
    fontSize: 14,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    maxHeight: "80%",
    borderRadius: 25,
    overflow: "hidden",
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  modalBody: { padding: 20 },
  modalInner: { paddingBottom: 20 },
  modalSubTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#a73355",
    marginBottom: 15,
  },

  // Detailed Course Card
  detailCourseCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderLeftWidth: 5,
    borderLeftColor: "#a73355",
  },
  detailRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  typeBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  detailCourseCode: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  detailCourseName: { fontSize: 13, color: "#555", marginBottom: 8 },
  detailInfoGrid: { flexDirection: "row", flexWrap: "wrap" },
  detailInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
  },
  detailInfoText: { fontSize: 12, color: "#666", marginLeft: 5 },
  statusBadge: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: { fontSize: 10, color: "#666", fontWeight: "bold" },

  // Grade Styles
  gradeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
  },
  gradeCodeBox: { backgroundColor: "#a73355", padding: 6, borderRadius: 8 },
  gradeCodeText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  gradeCourseName: { fontSize: 14, fontWeight: "bold", color: "#444" },
  gradeSem: { fontSize: 12, color: "#888" },
  gradeValueBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#a73355",
    justifyContent: "center",
    alignItems: "center",
  },
  gradeValueText: { fontSize: 16, fontWeight: "bold", color: "#a73355" },

  // Year Picker Styles
  yearPickerBox: {
    backgroundColor: "#fff",
    width: "80%",
    borderRadius: 25,
    padding: 25,
    alignItems: "center",
  },
  yearPickerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  yearOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    margin: 8,
  },
  yearOptionSelected: { backgroundColor: "#a73355" },
  yearOptionText: { fontSize: 18, fontWeight: "bold", color: "#666" },
  yearOptionTextSelected: { color: "#fff" },
  yearCloseBtn: { marginTop: 20, padding: 10 },
  yearCloseBtnText: { color: "#a73355", fontWeight: "bold" },

  // Alert Styles
  alertBox: {
    backgroundColor: "#fff",
    width: "85%",
    padding: 25,
    borderRadius: 25,
    alignItems: "center",
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  alertMessage: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
  },
  alertButtons: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  alertBtnCancel: {
    flex: 0.45,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  alertBtnCancelText: { color: "#666", fontWeight: "bold" },
  alertBtnConfirm: {
    flex: 0.45,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#a73355",
  },
  alertBtnConfirmText: { color: "#fff", fontWeight: "bold" },

  emptyCenter: {
    textAlign: "center",
    color: "#ccc",
    marginTop: 20,
    fontStyle: "italic",
  },
  emptyText: { textAlign: "center", color: "#999", marginTop: 20 },
});
