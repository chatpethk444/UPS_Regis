import React, { useState, useEffect } from "react"; // 🌟 เพิ่ม useEffect
import { Alert } from "react-native";
import * as Notifications from 'expo-notifications'; // 🌟 เพิ่ม Notifications

import { usePushNotifications } from './usePushNotifications';
import { loginAPI, batchAddRequiredAPI } from "./api";

import LoginScreen      from "./screens/LoginScreen";
import MenuScreen       from "./screens/MenuScreen";
import ManualScreen     from "./screens/ManualScreen";
import AIScreen         from "./screens/AIScreen";
import CartScreen       from "./screens/CartScreen";
import ScheduleScreen   from "./screens/ScheduleScreen";
import GroupSyncScreen  from "./screens/GroupSyncScreen"; 
import WaitlistScreen   from "./screens/WaitlistScreen";
import ProfileScreen    from './screens/ProfileScreen';
import RegistrationScreen from './screens/RegistrationScreen'; 

export default function App() {
  const [view, setView]       = useState("LOGIN");
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const expoPushToken = usePushNotifications(student?.student_id);

  // 🌟 ลอจิกดักจับการกดแจ้งเตือน
  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data.screen === "Waitlist") {
        setView("WAITLIST"); 
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  const handleLogin = async (sid, pw) => {
    setLoading(true);
    try {
      const data = await loginAPI(sid, pw);
      setStudent(data); 
      setView("MENU");
    } catch (e) {
      Alert.alert("เข้าสู่ระบบล้มเหลว", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchRegis = () => {
    Alert.alert("Batch Registration", "เพิ่มวิชาบังคับลงตะกร้า?", [
      { text: "ยกเลิก" },
      {
        text: "ตกลง",
        onPress: async () => {
          try {
            const count = await batchAddRequiredAPI(student.student_id);
            Alert.alert("สำเร็จ", `เพิ่ม ${count} วิชาบังคับลงตะกร้าแล้ว!`);
          } catch (e) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    setStudent(null);
    setView("LOGIN");
  };

  const screens = {
    LOGIN:        <LoginScreen        loading={loading} onLogin={handleLogin} />,
    MENU:         <MenuScreen         student={student} setView={setView} onBatch={handleBatchRegis} onLogout={handleLogout} />,
    MANUAL:       <ManualScreen       student={student} setView={setView} />,
    AI:           <AIScreen           student={student} setView={setView} />,
    CART:         <CartScreen         student={student} setView={setView} />,
    SCHEDULE:     <ScheduleScreen     student={student} setView={setView} />,
    GROUP_SYNC:   <GroupSyncScreen    student={student} setView={setView} />,
    WAITLIST:     <WaitlistScreen     student={student} setView={setView} />,
    PROFILE:      <ProfileScreen      student={student} setView={setView} onLogout={handleLogout} />,
    REGISTRATION: <RegistrationScreen student={student} setView={setView} />,
  };

  return screens[view] ?? screens["LOGIN"];
}