import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { MaterialIcons } from "@expo/vector-icons"; // 🌟 เพิ่มไอคอน
import * as Notifications from "expo-notifications";

import { usePushNotifications } from "./usePushNotifications";
import { loginAPI, batchAddRequiredAPI } from "./api";

import LoginScreen from "./screens/LoginScreen";
import MenuScreen from "./screens/MenuScreen";
import ManualScreen from "./screens/ManualScreen";
import AIScreen from "./screens/AIScreen";
import CartScreen from "./screens/CartScreen";
import ScheduleScreen from "./screens/ScheduleScreen";
import GroupSyncScreen from "./screens/GroupSyncScreen";
import WaitlistScreen from "./screens/WaitlistScreen";
import ProfileScreen from "./screens/ProfileScreen";
import RegistrationScreen from "./screens/RegistrationScreen";
import AdminHomeScreen from "./screens/AdminHomeScreen";

export default function App() {
  const [view, setView] = useState("LOGIN");
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const expoPushToken = usePushNotifications(student?.student_id);

  // 🌟 State สำหรับ Custom Alert ทั้งหมดใน App
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    type: "alert", // มี 2 แบบ: 'alert' (ปุ่มเดียว) และ 'confirm' (2 ปุ่ม)
    onConfirm: null,
  });

  // 🌟 ฟังก์ชันเรียกใช้ Alert ให้ง่ายขึ้น
  const showAlert = (title, message) => {
    setAlertConfig({ visible: true, title, message, type: "alert", onConfirm: null });
  };

  const showConfirm = (title, message, onConfirm) => {
    setAlertConfig({ visible: true, title, message, type: "confirm", onConfirm });
  };

  const closeAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  // ลอจิกดักจับการกดแจ้งเตือน
  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data.screen === "Waitlist") {
        setView("WAITLIST");
      }
    });

    return () => {
      responseListener.remove();
    };
  }, []);

  const handleLogin = async (sid, pw) => {
    setLoading(true);
    try {
      const data = await loginAPI(sid, pw);
      setStudent(data);
      if (data.role === "ADMIN") {
        setView("ADMIN_HOME");
      } else {
        setView("MENU");
      }
    } catch (e) {
      // 🌟 เปลี่ยนจาก Alert.alert เป็น showAlert
      showAlert("เข้าสู่ระบบล้มเหลว", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchRegis = () => {
    // 🌟 เปลี่ยนจาก Alert.alert เป็น showConfirm
    showConfirm("Batch Registration", "ต้องการเพิ่มวิชาบังคับลงตะกร้าหรือไม่?", async () => {
      try {
        const count = await batchAddRequiredAPI(student.student_id);
        showAlert("สำเร็จ", `เพิ่ม ${count} วิชาบังคับลงตะกร้าแล้ว!`);
      } catch (e) {
        showAlert("เกิดข้อผิดพลาด", e.message);
      }
    });
  };

  const handleLogout = () => {
    setStudent(null);
    setView("LOGIN");
  };

  const screens = {
    LOGIN: <LoginScreen loading={loading} onLogin={handleLogin} />,
    MENU: <MenuScreen student={student} setView={setView} onBatch={handleBatchRegis} onLogout={handleLogout} />,
    MANUAL: <ManualScreen student={student} setView={setView} />,
    AI: <AIScreen student={student} setView={setView} />,
    CART: <CartScreen student={student} setView={setView} />,
    SCHEDULE: <ScheduleScreen student={student} setView={setView} />,
    GROUP_SYNC: <GroupSyncScreen student={student} setView={setView} />,
    WAITLIST: <WaitlistScreen student={student} setView={setView} />,
    PROFILE: <ProfileScreen student={student} setView={setView} onLogout={handleLogout} />,
    REGISTRATION: <RegistrationScreen student={student} setView={setView} />,
    ADMIN_HOME: <AdminHomeScreen student={student} setView={setView} onLogout={handleLogout} />,
  };

  // 🌟 กำหนดไอคอนและสีตาม Title ของ Alert
  let alertIcon = "info-outline";
  let alertIconColor = "#a73355"; // สีแดงธีมหลัก
  if (alertConfig.title.includes("สำเร็จ")) {
    alertIcon = "check-circle-outline";
    alertIconColor = "#28a745"; // สีเขียวเมื่อสำเร็จ
  } else if (alertConfig.title.includes("ล้มเหลว") || alertConfig.title.includes("ผิดพลาด")) {
    alertIcon = "error-outline";
  }

  return (
    <>
      {/* ส่วนแสดงผล Screen ปัจจุบัน */}
      {screens[view] ?? screens["LOGIN"]}

      {/* 🌟 Custom Alert Modal ระดับ Global 🌟 */}
      <Modal transparent={true} animationType="fade" visible={alertConfig.visible} onRequestClose={closeAlert}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#ffffff",
              paddingTop: 30,
              paddingBottom: 25,
              paddingHorizontal: 25,
              borderRadius: 20,
              alignItems: "center",
              width: "100%",
              maxWidth: 320,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 15,
              elevation: 10,
            }}
          >
            <MaterialIcons name={alertIcon} size={55} color={alertIconColor} style={{ marginBottom: 15 }} />
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#333", marginBottom: 10, textAlign: "center" }}>
              {alertConfig.title}
            </Text>
            <Text style={{ fontSize: 15, color: "#666", textAlign: "center", marginBottom: 25, lineHeight: 22 }}>
              {alertConfig.message}
            </Text>

            {/* ปุ่มกดจะเปลี่ยนตามประเภทของ Alert */}
            {alertConfig.type === "confirm" ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 15 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: "#f0f0f0",
                    paddingVertical: 12,
                    borderRadius: 25,
                    alignItems: "center",
                  }}
                  onPress={closeAlert}
                >
                  <Text style={{ color: "#666", fontSize: 16, fontWeight: "bold" }}>ยกเลิก</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: "#a73355",
                    paddingVertical: 12,
                    borderRadius: 25,
                    alignItems: "center",
                    shadowColor: "#a73355",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 5,
                    elevation: 3,
                  }}
                  onPress={() => {
                    closeAlert();
                    if (alertConfig.onConfirm) alertConfig.onConfirm();
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "bold" }}>ตกลง</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={{
                  backgroundColor: alertIconColor, // สีปุ่มอิงตามประเภท Alert
                  paddingVertical: 12,
                  width: "100%",
                  borderRadius: 25,
                  alignItems: "center",
                  shadowColor: alertIconColor,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 5,
                  elevation: 3,
                }}
                onPress={closeAlert}
              >
                <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "bold" }}>ตกลง</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}