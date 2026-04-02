import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function MenuScreen({ student, setView, onBatch, onLogout }) {
  // คำนวณชั้นปีคร่าวๆ
  const year = student?.year ? (2569 - parseInt(student.year)) : 3;
  console.log(student.avatar_url)
  return (
    <LinearGradient colors={['#FFDAE4', '#FFF8F8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.3 }} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Top AppBar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="menu-book" size={24} color="#514345" />
            <Text style={styles.headerTitle}>UPS Regis</Text>
          </View>
          <TouchableOpacity style={styles.bellButton}>
            <MaterialIcons name="notifications-none" size={24} color="#514345" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
        {/* Profile Section - เปลี่ยน View เป็น TouchableOpacity เพื่อให้กดได้ */}
        <TouchableOpacity 
          style={styles.profileSection} 
          activeOpacity={0.7} 
          onPress={() => setView('PROFILE')}
        >
          <View style={styles.profileImageContainer}>
            {/* 🌟 ดึงรูปนักศึกษาจาก Database (ถ้ามีรูปถึงจะแสดง) */}
       
            {student?.avatar_url && (
              <Image 
                source={{ uri: student.avatar_url }} 
                style={styles.profileImage} 
              />
            )}
            <View style={styles.statusDot} />
          </View>
          <View>
            <Text style={styles.welcomeText}>สวัสดี {student?.first_name || 'นักศึกษา'}</Text>
            <Text style={styles.majorText}>{student?.major || 'วิศวกรรมคอมพิวเตอร์'} ปี {year}</Text>
          </View>
        </TouchableOpacity>

          {/* การ์ด 1: ลงทะเบียนยกชุด */}
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBoxMain}>
                <MaterialIcons name="auto-awesome" size={22} color="#D23669" />
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>RECOMMEND</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>ลงทะเบียนวิชาภาคฯ ยกชุด</Text>
            <Text style={styles.cardDesc}>คัดสรรวิชาตามแผนการเรียนของคุณ พร้อมสิทธิพิเศษในการเลือกเซกชันก่อนใคร</Text>
            
            <TouchableOpacity style={styles.actionBtn} onPress={() => setView('REGISTRATION')}>
              <Text style={styles.btnText}>จัดการแผนการเรียน</Text>
              <MaterialIcons name="arrow-forward" size={16} color="white" />
            </TouchableOpacity>
          </View>

          {/* การ์ดรอง 2 ใบ */}
          <View style={styles.gridRow}>
            
            {/* ตารางเรียนอัตโนมัติ (วิ่งไปหน้า AI ของคุณ) */}
            <View style={styles.subCard}>
              <View style={styles.iconBoxSub}>
                <MaterialIcons name="event-note" size={20} color="#D23669" />
              </View>
              <Text style={styles.subCardTitle}>ตารางเรียนอัตโนมัติ</Text>
              <Text style={styles.subCardDesc}>จัด 2-5 แผนการเรียนที่คุณเลือกได้ตามใจ</Text>
              <TouchableOpacity style={styles.textBtn} onPress={() => setView('AI')}>
                <Text style={styles.textBtnText}>เริ่มสร้าง</Text>
                <MaterialIcons name="chevron-right" size={16} color="#D23669" />
              </TouchableOpacity>
            </View>

            {/* เพื่อนช่วยลง (วิ่งไปหน้า GROUP_SYNC) */}
            <View style={styles.subCard}>
              <View style={styles.iconBoxSub}>
                <MaterialIcons name="people" size={20} color="#D23669" />
              </View>
              <Text style={styles.subCardTitle}>เพื่อนช่วยลง</Text>
              <Text style={styles.subCardDesc}>ซิงค์ตารางเรียนกับเพื่อนสูงสุด 5 คนแบบเรียลไทม์</Text>
              <TouchableOpacity style={styles.textBtn} onPress={() => setView('GROUP_SYNC')}>
                <Text style={styles.textBtnText}>รวมกลุ่ม</Text>
                <MaterialIcons name="chevron-right" size={16} color="#D23669" />
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>

        {/* Floating Bottom Navigation Bar */}
        <View style={styles.floatingNavContainer}>
          <View style={styles.floatingNav}>
            <TouchableOpacity style={styles.navItemActive}>
              <MaterialIcons name="home" size={24} color="#a73355" />
              <Text style={styles.navTextActive}>HOME</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.navItem} onPress={() => setView('MANUAL')}>
              <MaterialIcons name="search" size={24} color="#837375" />
              <Text style={styles.navText}>SEARCH</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.navItem} onPress={() => setView('CART')}>
              <MaterialIcons name="shopping-cart" size={24} color="#837375" />
              <Text style={styles.navText}>CART</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.navItem} onPress={() => setView('SCHEDULE')}>
              <MaterialIcons name="calendar-today" size={24} color="#837375" />
              <Text style={styles.navText}>SCHEDULE</Text>
            </TouchableOpacity>

          </View>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#514345', letterSpacing: -0.5 },
  bellButton: { padding: 4 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  // 🌟 ปรับขนาดของ container ให้คงที่ กันจุดเขียวเบี้ยวเวลาไม่มีรูป
  profileImageContainer: { position: 'relative', width: 64, height: 64, borderRadius: 32, backgroundColor: 'white' },
  profileImage: { width: '100%', height: '100%', borderRadius: 32 },
  statusDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, backgroundColor: '#22c55e', borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  welcomeText: { fontSize: 20, fontWeight: '800', color: '#1f1a1c', marginBottom: 2 },
  majorText: { fontSize: 12, fontWeight: '600', color: '#514345' },
  mainCard: { backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: 20, borderRadius: 24, marginBottom: 16, shadowColor: 'rgba(167, 51, 85, 0.05)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  iconBoxMain: { backgroundColor: '#FDEEF4', padding: 10, borderRadius: 12 },
  badge: { backgroundColor: '#a82d68', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: 'white', letterSpacing: 0.5 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#1f1a1c', marginBottom: 8 },
  cardDesc: { fontSize: 12, color: '#514345', marginBottom: 20, lineHeight: 18 },
  actionBtn: { backgroundColor: '#D23669', flexDirection: 'row', paddingVertical: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 24, gap: 8 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  subCard: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: 16, borderRadius: 20, shadowColor: 'rgba(167, 51, 85, 0.05)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
  iconBoxSub: { width: 36, height: 36, backgroundColor: '#FDEEF4', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  subCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1f1a1c', marginBottom: 6 },
  subCardDesc: { fontSize: 10, color: '#514345', marginBottom: 16, lineHeight: 14 },
  textBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  textBtnText: { color: '#a73355', fontSize: 11, fontWeight: 'bold' },
  floatingNavContainer: { position: 'absolute', bottom: 20, left: 16, right: 16 },
  floatingNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 40, paddingHorizontal: 8, paddingVertical: 8, shadowColor: '#a73355', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  navItemActive: { alignItems: 'center', backgroundColor: '#FDEEF4', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  navTextActive: { fontSize: 9, fontWeight: 'bold', color: '#a73355', marginTop: 4, letterSpacing: 0.5 },
  navItem: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10 },
  navText: { fontSize: 9, fontWeight: 'bold', color: '#837375', marginTop: 4, letterSpacing: 0.5 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FDEEF4', justifyContent: 'center', alignItems: 'center', marginRight: 4 },
});