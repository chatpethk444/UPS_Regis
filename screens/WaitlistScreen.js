import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getWaitlistStatusAPI,
  confirmWaitlistSeatAPI,
  cancelWaitlistAPI,
} from "../api";

const { width } = Dimensions.get("window");

// 1. สร้าง Custom Alert Modal
const CustomAlert = ({
  visible,
  title,
  message,
  type,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  const getIcon = () => {
    switch (type) {
      case "success":
        return <MaterialIcons name="check-circle" size={50} color="#4CAF50" />;
      case "warning":
        return <MaterialIcons name="warning" size={50} color="#FF9800" />;
      case "danger":
        return <MaterialIcons name="error" size={50} color="#F44336" />;
      default:
        return <MaterialIcons name="info" size={50} color="#2196F3" />;
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        activeOpacity={1}
        style={styles.modalOverlay}
        onPress={onCancel}
      >
        <TouchableWithoutFeedback>
          <View style={styles.modalContent}>
            {getIcon()}
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalMessage}>{message}</Text>

            <View style={styles.modalBtnGroup}>
              {onCancel && (
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={onCancel}
                >
                  <Text style={styles.modalBtnTextCancel}>ยกเลิก</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={{ flex: 1 }} onPress={onConfirm}>
                <LinearGradient
                  colors={
                    type === "danger"
                      ? ["#F44336", "#D32F2F"]
                      : type === "warning"
                        ? ["#FF9800", "#F57C00"]
                        : ["#4CAF50", "#2E7D32"]
                  }
                  style={styles.modalBtnConfirm}
                >
                  <Text style={styles.modalBtnTextConfirm}>
                    {onCancel ? "ยืนยัน" : "ตกลง"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};

const WaitlistCard = ({
  course_id,
  course_name,
  schedule,
  room,
  created_at,
  section_number,
  section_type,
  queue_position,
  status,
  allocated_at,
  onConfirm,
  onCancel,
}) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (status !== "ALLOCATED" || !allocated_at) return;
    const calculateTimeLeft = () => {
      const now = new Date();
      const validDateStr = allocated_at.endsWith("Z")
        ? allocated_at
        : allocated_at + "Z";
      const allocatedTime = new Date(validDateStr);
      const diffInSecs = Math.floor((now - allocatedTime) / 1000);
      const remaining = 1800 - diffInSecs;
      return remaining > 0 ? remaining : 0;
    };
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [status, allocated_at]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatJoinedDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(
      dateString.endsWith("Z") ? dateString : dateString + "Z",
    );
    return date.toLocaleString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = () => {
    switch (status) {
      case "PENDING":
        return "#FF9800";
      case "ALLOCATED":
        return "#2196F3";
      case "CONFIRMED":
        return "#4CAF50";
      case "EXPIRED":
        return "#F44336";
      default:
        return "#837375";
    }
  };

  const typeLabel = section_type === "T" ? "ทฤษฎี" : "ปฏิบัติ";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.courseCode}>{course_id}</Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "bold",
              color: "#514345",
              marginTop: 2,
            }}
          >
            {course_name}
          </Text>
          <Text style={styles.sectionInfo}>
            กลุ่ม {section_number} ({typeLabel})
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: getStatusColor() + "15",
              alignSelf: "flex-start",
            },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {status === "PENDING"
              ? "กำลังรอคิว"
              : status === "ALLOCATED"
                ? "ได้สิทธิ์แล้ว"
                : status === "CONFIRMED"
                  ? "ยืนยันสำเร็จ"
                  : "หมดเวลา/สละสิทธิ์"}
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: "#f9f9f9",
          padding: 10,
          borderRadius: 8,
          marginTop: 10,
        }}
      >
        <Text style={{ fontSize: 12, color: "#837375", marginBottom: 4 }}>
          <MaterialIcons name="schedule" size={14} color="#837375" /> เรียน:{" "}
          {schedule}
        </Text>
        <Text style={{ fontSize: 12, color: "#837375", marginBottom: 4 }}>
          <MaterialIcons name="room" size={14} color="#837375" /> ห้อง: {room}
        </Text>
        {created_at && (
          <Text style={{ fontSize: 12, color: "#a73355" }}>
            <MaterialIcons name="history" size={14} color="#a73355" />{" "}
            กดคิวเมื่อ: {formatJoinedDate(created_at)}
          </Text>
        )}
      </View>

      <View style={styles.body}>
        {status === "PENDING" ? (
          <View style={styles.pendingContainer}>
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              <MaterialIcons name="hourglass-empty" size={24} color="#FF9800" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.queueLabel}>ลำดับคิวปัจจุบัน</Text>
                <Text style={styles.queueNumber}>#{queue_position}</Text>
              </View>
            </View>
            {/* 🌟 2. ปุ่มยกเลิกคิวสำหรับสถานะ PENDING */}
            <TouchableOpacity onPress={onCancel} style={styles.btnCancelSmall}>
              <Text style={styles.btnTextCancelSmall}>ยกเลิกคิว</Text>
            </TouchableOpacity>
          </View>
        ) : status === "ALLOCATED" ? (
          <View style={styles.allocatedContainer}>
            <View style={styles.timerBox}>
              <MaterialIcons name="timer" size={20} color="#F44336" />
              <Text style={styles.timerText}>กรุณายืนยันสิทธิ์ภายใน: </Text>
              <Text style={styles.countdown}>{formatTime(timeLeft)}</Text>
            </View>
            <View style={styles.btnGroup}>
              <TouchableOpacity
                onPress={onCancel}
                style={[styles.btn, styles.btnCancel]}
              >
                <Text style={styles.btnTextCancel}>สละสิทธิ์</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onConfirm}
                activeOpacity={0.8}
                style={styles.btnConfirmContainer}
              >
                <LinearGradient
                  colors={["#4CAF50", "#2E7D32"]}
                  style={styles.btnConfirm}
                >
                  <Text style={styles.btnTextConfirm}>ยืนยันสิทธิ์</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ) : status === "CONFIRMED" ? (
          <View
            style={[
              styles.pendingContainer,
              { backgroundColor: "#E8F5E9", justifyContent: "center" },
            ]}
          >
            <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
            <Text
              style={[
                styles.queueLabel,
                {
                  color: "#2E7D32",
                  flex: 0,
                  marginLeft: 8,
                  fontWeight: "bold",
                },
              ]}
            >
              คุณได้ยืนยันสิทธิ์วิชานี้แล้ว
            </Text>
          </View>
        ) : (
          <View style={styles.expiredContainer}>
            <Text style={styles.expiredText}>
              คุณไม่ได้ยืนยันสิทธิ์ในเวลาที่กำหนด หรือสละสิทธิ์ไปแล้ว
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const WaitlistScreen = ({ setView, student }) => {
  const [waitlists, setWaitlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const student_id = student?.student_id;

  // 🌟 State สำหรับ Custom Modal
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info",
    onConfirm: null,
    onCancel: null,
  });

  const showAlert = (title, message, type, onConfirm, onCancel = null) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      onConfirm,
      onCancel,
    });
  };

  const closeAlert = () => setAlertConfig({ ...alertConfig, visible: false });

  // 🌟 3. ฟังก์ชันดึงข้อมูลแบบแยกโหลดแร้ง (Silent Load สำหรับ Polling)
  const fetchWaitlistData = useCallback(
    async (isSilent = false) => {
      if (!student_id) return;
      if (!isSilent) setLoading(true); // โชว์วงกลมหมุนแค่ตอนโหลดครั้งแรกหรือกด Refresh มือ
      try {
        const data = await getWaitlistStatusAPI(student_id);
        setWaitlists(data || []);
      } catch (error) {
        if (!isSilent)
          showAlert(
            "ข้อผิดพลาด",
            error.message || "ไม่สามารถดึงข้อมูลรายการต่อคิวได้",
            "danger",
            closeAlert,
          );
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [student_id],
  );

  // 🌟 4. ระบบ Polling (ดึงข้อมูลอัตโนมัติทุกๆ 10 วินาที)
  useEffect(() => {
    fetchWaitlistData(false); // โหลดครั้งแรก (มี Loading)
    const interval = setInterval(() => {
      fetchWaitlistData(true); // โหลดเงียบๆ เบื้องหลัง (ไม่มี Loading)
    }, 10000); // 10 วินาที

    return () => clearInterval(interval); // ล้าง Interval เมื่อออกจากหน้า
  }, [fetchWaitlistData]);

  const handleConfirmSeat = (waitlist_id, course_code) => {
    showAlert(
      "ยืนยันการใช้สิทธิ์",
      `คุณต้องการยืนยันสิทธิ์ลงทะเบียนวิชา ${course_code} ใช่หรือไม่?`,
      "info",
      async () => {
        closeAlert();
        try {
          await confirmWaitlistSeatAPI(waitlist_id);
          setTimeout(() => {
            showAlert(
              "สำเร็จ 🎉",
              `เพิ่มวิชา ${course_code} ลงในตารางเรียนเรียบร้อยแล้ว!`,
              "success",
              closeAlert,
            );
            fetchWaitlistData(false);
          }, 500); // หน่วงเวลาให้ UI ปิด Modal แรกก่อนเปิดอันใหม่
        } catch (error) {
          setTimeout(
            () =>
              showAlert(
                "ไม่สามารถยืนยันสิทธิ์ได้",
                error.message,
                "danger",
                closeAlert,
              ),
            500,
          );
        }
      },
      closeAlert,
    );
  };

  const handleCancelSeat = (waitlist_id, course_code, isPending = false) => {
    showAlert(
      isPending ? "ยกเลิกการต่อคิว" : "ยืนยันการสละสิทธิ์",
      `คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคิววิชา ${course_code}?`,
      "warning",
      async () => {
        closeAlert();
        try {
          await cancelWaitlistAPI(waitlist_id);
          setTimeout(() => {
            showAlert(
              "สำเร็จ",
              "ยกเลิกคิวเรียบร้อยแล้ว",
              "success",
              closeAlert,
            );
            fetchWaitlistData(false);
          }, 500);
        } catch (error) {
          setTimeout(
            () =>
              showAlert(
                "ข้อผิดพลาด",
                error.message || "ไม่สามารถยกเลิกคิวได้",
                "danger",
                closeAlert,
              ),
            500,
          );
        }
      },
      closeAlert,
    );
  };

  return (
    <LinearGradient colors={["#FFDAE4", "#FFF8F8"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screenHeader}>
          <TouchableOpacity
            onPress={() => setView("MENU")}
            style={styles.backBtn}
          >
            <MaterialIcons name="arrow-back-ios" size={20} color="#a73355" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>รายการรอคิว (Waitlist)</Text>
          <TouchableOpacity
            onPress={() => fetchWaitlistData(false)}
            style={{ padding: 8 }}
          >
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
          ) : waitlists.length > 0 ? (
            waitlists.map((item) => (
              <WaitlistCard
                key={item.id}
                {...item}
                onConfirm={() => handleConfirmSeat(item.id, item.course_id)}
                onCancel={() =>
                  handleCancelSeat(
                    item.id,
                    item.course_id,
                    item.status === "PENDING",
                  )
                }
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="event-note" size={64} color="#ccc" />
              <Text style={styles.emptyText}>ไม่มีรายการรอคิวในขณะนี้</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* 🌟 เรียกใช้ Custom Alert */}
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    paddingLeft: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#a73355" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  emptyContainer: { marginTop: 100, alignItems: "center", opacity: 0.6 },
  emptyText: { fontSize: 16, color: "#837375", marginTop: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 12,
  },
  courseCode: { fontSize: 18, fontWeight: "bold", color: "#a73355" },
  sectionInfo: { fontSize: 14, color: "#837375", marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "bold" },
  body: { marginTop: 16 },

  /* PENDING STYLES */
  pendingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF9C4",
    padding: 12,
    borderRadius: 12,
  },
  queueLabel: { fontSize: 12, color: "#514345" },
  queueNumber: { fontSize: 20, fontWeight: "bold", color: "#FF9800" },
  btnCancelSmall: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F44336",
  },
  btnTextCancelSmall: { fontSize: 12, color: "#F44336", fontWeight: "bold" },

  /* ALLOCATED STYLES */
  allocatedContainer: { gap: 12 },
  timerBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffebee",
    padding: 8,
    borderRadius: 8,
  },
  timerText: { fontSize: 13, color: "#514345" },
  countdown: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F44336",
    fontFamily: "monospace",
  },
  btnGroup: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnCancel: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  btnTextCancel: { color: "#F44336", fontWeight: "bold" },
  btnConfirmContainer: { flex: 1.5 },
  btnConfirm: {
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnTextConfirm: { color: "#fff", fontWeight: "bold" },
  expiredContainer: { alignItems: "center", padding: 10 },
  expiredText: { color: "#837375", fontSize: 13, fontStyle: "italic" },

  /* 🌟 CUSTOM MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalBtnGroup: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnCancel: { backgroundColor: "#f5f5f5" },
  modalBtnTextCancel: { color: "#666", fontWeight: "bold", fontSize: 16 },
  modalBtnConfirm: {
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnTextConfirm: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});

export default WaitlistScreen;
