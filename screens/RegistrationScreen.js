import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Image, Modal, ActivityIndicator } from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { batchAddRequiredAPI } from '../api';

export default function RegistrationScreen({ student, setView }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🌟 State สำหรับเปิด/ปิด ป๊อปอัป (Modal)
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    // จำลองการดึงข้อมูล
    setTimeout(() => {
      setCourses([
        { code: 'CPE407', credits: 3, name: 'เครือข่ายสื่อสารคอมพิวเตอร์', seatsLeft: 12, theory: 'Sec 002 | Fri 09:00 - 10:40', lab: 'Sec 002 | Fri 13:00 - 15:30' },
        { code: 'CPE495', credits: 3, name: 'หัวข้อพิเศษวิศวกรรมคอมพิวเตอร์', seatsLeft: 5, theory: 'Sec 001 | Mon 09:00 - 11:30', lab: null },
        { code: 'CPE451', credits: 3, name: 'โปรแกรมประยุกต์', seatsLeft: 20, theory: 'Sec 002 | Tue 11:00 - 12:40', lab: 'Sec 002 | Tue 13:00 - 15:30' },
        { code: 'CPE408', credits: 3, name: 'เครือข่ายสื่อสารคอมพิวเตอร์', seatsLeft: 8, theory: 'Sec 001 | Sat 09:00 - 10:40', lab: 'Sec 001 | Sat 13:00 - 15:30' },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const handleProcessRegistration = async () => {
    setIsSubmitting(true);
    try {
      await batchAddRequiredAPI(student.student_id);
      setShowConfirmModal(false);
      // ไปหน้าตะกร้าทันทีหลังสำเร็จ
      setView('CART');
    } catch (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#FDEEF4', '#FFF8F8']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('MENU')} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#a73355" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ลงทะเบียนวิชาภาคฯ ยกชุด</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
           <View style={styles.center}>
             <ActivityIndicator size="large" color="#D23669" />
           </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>รายชื่อวิชาภาคฯ (Series)</Text>
              <View style={styles.badgeCount}><Text style={styles.badgeCountText}>{courses.length} รายวิชา</Text></View>
            </View>

            {courses.map((course, idx) => (
              <View key={idx} style={styles.courseCard}>
                <View style={styles.courseHeader}>
                  <Text style={styles.courseCode}>{course.code} • {course.credits} CREDITS</Text>
                  <View style={styles.seatsBadge}><Text style={styles.seatsText}>{course.seatsLeft} Left</Text></View>
                </View>
                <Text style={styles.courseName}>{course.name}</Text>
                <View style={styles.timeRow}><MaterialIcons name="menu-book" size={12} color="#D23669" /><Text style={styles.timeText}>Theory: {course.theory}</Text></View>
                {course.lab && <View style={styles.timeRow}><MaterialIcons name="science" size={12} color="#D23669" /><Text style={styles.timeText}>Lab: {course.lab}</Text></View>}
              </View>
            ))}

            <View style={styles.infoBox}>
              <MaterialIcons name="info-outline" size={20} color="#a73355" />
              <Text style={styles.infoText}>กรุณาตรวจสอบเวลาเรียนที่ซ้อนทับกันก่อนยืนยันการจองที่นั่ง</Text>
            </View>
          </ScrollView>
        )}

        {/* ⚡ ปุ่มกดยืนยัน (เพื่อเปิด Modal) */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => setShowConfirmModal(true)}>
            <LinearGradient colors={['#D23669', '#a73355']} style={styles.confirmGradient} start={{x: 0, y: 0}} end={{x: 1, y: 0}}>
              <FontAwesome5 name="bolt" size={18} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.confirmBtnText}>ยืนยันลงทะเบียนคลิกเดียว</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 🌟 ส่วนที่เอาไปใส่ (วางไว้ก่อนบรรทัดสุดท้ายของไฟล์) */}
        <Modal transparent visible={showConfirmModal} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <LinearGradient colors={['#FFDAE4', '#FDEEF4']} style={styles.modalIconCircle}>
                  {/* แก้เป็น name="check" เรียบร้อยแล้ว (ติ๊กเดียว) */}
                  <FontAwesome5 name="check" size={28} color="#D23669" />
                </LinearGradient>
              </View>
              
              <Text style={styles.modalTitle}>ยืนยันรายการ</Text>
              <Text style={styles.modalDesc}>
                ระบบจะทำการเพิ่มวิชาทั้งชุด <Text style={{fontWeight: 'bold', color: '#D23669'}}>{courses.length} รายวิชา</Text> ลงในตะกร้าของคุณทันที ยืนยันหรือไม่?
              </Text>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowConfirmModal(false)}>
                  <Text style={styles.modalCancelText}>ยกเลิก</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleProcessRegistration} disabled={isSubmitting}>
                  <LinearGradient colors={['#D23669', '#a73355']} style={styles.modalConfirmGradient}>
                    {isSubmitting ? <ActivityIndicator color="white" /> : <Text style={styles.modalConfirmText}>ตกลง</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(210, 54, 105, 0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f1a1c' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 150 },
  
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10, marginBottom: 25 },
  profileImageContainer: { position: 'relative' },
  profileImage: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: 'white' },
  statusDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, backgroundColor: '#22c55e', borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  welcomeSubText: { fontSize: 11, color: '#514345', fontWeight: 'bold' },
  welcomeText: { fontSize: 22, fontWeight: '900', color: '#1f1a1c' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f1a1c' },
  badgeCount: { backgroundColor: 'rgba(210, 54, 105, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeCountText: { fontSize: 10, fontWeight: 'bold', color: '#a73355' },

  courseCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(210, 54, 105, 0.1)', elevation: 1 },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  courseCode: { fontSize: 11, fontWeight: '900', color: '#a73355' },
  seatsBadge: { backgroundColor: '#FFF0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  seatsText: { fontSize: 9, fontWeight: 'bold', color: '#D23669' },
  courseName: { fontSize: 14, fontWeight: 'bold', color: '#514345', marginBottom: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  timeText: { fontSize: 11, color: '#837375' },

  infoBox: { flexDirection: 'row', backgroundColor: 'rgba(210, 54, 105, 0.05)', padding: 16, borderRadius: 16, gap: 10 },
  infoText: { flex: 1, fontSize: 11, color: '#514345', lineHeight: 18 },

  bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  confirmBtn: { borderRadius: 16, overflow: 'hidden' },
  confirmGradient: { paddingVertical: 18, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  confirmBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  // 🌟 MODAL STYLES (ส่วนที่ทำให้ป๊อปอัปสวยขึ้น)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  modalContent: { backgroundColor: 'white', borderRadius: 30, padding: 24, width: '100%', alignItems: 'center' },
  modalIconContainer: { marginTop: -60, marginBottom: 20 },
  modalIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1f1a1c', marginBottom: 10 },
  modalDesc: { fontSize: 14, color: '#514345', textAlign: 'center', lineHeight: 22, marginBottom: 25 },
  modalButtonRow: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: { flex: 1, paddingVertical: 15, alignItems: 'center', borderRadius: 15, backgroundColor: '#F3F4F6' },
  modalCancelText: { color: '#6B7280', fontWeight: 'bold' },
  modalConfirmBtn: { flex: 1, borderRadius: 15, overflow: 'hidden' },
  modalConfirmGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { color: 'white', fontWeight: 'bold' }
});