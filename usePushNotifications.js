import { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// ตั้งค่าให้แอปแสดงแจ้งเตือนแม้เปิดแอปอยู่ (Foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const usePushNotifications = (student_id) => {
  const [expoPushToken, setExpoPushToken] = useState("");

  // 🌟 ส่วนที่ 1: ดึง Token แค่ครั้งเดียวตอนเปิดแอป (สังเกตว่าวงเล็บท้ายสุดว่างเปล่า [])
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      setExpoPushToken(token);
    });
  }, []);

  // 🌟 ส่วนที่ 2: รอจนกว่าจะได้ Token และผู้ใช้ทำการ Login (มี student_id) แล้วถึงจะยิง API
  useEffect(() => {
    if (expoPushToken && student_id) {
      updateTokenToBackend(student_id, expoPushToken);
    }
  }, [expoPushToken, student_id]); // <--- จับตาดู 2 ตัวนี้ ถ้าอันใดอันนึงเปลี่ยน จะเช็คเงื่อนไขใหม่ทันที

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== "granted") {
        alert("ไม่สามารถขอสิทธิ์แจ้งเตือนได้!");
        return;
      }
      
      // ดึง Token ประจำเครื่อง
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig.extra.eas.projectId, 
        })
      ).data;
      
      console.log("========== EXPO PUSH TOKEN ==========");
      console.log(token); 
      console.log("=====================================");
    } else {
      alert("Push Notifications ต้องใช้บนเครื่องจริงเท่านั้น (Emulator ใช้ไม่ได้)");
    }

    return token;
  }

  // ฟังก์ชันจำลองการยิง API ไป Backend
  const updateTokenToBackend = async (id, token) => {
    try {
      await fetch(`http://10.175.15.135:8000/students/${id}/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ push_token: token }),
      });
      console.log(`✅ บันทึก Token อัตโนมัติสำเร็จสำหรับรหัส: ${id}`);
    } catch (e) {
      console.log("❌ Update token error:", e);
    }
  };

  return expoPushToken;
};