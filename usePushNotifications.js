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

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      setExpoPushToken(token);
      // 🌟 ทันทีที่ได้ Token ให้ยิง API ไปอัปเดตใน Backend ทันที
      if (token && student_id) {
        updateTokenToBackend(student_id, token);
      }
    });
  }, [student_id]);

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
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
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
          projectId: Constants.expoConfig.extra.eas.projectId, // ถ้าใช้ EAS build
        })
      ).data;
      console.log("========== EXPO PUSH TOKEN ==========");
      console.log(token); // 🌟 เพิ่มบรรทัดนี้เพื่อก๊อปปี้ไปเทส
      console.log("=====================================");
    } else {
      alert(
        "Push Notifications ต้องใช้บนเครื่องจริงเท่านั้น (Emulator ใช้ไม่ได้)",
      );
    }

    return token;
  }

  // ฟังก์ชันจำลองการยิง API ไป Backend
  const updateTokenToBackend = async (id, token) => {
    try {
      // 🌟 เปลี่ยน URL ให้ตรงกับ API ของคุณ (เช่น http://192.168.1.xxx:8000/...)
      await fetch(`http://YOUR_API_IP_ADDRESS:8000/students/${id}/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ push_token: token }),
      });
      console.log("บันทึก Token อัตโนมัติสำเร็จ!");
    } catch (e) {
      console.log("Update token error:", e);
    }
  };

  return expoPushToken;
};
