// screens/LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal, 
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../components/shared";
import { Image } from "react-native";

export default function LoginScreen({ loading, onLogin }) {
  const [sid, setSid] = useState("");
  const [pw, setPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 🌟 State สำหรับ Custom Alert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  // ฟังก์ชันจัดการตอนกดปุ่ม Loginer
  const handleLogin = () => {
    // 1. แจ้งเตือนถ้ากรอกข้อมูลไม่ครบ (ใช้ Custom Alert แทน)
    if (!sid.trim() || !pw.trim()) {
      setAlertMessage("กรุณากรอกรหัสนักศึกษาและรหัสผ่านให้ครบถ้วน");
      setAlertVisible(true);
      return;
    }
    // 2. เรียกฟังก์ชัน onLogin เดิม
    onLogin(sid, pw);
  };

  return (
    <LinearGradient
      colors={["#fff8f8", "#fbf1f3", "#f0bebe"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.innerContainer}>
        
        {/* 🌟 Popup โหลด (Modal) 🌟 */}
        <Modal
          transparent={true}
          animationType="fade"
          visible={loading}
          onRequestClose={() => {}}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "#ffffff",
                paddingVertical: 35,
                paddingHorizontal: 40,
                borderRadius: 20,
                alignItems: "center",
                minWidth: 220,
                shadowColor: "#a73355",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 15,
                elevation: 10,
              }}
            >
              <ActivityIndicator
                size="large"
                color="#a73355"
                style={{ transform: [{ scale: 1.2 }] }}
              />
              <Text
                style={{
                  marginTop: 20,
                  fontSize: 16,
                  color: "#a73355",
                  fontWeight: "600",
                  letterSpacing: 0.5,
                }}
              >
                กำลังเข้าสู่ระบบ...
              </Text>
            </View>
          </View>
        </Modal>

        {/* 🌟 Popup แจ้งเตือน (Custom Alert Modal) 🌟 */}
        <Modal
          transparent={true}
          animationType="fade"
          visible={alertVisible}
          onRequestClose={() => setAlertVisible(false)}
        >
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
                shadowColor: "#a73355",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 15,
                elevation: 10,
              }}
            >
              <MaterialIcons name="error-outline" size={55} color="#a73355" style={{ marginBottom: 15 }} />
              <Text style={{ fontSize: 20, fontWeight: "bold", color: "#333", marginBottom: 10 }}>
                แจ้งเตือน
              </Text>
              <Text style={{ fontSize: 15, color: "#666", textAlign: "center", marginBottom: 25, lineHeight: 22 }}>
                {alertMessage}
              </Text>
              
              <TouchableOpacity
                style={{
                  backgroundColor: "#a73355",
                  paddingVertical: 12,
                  width: "100%",
                  borderRadius: 25,
                  alignItems: "center",
                  shadowColor: "#a73355",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 5,
                  elevation: 3,
                }}
                onPress={() => setAlertVisible(false)}
              >
                <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "bold" }}>ตกลง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ส่วนหัว Logo */}
        <View style={styles.headerWrapper}>
          <View>
            <Image
              source={require("../assets/icon_UPS.png")}
              style={{ width: 100, height: 100 }}
            />
          </View>
          <Text style={styles.appName}>UPS Regis</Text>
          <Text style={styles.appSubName}>แอปลงทะเบียนเรียน</Text>
        </View>

        {/* ส่วนข้อความ เข้าสู่ระบบ */}
        <View style={styles.loginTitleWrapper}>
          <Text style={styles.loginTitle}>เข้าสู่ระบบ</Text>
          <View style={styles.titleDivider} />
        </View>

        {/* ส่วนฟอร์มกรอกข้อมูล */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>รหัสนักศึกษา</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons
                name="person"
                size={20}
                color="#a73355"
                style={styles.inputIconLeft}
              />
              <TextInput
                style={styles.input}
                placeholder="กรอกรหัสนักศึกษา"
                placeholderTextColor="#999"
                value={sid}
                onChangeText={setSid}
                keyboardType="numeric"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>รหัสผ่าน</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons
                name="lock"
                size={20}
                color="#a73355"
                style={styles.inputIconLeft}
              />
              <TextInput
                style={styles.input}
                placeholder="กรอกรหัสผ่าน"
                placeholderTextColor="#999"
                value={pw}
                onChangeText={setPw}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.inputIconRight}
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialIcons
                  name={showPassword ? "visibility" : "visibility-off"}
                  size={20}
                  color="#a73355"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}