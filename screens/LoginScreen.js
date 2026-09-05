// screens/LoginScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../components/shared";

export default function LoginScreen({ loading, onLogin }) {
  const [sid, setSid] = useState(""); // รหัสนักศึกษา[cite: 1]
  const [pw, setPw] = useState(""); // รหัสผ่าน[cite: 1]
  const [showPassword, setShowPassword] = useState(false);

  // State สำหรับ Custom Alert[cite: 1]
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const animateButtonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const animateButtonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = () => {
    // แจ้งเตือนถ้ากรอกข้อมูลไม่ครบ[cite: 1]
    if (!sid.trim() || !pw.trim()) {
      setAlertMessage("กรุณากรอกรหัสนักศึกษาและรหัสผ่านให้ครบถ้วน");
      setAlertVisible(true);
      return;
    }
    onLogin(sid, pw);
  };

  return (
    <LinearGradient
      colors={["#fff8f8", "#fbf1f3", "#f0bebe"]}
      style={[styles.container, { flex: 1 }]}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20 }}
        >
          
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

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            
            {/* ส่วนหัว Logo */}
            <View style={[styles.headerWrapper, { alignItems: 'center', marginBottom: 40 }]}>
              <View style={{
                  shadowColor: "#a73355",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.1,
                  shadowRadius: 20,
                  elevation: 5,
              }}>
                <Image
                  source={require("../assets/icon_UPS.png")}
                  style={{ width: 110, height: 110, marginBottom: 15, borderRadius: 25 }}
                />
              </View>
              <Text style={[styles.appName, { fontSize: 28, fontWeight: '800', color: '#a73355' }]}>UPS Regis</Text>
              <Text style={[styles.appSubName, { fontSize: 16, color: '#666', marginTop: 5 }]}>แอปลงทะเบียนเรียน</Text>
            </View>

            {/* ส่วนฟอร์มกรอกข้อมูล */}
            <View style={[styles.formContainer, { backgroundColor: '#fff', borderRadius: 24, padding: 25, shadowColor: "#a73355", shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 8 }]}>
              
              <View style={{ marginBottom: 25 }}>
                <Text style={[styles.loginTitle, { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 8 }]}>เข้าสู่ระบบ</Text>
                <View style={[styles.titleDivider, { width: 40, height: 4, backgroundColor: '#a73355', borderRadius: 2 }]} />
              </View>

              <View style={[styles.inputGroup, { marginBottom: 20 }]}>
                <Text style={[styles.label, { fontSize: 14, color: '#555', marginBottom: 8, fontWeight: '600' }]}>รหัสนักศึกษา</Text>
                <View style={[styles.inputWrapper, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#eee' }]}>
                  <MaterialIcons
                    name="person"
                    size={22}
                    color="#a73355"
                    style={styles.inputIconLeft}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, paddingVertical: 15, marginLeft: 10, fontSize: 16, color: '#333' }]}
                    placeholder="กรอกรหัสนักศึกษา"
                    placeholderTextColor="#aaa"
                    value={sid}
                    onChangeText={setSid}
                    keyboardType="numeric"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, { marginBottom: 30 }]}>
                <Text style={[styles.label, { fontSize: 14, color: '#555', marginBottom: 8, fontWeight: '600' }]}>รหัสผ่าน</Text>
                <View style={[styles.inputWrapper, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#eee' }]}>
                  <MaterialIcons
                    name="lock"
                    size={22}
                    color="#a73355"
                    style={styles.inputIconLeft}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, paddingVertical: 15, marginLeft: 10, fontSize: 16, color: '#333' }]}
                    placeholder="กรอกรหัสผ่าน"
                    placeholderTextColor="#aaa"
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
                      size={22}
                      color="#a73355"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.loginButton, { 
                    backgroundColor: '#a73355', 
                    paddingVertical: 16, 
                    borderRadius: 12, 
                    alignItems: 'center',
                    shadowColor: "#a73355",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                    elevation: 5
                  }]}
                  onPressIn={animateButtonPressIn}
                  onPressOut={animateButtonPressOut}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  <Text style={[styles.loginButtonText, { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 }]}>เข้าสู่ระบบ</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}