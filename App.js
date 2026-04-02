import React, { useState } from "react";
import { Alert } from "react-native";

import { loginAPI, batchAddRequiredAPI } from "./api";

import LoginScreen      from "./screens/LoginScreen";
import MenuScreen       from "./screens/MenuScreen";
import ManualScreen     from "./screens/ManualScreen";
import AIScreen         from "./screens/AIScreen";
import CartScreen       from "./screens/CartScreen";
import ScheduleScreen   from "./screens/ScheduleScreen";
import GroupSyncScreen  from "./screens/GroupSyncScreen"; 
import ProfileScreen    from './screens/ProfileScreen';

// ✅ 1. Import หน้า RegistrationScreen เข้ามาให้ถูกต้องตามชื่อไฟล์
import RegistrationScreen from './screens/RegistrationScreen'; 

export default function App() {
  const [view, setView]       = useState("LOGIN");
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);

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
    PROFILE:      <ProfileScreen      student={student} setView={setView} onLogout={handleLogout} />,
    
    // ✅ 2. เพิ่มคีย์ REGISTRATION เข้าไป เพื่อให้แอปสลับมาหน้านี้ได้
    REGISTRATION: <RegistrationScreen student={student} setView={setView} />,
  };

  return screens[view] ?? screens["LOGIN"];
}