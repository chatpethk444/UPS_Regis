// screens/LoginScreen.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from "../components/shared";


export default function LoginScreen({ loading, onLogin }) {
  const [sid, setSid] = useState('');
  const [pw, setPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  return (
    <LinearGradient 
      colors={['#fff8f8', '#fbf1f3', '#f0bebe']} 
      style={styles.container}
    >
      <SafeAreaView style={styles.innerContainer}>
        
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


          {/* ปุ่ม Login ที่เชื่อมกับ App.js เดิม */}
          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={() => onLogin(sid, pw)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
            )}
          </TouchableOpacity>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

