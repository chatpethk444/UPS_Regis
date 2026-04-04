import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSuggestedCoursesAPI, batchAddWithCheckAPI, getCartAPI } from '../api';

const DAY_MAP = { Mon: "จันทร์", Tue: "อังคาร", Wed: "พุธ", Thu: "พฤหัสบดี", Fri: "ศุกร์", Sat: "เสาร์", Sun: "อาทิตย์" };

export default function RegistrationScreen({ student, setView }) {
  const [courses, setCourses] = useState([]);
  const [cartCourseCodes, setCartCourseCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedData, setSelectedData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictData, setConflictData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. ดึงข้อมูลวิชาที่อยู่ในตะกร้าปัจจุบันมาเก็บไว้เช็ค
      const cart = await getCartAPI(student.student_id);
      const cartCodes = cart.map(c => c.course_code || c.course_id);
      setCartCourseCodes(cartCodes);

      // 2. ดึงวิชาที่แนะนำ
      const data = await getSuggestedCoursesAPI(student.student_id);
      setCourses(data);
      
      // Auto-select วิชาที่ยังไม่มีในตะกร้า
      const initSelect = {};
      data.forEach(c => {
        let firstT = null;
        let firstL = null;
        Object.keys(c.sections).forEach(secNum => {
          c.sections[secNum].forEach(slot => {
            if (slot.section_type === 'T' && !firstT) firstT = secNum;
            if (slot.section_type === 'L' && !firstL) firstL = secNum;
          });
        });

        // ถ้ายังไม่มีในตะกร้า ให้ตั้งค่าเริ่มต้นให้
        if (!cartCodes.includes(c.course_code)) {
          initSelect[c.course_code] = { checked: true, secT: firstT, secL: firstL };
        }
      });
      setSelectedData(initSelect);
    } catch (e) {
      Alert.alert("ข้อผิดพลาด", e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCheck = (code) => {
    // เช็คเงื่อนไข: ถ้ามีในตะกร้าแล้ว ห้ามกดเลือกเด็ดขาด
    if (cartCourseCodes.includes(code)) {
      Alert.alert("ไม่สามารถเพิ่มได้", `รายวิชา ${code} มีอยู่ในตะกร้าของคุณแล้ว`);
      return;
    }

    setSelectedData(prev => ({
      ...prev,
      [code]: { ...prev[code], checked: !prev[code]?.checked }
    }));
  };

  const changeSection = (code, typeField, sec) => {
    setSelectedData(prev => ({
      ...prev,
      [code]: { ...prev[code], [typeField]: sec }
    }));
  };

  const handleRegister = async () => {
    const items = [];
    Object.entries(selectedData).forEach(([code, val]) => {
      if (val.checked) {
        // แยกส่ง T และ L เป็นคนละก้อน ทำให้เลือก Sec สลับกันได้
        if (val.secT) items.push({ course_code: code, section_number: val.secT, section_type: 'T' });
        if (val.secL) items.push({ course_code: code, section_number: val.secL, section_type: 'L' });
      }
    });
      
    if (items.length === 0) {
      Alert.alert("แจ้งเตือน", "กรุณาเลือกอย่างน้อย 1 วิชา");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await batchAddWithCheckAPI(student.student_id, items);
      if (res.status === "conflict") {
        setConflictData(res.conflicts); 
      } else {
        Alert.alert("สำเร็จ", "เพิ่มวิชาลงตะกร้าเรียบร้อยแล้ว!");
        setView("CART");
      }
    } catch (e) {
      Alert.alert("ข้อผิดพลาด", e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveConflict = (course_code, section_type, suggested_section) => {
    if (!suggested_section) {
      // ไม่มี Sec ว่างให้ติ๊กวิชานี้ออกไปเลย
      setSelectedData(prev => ({ ...prev, [course_code]: { ...prev[course_code], checked: false } }));
    } else {
      // เปลี่ยนไปใช้ Sec ที่ไม่ชน
      const typeField = section_type === 'T' ? 'secT' : 'secL';
      setSelectedData(prev => ({ ...prev, [course_code]: { ...prev[course_code], [typeField]: suggested_section } }));
    }
    
    setConflictData(prev => {
      const remaining = prev.filter(c => !(c.course_code === course_code && c.section_type === section_type));
      if (remaining.length === 0) return null; 
      return remaining;
    });
  };

  return (
    <LinearGradient colors={['#FFDAE4', '#FFF8F8']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView("MENU")} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ลงทะเบียนยกภาค</Text>
          <TouchableOpacity onPress={fetchData}>
             <MaterialIcons name="refresh" size={24} color="#a73355" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#a73355" style={{ marginTop: 100 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.infoText}>วิชาแนะนำสำหรับสาขา {student?.major || ""}</Text>
            
            {courses.length === 0 ? (
              <Text style={{textAlign: 'center', marginTop: 50, color: '#837375'}}>ไม่มีวิชาแนะนำในชั้นปีนี้</Text>
            ) : (
              courses.map(item => {
                const inCart = cartCourseCodes.includes(item.course_code);
                const selected = selectedData[item.course_code] || {};

                // ค้นหา Sec ที่มี T และ L มาแยกกัน
                const tSecs = [];
                const lSecs = [];
                Object.keys(item.sections).forEach(secNum => {
                  item.sections[secNum].forEach(slot => {
                    if (slot.section_type === 'T' && !tSecs.includes(secNum)) tSecs.push(secNum);
                    if (slot.section_type === 'L' && !lSecs.includes(secNum)) lSecs.push(secNum);
                  });
                });

                return (
                  <View key={item.course_code} style={[styles.courseCard, inCart && { opacity: 0.6 }]}>
                    
                    {/* ส่วนหัว Card: ถ้ารายวิชามีในตะกร้าจะโชว์รูปกุญแจแดง */}
                    <TouchableOpacity style={styles.cardHeader} onPress={() => toggleCheck(item.course_code)} activeOpacity={inCart ? 1 : 0.7}>
                      <MaterialIcons 
                        name={inCart ? "lock" : (selected.checked ? "check-box" : "check-box-outline-blank")} 
                        size={26} 
                        color={inCart ? "#E53935" : (selected.checked ? "#a73355" : "#ccc")} 
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.courseCode, inCart && { color: '#E53935' }]}>
                          {item.course_code}
                          {inCart && <Text style={{fontSize: 10, color: '#E53935'}}> (มีในตะกร้าแล้ว)</Text>}
                        </Text>
                        <Text style={styles.courseName}>{item.course_name}</Text>
                      </View>
                      <Text style={styles.credits}>{item.credits} หน่วยกิต</Text>
                    </TouchableOpacity>
                    
                    {/* ส่วนเลือก Section และแสดงเวลา */}
                    {selected.checked && !inCart && (
                      <View style={styles.sectionContainer}>
                        
                        {/* เลือก ทฤษฎี (T) */}
                        {tSecs.length > 0 && (
                          <View style={{ marginBottom: 10 }}>
                            <Text style={styles.secTitle}>ทฤษฎี (T):</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                              {tSecs.map(sec => (
                                <TouchableOpacity 
                                  key={`T-${sec}`} 
                                  style={[styles.secChip, selected.secT === sec && styles.secChipActive]}
                                  onPress={() => changeSection(item.course_code, 'secT', sec)}
                                >
                                  <Text style={[styles.secChipText, selected.secT === sec && styles.secChipTextActive]}>Sec {sec}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}

                        {/* เลือก ปฏิบัติ (L) */}
                        {lSecs.length > 0 && (
                          <View style={{ marginBottom: 10 }}>
                            <Text style={styles.secTitle}>ปฏิบัติ (L):</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                              {lSecs.map(sec => (
                                <TouchableOpacity 
                                  key={`L-${sec}`} 
                                  style={[styles.secChip, selected.secL === sec && styles.secChipActive]}
                                  onPress={() => changeSection(item.course_code, 'secL', sec)}
                                >
                                  <Text style={[styles.secChipText, selected.secL === sec && styles.secChipTextActive]}>Sec {sec}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                        
                        {/* กล่องสรุปเวลาเรียน */}
                        <View style={styles.timeBox}>
                          {selected.secT && item.sections[selected.secT]?.filter(s => s.section_type === 'T').map((t, i) => (
                            <Text key={`time-T-${i}`} style={styles.timeText}>
                              • [ทฤษฎี Sec {selected.secT}] วัน{DAY_MAP[t.day_of_week] || t.day_of_week} {t.start_time}-{t.end_time}
                            </Text>
                          ))}
                          {selected.secL && item.sections[selected.secL]?.filter(s => s.section_type === 'L').map((t, i) => (
                            <Text key={`time-L-${i}`} style={styles.timeText}>
                              • [ปฏิบัติ Sec {selected.secL}] วัน{DAY_MAP[t.day_of_week] || t.day_of_week} {t.start_time}-{t.end_time}
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <View style={styles.bottomArea}>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleRegister} disabled={isSubmitting}>
            <LinearGradient colors={['#a73355', '#7b1d3a']} style={styles.confirmGradient}>
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Feather name="plus-circle" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmBtnText}>เพิ่มวิชาทั้งหมดลงตะกร้า</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 🚨 MODAL เตือนตารางชน 🚨 */}
        <Modal visible={!!conflictData} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <View style={styles.modalIconCircle}>
                  <MaterialIcons name="event-busy" size={40} color="#FFF" />
                </View>
              </View>
              <Text style={styles.modalTitle}>ตรวจพบเวลาเรียนชนกัน!</Text>
              <Text style={styles.modalDesc}>กรุณาตรวจสอบและแก้ไข Section ด้านล่างนี้</Text>
              
              <ScrollView style={{ width: '100%', maxHeight: 250 }}>
                {conflictData?.map((c, i) => (
                  <View key={i} style={styles.conflictCard}>
                    <Text style={styles.conflictCourse}>{c.course_code} ({c.section_type === 'T' ? 'ทฤษฎี' : 'ปฏิบัติ'} Sec {c.requested_section})</Text>
                    <Text style={styles.conflictSubtitle}>ชนกับวิชาในตะกร้า</Text>
                    
                    {c.suggested_section ? (
                      <TouchableOpacity style={styles.suggestBtn} onPress={() => resolveConflict(c.course_code, c.section_type, c.suggested_section)}>
                        <MaterialIcons name="autorenew" size={16} color="white" style={{marginRight:5}}/>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>เปลี่ยนเป็น Sec {c.suggested_section} ที่ไม่ชน</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.removeBtn} onPress={() => resolveConflict(c.course_code, c.section_type, null)}>
                        <MaterialIcons name="delete" size={16} color="white" style={{marginRight:5}}/>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>ยกเลิกการลงวิชานี้ (ไม่มี Sec ว่าง)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setConflictData(null)}>
                <Text style={{ color: '#837375', fontWeight: 'bold' }}>ปิดหน้าต่าง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#7b5455' },
  backButton: { padding: 8, backgroundColor: 'white', borderRadius: 12 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },
  infoText: { fontSize: 14, color: '#837375', marginBottom: 15, fontWeight: 'bold' },
  
  courseCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  courseCode: { fontSize: 16, fontWeight: 'bold', color: '#1f1a1c' },
  courseName: { fontSize: 12, color: '#837375', marginTop: 2 },
  credits: { fontSize: 14, fontWeight: 'bold', color: '#a73355' },
  
  sectionContainer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  secTitle: { fontSize: 12, fontWeight: 'bold', color: '#514345', marginBottom: 5 },
  secChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f5f5f5', marginRight: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  secChipActive: { backgroundColor: '#FDEEF4', borderColor: '#a73355' },
  secChipText: { fontSize: 12, color: '#837375', fontWeight: 'bold' },
  secChipTextActive: { color: '#a73355' },
  
  timeBox: { backgroundColor: '#F9F9F9', padding: 10, borderRadius: 8 },
  timeText: { fontSize: 12, color: '#514345', marginBottom: 4, fontWeight: 'bold' },

  bottomArea: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'white', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  confirmBtn: { borderRadius: 16, overflow: 'hidden' },
  confirmGradient: { paddingVertical: 18, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  confirmBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' },
  modalIconContainer: { marginTop: -50, marginBottom: 10 },
  modalIconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#E53935', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1f1a1c', marginBottom: 5 },
  modalDesc: { fontSize: 13, color: '#837375', marginBottom: 20 },
  
  conflictCard: { backgroundColor: '#FFF5F5', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#FFCDD2' },
  conflictCourse: { fontSize: 15, fontWeight: 'bold', color: '#B71C1C' },
  conflictSubtitle: { fontSize: 12, color: '#E53935', marginBottom: 10 },
  suggestBtn: { flexDirection: 'row', backgroundColor: '#4CAF50', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  removeBtn: { flexDirection: 'row', backgroundColor: '#757575', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }
});