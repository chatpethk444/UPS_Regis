import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, 
  TextInput, Alert, ActivityIndicator, Image 
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  createGroupAPI, 
  joinGroupAPI, 
  getMyGroupAPI, 
  approveMemberAPI, 
  syncGroupCartAPI,
  leaveGroupAPI,    // 🌟 นำเข้า API ออกจากกลุ่ม
  deleteGroupAPI    // 🌟 นำเข้า API ลบกลุ่ม
} from '../api';

export default function GroupSyncScreen({ student, setView }) {
  const [groupCode, setGroupCode] = useState('');
  const [mode, setMode] = useState('JOIN'); 
  const [loading, setLoading] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);

  useEffect(() => {
    fetchMyGroup();
  }, []);

  const fetchMyGroup = async () => {
    setLoading(true);
    try {
      const data = await getMyGroupAPI(student.student_id);
      setGroupInfo(data);
    } catch (e) {
      Alert.alert("ข้อผิดพลาด", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    setLoading(true);
    try {
      await createGroupAPI(student.student_id);
      Alert.alert("สำเร็จ", "สร้างกลุ่มปาร์ตี้เรียบร้อย!");
      fetchMyGroup();
    } catch (e) {
      Alert.alert("ข้อผิดพลาด", e.message);
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!groupCode.trim()) return Alert.alert("แจ้งเตือน", "กรุณากรอกรหัสกลุ่ม");
    setLoading(true);
    try {
      await joinGroupAPI(student.student_id, groupCode.trim().toUpperCase());
      Alert.alert("ส่งคำขอแล้ว", "รอหัวหน้ากลุ่มกดยืนยันนะครับ");
      fetchMyGroup();
    } catch (e) {
      Alert.alert("ข้อผิดพลาด", e.message);
      setLoading(false);
    }
  };

  const handleApprove = async (target_id, action) => {
    try {
      await approveMemberAPI(student.student_id, target_id, action);
      if(action === 'REJECT') Alert.alert("สำเร็จ", "เตะสมาชิกออกจากกลุ่มแล้ว");
      fetchMyGroup();
    } catch (e) {
      Alert.alert("ข้อผิดพลาด", e.message);
    }
  };

  const handleSyncCart = () => {
    Alert.alert(
      "ยืนยันการ Sync รายวิชา",
      "ระบบจะคัดลอกตะกร้าของคุณไปใส่ให้เพื่อนแทน ยืนยันหรือไม่?",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยัน Sync",
          onPress: async () => {
            setLoading(true);
            try {
              await syncGroupCartAPI(student.student_id);
              Alert.alert("สำเร็จ!", "อัปเดตวิชาในตะกร้าให้เพื่อนทุกคนเรียบร้อย");
              fetchMyGroup(); // Refresh เพื่ออัปเดตเวลา Sync
            } catch (e) {
              Alert.alert("ข้อผิดพลาด", e.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert("ยืนยัน", "คุณต้องการออกจากกลุ่มใช่หรือไม่?", [
      { text: "ยกเลิก" },
      { text: "ออกจากกลุ่ม", onPress: async () => {
        setLoading(true);
        try {
          await leaveGroupAPI(student.student_id);
          fetchMyGroup();
        } catch (e) {
          Alert.alert("Error", e.message);
          setLoading(false);
        }
      }, style: 'destructive'}
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert("ยุบกลุ่มปาร์ตี้", "คุณแน่ใจหรือไม่ว่าจะยุบกลุ่มนี้? สมาชิกทุกคนจะถูกลบออก", [
      { text: "ยกเลิก" },
      { text: "ยุบกลุ่ม", onPress: async () => {
        setLoading(true);
        try {
          await deleteGroupAPI(student.student_id);
          fetchMyGroup();
        } catch (e) {
          Alert.alert("Error", e.message);
          setLoading(false);
        }
      }, style: 'destructive'}
    ]);
  };

  // 🌟 ฟังก์ชันแปลงเวลา UTC เป็นเวลาไทยน่ารักๆ
  const formatSyncTime = (isoString) => {
    if (!isoString) return "ยังไม่เคย Sync";
    const date = new Date(isoString);
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + " น.";
  };

  if (loading && !groupInfo) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#a73355" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#FFDAE4', '#FFF8F8']} start={{x: 0, y: 0}} end={{x: 1, y: 0.3}} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header พร้อม Avatar ตัวเองและปุ่ม Refresh */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('MENU')} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>เพื่อนช่วยลง (Party)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={fetchMyGroup} style={{ marginRight: 12 }}>
              <MaterialIcons name="refresh" size={26} color="#a73355" />
            </TouchableOpacity>
            {student?.avatar_url ? (
              <Image source={{ uri: student.avatar_url }} style={styles.myAvatar} />
            ) : (
              <MaterialIcons name="account-circle" size={32} color="#a73355" />
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* ----- ยังไม่มีกลุ่ม ----- */}
          {groupInfo && !groupInfo.has_group && (
            <View style={styles.noGroupContainer}>
              <MaterialIcons name="groups" size={80} color="rgba(167,51,85,0.3)" style={{ alignSelf: 'center', marginBottom: 20 }} />
              
              <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabBtn, mode === 'JOIN' && styles.tabBtnActive]} onPress={() => setMode('JOIN')}>
                  <Text style={[styles.tabText, mode === 'JOIN' && styles.tabTextActive]}>เข้าร่วมกลุ่ม</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, mode === 'CREATE' && styles.tabBtnActive]} onPress={() => setMode('CREATE')}>
                  <Text style={[styles.tabText, mode === 'CREATE' && styles.tabTextActive]}>สร้างกลุ่มใหม่</Text>
                </TouchableOpacity>
              </View>

              {mode === 'JOIN' ? (
                <View style={styles.actionCard}>
                  <Text style={styles.label}>รหัสกลุ่ม 6 หลัก</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="เช่น A8X9K2"
                    placeholderTextColor="#ccc"
                    value={groupCode}
                    onChangeText={setGroupCode}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleJoinGroup}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>ขอเข้าร่วมกลุ่ม</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionCard}>
                  <Text style={[styles.label, { textAlign: 'center', marginBottom: 20 }]}>
                    สร้างกลุ่มใหม่เพื่อเป็นหัวหน้าปาร์ตี้{"\n"}และจัดการรายวิชาให้เพื่อนๆ
                  </Text>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateGroup}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>สร้างกลุ่ม</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ----- มีกลุ่มแล้ว (รออนุมัติ) ----- */}
          {groupInfo && groupInfo.has_group && groupInfo.my_status === 'PENDING' && (
            <View style={styles.pendingContainer}>
              <MaterialIcons name="hourglass-empty" size={80} color="#f59e0b" style={{ alignSelf: 'center', marginBottom: 20 }} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f1a1c', textAlign: 'center' }}>กำลังรออนุมัติ</Text>
              <Text style={{ fontSize: 14, color: '#514345', textAlign: 'center', marginTop: 10, marginBottom: 20 }}>
                ส่งคำขอเข้าร่วมกลุ่ม <Text style={{fontWeight: 'bold'}}>{groupInfo.group_code}</Text> แล้ว
              </Text>
              <TouchableOpacity onPress={handleLeaveGroup} style={styles.dangerBtnOutline}>
                <Text style={styles.dangerBtnText}>ยกเลิกคำขอ</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ----- มีกลุ่มแล้ว (APPROVED / Leader) ----- */}
          {groupInfo && groupInfo.has_group && groupInfo.my_status === 'APPROVED' && (
            <View>
              {/* บัตรข้อมูลกลุ่ม */}
              <LinearGradient colors={['#D23669', '#a73355']} style={styles.groupDetailCard}>
                <Text style={{ color: '#FDEEF4', fontSize: 14 }}>รหัสกลุ่มของคุณ</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 32, fontWeight: 'bold', letterSpacing: 2 }}>{groupInfo.group_code}</Text>
                  {groupInfo.is_my_leader && (
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>หัวหน้ากลุ่ม</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>

              {/* แจ้งเตือนการ Sync (สำหรับลูกทีม) */}
              {!groupInfo.is_my_leader && (
                <View style={styles.syncAlertBox}>
                  {groupInfo.last_synced_at ? (
                    <>
                      <MaterialIcons name="check-circle" size={24} color="#10b981" />
                      <Text style={{ color: '#10b981', marginLeft: 10, fontWeight: 'bold', flex: 1 }}>
                        หัวหน้า Sync ตะกร้าให้แล้ว! (เวลา {formatSyncTime(groupInfo.last_synced_at)})
                      </Text>
                    </>
                  ) : (
                    <>
                      <ActivityIndicator size="small" color="#f59e0b" />
                      <Text style={{ color: '#f59e0b', marginLeft: 10, fontWeight: 'bold', flex: 1 }}>
                        กำลังรอหัวหน้า Sync ตะกร้าให้...
                      </Text>
                    </>
                  )}
                </View>
              )}

              {/* รายชื่อสมาชิก */}
              <Text style={styles.sectionTitle}>สมาชิก ({groupInfo.members.filter(m => m.status === 'APPROVED').length}/5 คน)</Text>
              {groupInfo.members.map((member, idx) => (
                <View key={idx} style={styles.memberCard}>
                  {/* รูปเพื่อน หรือ Icon */}
                  {member.avatar_url ? (
                    <Image source={{ uri: member.avatar_url }} style={styles.memberAvatarImg} />
                  ) : (
                    <View style={styles.memberAvatarPlaceholder}>
                      <MaterialIcons name="person" size={24} color="#a73355" />
                    </View>
                  )}
                  
                  <View style={{ flex: 1, paddingLeft: 12 }}>
                    <Text style={styles.memberName}>{member.name || member.student_id}</Text>
                    <Text style={styles.memberId}>{member.student_id}</Text>
                  </View>
                  
                  {member.status === 'APPROVED' ? (
                    member.is_leader ? (
                      <MaterialIcons name="star" size={24} color="#f59e0b" />
                    ) : (
                      /* ถ้าเราเป็นหัวหน้า จะมีปุ่มลบ (เตะ) สมาชิก */
                      groupInfo.is_my_leader && (
                        <TouchableOpacity onPress={() => handleApprove(member.student_id, 'REJECT')} style={styles.removeMemberBtn}>
                          <MaterialIcons name="person-remove" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      )
                    )
                  ) : (
                    groupInfo.is_my_leader ? (
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity onPress={() => handleApprove(member.student_id, 'REJECT')} style={styles.rejectBtn}>
                          <MaterialIcons name="close" size={20} color="#ef4444" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleApprove(member.student_id, 'APPROVE')} style={styles.approveBtn}>
                          <MaterialIcons name="check" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 12, color: '#f59e0b', fontWeight: 'bold' }}>รออนุมัติ</Text>
                    )
                  )}
                </View>
              ))}

              {/* ปุ่ม Action ด้านล่างสุด */}
              <View style={{ marginTop: 20 }}>
                {groupInfo.is_my_leader ? (
                  <>
                    <TouchableOpacity style={styles.syncBtn} onPress={handleSyncCart}>
                      <LinearGradient colors={['#10b981', '#059669']} style={styles.syncBtnGradient}>
                        <MaterialIcons name="sync" size={24} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.syncBtnText}>Sync ตะกร้าให้ทุกคน</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={[styles.dangerBtnOutline, {marginTop: 15}]} onPress={handleDeleteGroup}>
                      <Text style={styles.dangerBtnText}>ยุบกลุ่ม (ลบทุกคน)</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.dangerBtnOutline} onPress={handleLeaveGroup}>
                    <Text style={styles.dangerBtnText}>ออกจากกลุ่ม</Text>
                  </TouchableOpacity>
                )}
              </View>
              
            </View>
          )}
          
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 15,
  },
  backButton: { width: 40, height: 40, backgroundColor: '#fff', borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f1a1c' },
  myAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#a73355' },
  content: { padding: 20, paddingBottom: 50 },
  
  noGroupContainer: { marginTop: 20 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 20, elevation: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#FDEEF4' },
  tabText: { color: '#837375', fontWeight: 'bold' },
  tabTextActive: { color: '#a73355' },
  
  actionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 2 },
  label: { fontSize: 14, color: '#514345', marginBottom: 8, fontWeight: 'bold' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 15, fontSize: 16, textAlign: 'center', letterSpacing: 2, marginBottom: 20, fontWeight: 'bold', color: '#1f1a1c' },
  primaryBtn: { backgroundColor: '#D23669', padding: 15, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  pendingContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 30, elevation: 2, marginTop: 40, alignItems: 'center' },

  groupDetailCard: { borderRadius: 16, padding: 20, elevation: 4, marginBottom: 15 },
  syncAlertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, elevation: 1, borderWidth: 1, borderColor: '#e5e7eb' },
  
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f1a1c', marginBottom: 15 },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 1 },
  memberAvatarImg: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  memberAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FDEEF4', justifyContent: 'center', alignItems: 'center' },
  memberName: { fontSize: 14, fontWeight: 'bold', color: '#1f1a1c' },
  memberId: { fontSize: 12, color: '#837375', marginTop: 2 },
  
  approveBtn: { backgroundColor: '#10b981', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { backgroundColor: '#fee2e2', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  removeMemberBtn: { backgroundColor: '#fee2e2', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  syncBtn: { borderRadius: 16, overflow: 'hidden', elevation: 3 },
  syncBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  syncBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  dangerBtnOutline: { borderWidth: 1, borderColor: '#ef4444', paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#fef2f2' },
  dangerBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 }
});