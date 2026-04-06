// screens/LoginScreen.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator,
  Modal, // เพิ่ม Modal
  Alert  // เพิ่ม Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from "../components/shared";

export default function LoginScreen({ loading, onLogin }) {
  const [sid, setSid] = useState('');
  const [pw, setPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ฟังก์ชันจัดการตอนกดปุ่ม Login
  const handleLogin = () => {
    // 1. แจ้งเตือนถ้ากรอกข้อมูลไม่ครบ
    if (!sid.trim() || !pw.trim()) {
      Alert.alert("แจ้งเตือน", "กรุณากรอกรหัสนักศึกษาและรหัสผ่านให้ครบถ้วน");
      return;
    }
    // 2. เรียกฟังก์ชัน onLogin เดิม
    onLogin(sid, pw);
  };

  return (
    <LinearGradient 
      colors={['#fff8f8', '#fbf1f3', '#f0bebe']} 
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
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', // พื้นหลังโปร่งแสงสีดำ
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <View style={{
              backgroundColor: '#fff',
              padding: 24,
              borderRadius: 12,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5
            }}>
              <ActivityIndicator size="large" color="#a73355" />
              <Text style={{ marginTop: 12, fontSize: 16, color: '#333', fontWeight: 'bold' }}>
                กำลังเข้าสู่ระบบ...
              </Text>
            </View>
          </View>
        </Modal>

        {/* ส่วนหัว Logo */}
        <View style={styles.headerWrapper}>
          <View style={styles.logoBox}>
            <MaterialIcons name="menu-book" size={40} color="white" />
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
              <MaterialIcons name="person" size={20} color="#a73355" style={styles.inputIconLeft} />
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
              <MaterialIcons name="lock" size={20} color="#a73355" style={styles.inputIconLeft} />
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

          {/* เปลี่ยนไปเรียกใช้ handleLogin แทน */}
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