import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  createGroupAPI,
  joinGroupAPI,
  getMyGroupAPI,
  approveMemberAPI,
  syncGroupCartAPI,
  leaveGroupAPI,
  deleteGroupAPI,
  registerGroupAllAPI,
  toggleReadyAPI,
  markSeenRegisteredAPI,
} from "../api";

const { width } = Dimensions.get("window");
const GRID_START_HOUR = 8;
const GRID_END_HOUR = 19;
const COLUMN_COUNT = GRID_END_HOUR - GRID_START_HOUR;
const ONE_HOUR_WIDTH = 25;
const DAY_COLUMN_WIDTH = 60;
const TOTAL_GRID_WIDTH = ONE_HOUR_WIDTH * COLUMN_COUNT;

const DAY_MAP = {
  Mon: "จันทร์", Tue: "อังคาร", Wed: "พุธ", Thu: "พฤหัสบดี", Fri: "ศุกร์", Sat: "เสาร์", Sun: "อาทิตย์",
  Monday: "จันทร์", Tuesday: "อังคาร", Wednesday: "พุธ", Thursday: "พฤหัสบดี", Friday: "ศุกร์",
  จันทร์: "จันทร์", อังคาร: "อังคาร", พุธ: "พุธ", พฤหัส: "พฤหัสบดี", ศุกร์: "ศุกร์", เสาร์: "เสาร์", อาทิตย์: "อาทิตย์",
};

export default function GroupSyncScreen({ student, setView }) {
  const [groupCode, setGroupCode] = useState("");
  const [mode, setMode] = useState("JOIN");
  const [loading, setLoading] = useState(false);
  const [initialFetching, setInitialFetching] = useState(true); // 🌟 แก้เรื่อง UI กระพริบตอนเข้าหน้า
  const [groupInfo, setGroupInfo] = useState(null);
  const [prevStatus, setPrevStatus] = useState(null);

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(fetchMyGroup, 5000); 
    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    setInitialFetching(true);
    await fetchMyGroup();
    setInitialFetching(false);
  };

  // Monitor for external actions (kicked, registered, etc)
  useEffect(() => {
    if (groupInfo) {
      const hasGroup = groupInfo.group !== null;
      const myMember = groupInfo.members?.find(m => String(m.student_id) === String(student.student_id));
      const currentStatus = myMember?.status;
      const currentLastAction = groupInfo.group?.last_action;
      const hasSeenAlert = myMember?.has_seen_registered_alert;

      // Detect if kicked
      if (prevStatus === "APPROVED" && (!hasGroup || !myMember)) {
        Alert.alert("แจ้งเตือน", "คุณถูกนำออกจากกลุ่มแล้ว");
      }
      setPrevStatus(currentStatus);

      // 🌟 แก้เรื่อง Alert ซ้ำ: เช็ค hasSeenAlert จาก DB
      if (currentLastAction === "REGISTERED" && !hasSeenAlert) {
        Alert.alert("สำเร็จ", "หัวหน้ากลุ่มลงทะเบียนให้ทุกคนเรียบร้อยแล้ว!", [
          { 
            text: "ไปดูตารางเรียน", 
            onPress: async () => {
              try {
                await markSeenRegisteredAPI(student.student_id);
                setView("SCHEDULE");
              } catch (e) { console.log(e); }
            } 
          }
        ]);
      }
    }
  }, [groupInfo]);

  const fetchMyGroup = async () => {
    try {
      const data = await getMyGroupAPI(student.student_id);
      
      const myMember = data.members?.find(m => String(m.student_id) === String(student.student_id));
      if (myMember && myMember.status === "PENDING") {
        setGroupInfo({ ...data, is_pending: true });
      } else {
        setGroupInfo(data);
      }
    } catch (e) {
      console.log("Fetch Group Error:", e.message);
    }
  };

  const handleCreateGroup = async () => {
    setLoading(true);
    try {
      await createGroupAPI(student.student_id);
      await fetchMyGroup();
    } catch (e) {
      Alert.alert("ข้อผิดพลาด", e.message);
    } finally {
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
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (target_id, action) => {
    if (action === "REJECT") {
      Alert.alert("ยืนยัน", "ต้องการลบสมาชิกคนนี้ใช่หรือไม่?", [
        { text: "ยกเลิก", style: "cancel" },
        { text: "ลบออก", style: "destructive", onPress: async () => {
          try {
            await approveMemberAPI(student.student_id, target_id, action);
            fetchMyGroup();
          } catch (e) { Alert.alert("Error", e.message); }
        }}
      ]);
    } else {
      try {
        await approveMemberAPI(student.student_id, target_id, action);
        fetchMyGroup();
      } catch (e) { Alert.alert("Error", e.message); }
    }
  };

  const handleSyncCart = () => {
    Alert.alert(
      "ยืนยันการ Sync รายวิชา",
      "ระบบจะคัดลอกตะกร้าของคุณไปใส่ให้เพื่อนแทน และตรวจสอบวิชาซ้ำ/ชนเวลา ยืนยันหรือไม่?",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยัน Sync",
          onPress: async () => {
            setLoading(true);
            try {
              const res = await syncGroupCartAPI(student.student_id);
              Alert.alert("สำเร็จ!", res.message || "อัปเดตวิชาให้เพื่อนทุกคนแล้ว");
              fetchMyGroup();
            } catch (e) {
              Alert.alert("ไม่สามารถ Sync ได้", e.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleRegisterGroup = () => {
    Alert.alert(
      "ยืนยันการลงทะเบียน",
      "จะทำการลงทะเบียนวิชาในตะกร้าให้ทุกคน ยืนยันหรือไม่?",
      [
        { text: "ยกเลิก", style: "cancel" },
        { 
          text: "ยืนยัน", 
          onPress: async () => {
            setLoading(true);
            try {
              // 1. เรียก API ลงทะเบียนรายวิชา
              await registerGroupAllAPI(student.student_id);
              
              // 2. เรียก API ยุบกลุ่มทันทีเมื่อลงทะเบียนเสร็จ
              await deleteGroupAPI(student.student_id);
              
              Alert.alert("สำเร็จ", "ลงทะเบียนให้ทุกคนเรียบร้อย และทำการยุบกลุ่มแล้ว!", [
                { 
                  text: "ไปดูตารางเรียน", 
                  onPress: () => setView("SCHEDULE") 
                }
              ]);
              
              // 3. อัปเดตสถานะหน้าจอ (จะทำให้กลับไปหน้าจอเริ่มต้นที่ไม่มีกลุ่ม)
              await fetchMyGroup();
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

  const formatTimeDisplay = (time) => {
    if (!time) return "";
    let str = String(time).substring(0, 5);
    return str.replace(":", ".");
  };

  const getBoxStyle = (timeInfo) => {
    if (!timeInfo) return { left: 0, width: 0 };
    const parts = timeInfo.split(" - ");
    if (parts.length < 2) return { left: 0, width: 0 };
    
    const parseTime = (t) => {
      const p = t.split(":");
      return parseInt(p[0]) + parseInt(p[1])/60;
    };
    const s = parseTime(parts[0]);
    const e = parseTime(parts[1]);
    return {
      left: (s - GRID_START_HOUR) * ONE_HOUR_WIDTH,
      width: (e - s) * ONE_HOUR_WIDTH,
    };
  };

  const hasGroup = groupInfo && groupInfo.group !== null;
  const isMyLeader = groupInfo?.is_leader;
  const isPendingApproval = groupInfo?.is_pending;
  const myMemberData = groupInfo?.members?.find(m => String(m.student_id) === String(student.student_id));
  const approvedMembers = groupInfo?.members?.filter(m => m.status === "APPROVED") || [];
  const otherMembers = approvedMembers.filter(m => m.student_id !== student.student_id);
  const allReady = otherMembers.length === 0 || otherMembers.every(m => m.is_ready);

  const lastSync = groupInfo?.group?.last_synced_at;
  const needsSync = lastSync && approvedMembers.some(m => new Date(m.joined_at) > new Date(lastSync));

  // 🌟 แก้สมาชิกกดยืนยันแล้วรายวิชาขึ้นมาเลย: ต้องรอให้หัวหน้ากด Sync ก่อน (lastSync ต้องไม่เป็น null)
  const showLeaderCart = isMyLeader || (lastSync !== null);
  const cartData = showLeaderCart ? (groupInfo?.leader_cart || []) : [];

  if (initialFetching) {
    return (
      <LinearGradient colors={["#FFDAE4", "#FFF8F8"]} style={styles.container}>
        <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#a73355" />
          <Text style={{ marginTop: 15, color: '#a73355', fontWeight: 'bold' }}>กำลังโหลดข้อมูลกลุ่ม...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#FFDAE4", "#FFF8F8"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView("MENU")} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>เพื่อนช่วยลง</Text>
          <TouchableOpacity onPress={fetchMyGroup}>
            <MaterialIcons name="refresh" size={26} color="#a73355" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {!hasGroup ? (
            <View style={styles.noGroupContainer}>
              <MaterialIcons name="groups" size={80} color="rgba(167,51,85,0.3)" style={{ alignSelf: "center", marginBottom: 20 }} />
              <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabBtn, mode === "JOIN" && styles.tabBtnActive]} onPress={() => setMode("JOIN")}>
                  <Text style={[styles.tabText, mode === "JOIN" && styles.tabTextActive]}>เข้าร่วมกลุ่ม</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, mode === "CREATE" && styles.tabBtnActive]} onPress={() => setMode("CREATE")}>
                  <Text style={[styles.tabText, mode === "CREATE" && styles.tabTextActive]}>สร้างกลุ่มใหม่</Text>
                </TouchableOpacity>
              </View>
              {mode === "JOIN" ? (
                <View style={styles.actionCard}>
                  <TextInput style={styles.input} placeholder="รหัสกลุ่ม 6 หลัก" value={groupCode} onChangeText={setGroupCode} autoCapitalize="characters" />
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleJoinGroup}>
                    <Text style={styles.primaryBtnText}>ขอเข้าร่วมกลุ่ม</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionCard}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateGroup}>
                    <Text style={styles.primaryBtnText}>สร้างกลุ่มปาร์ตี้</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : isPendingApproval ? (
            <View style={styles.pendingContainer}>
              <View style={styles.groupDetailCardPending}>
                <Text style={{ color: "#7b5455", fontSize: 12, textAlign: 'center' }}>GROUP CODE</Text>
                <Text style={{ color: "#a73355", fontSize: 32, fontWeight: "bold", letterSpacing: 2, textAlign: 'center' }}>{groupInfo.group.group_code}</Text>
              </View>
              <View style={styles.pendingCard}>
                <ActivityIndicator size="large" color="#a73355" />
                <Text style={styles.pendingTitle}>รอหัวหน้ากลุ่มอนุมัติ...</Text>
                <Text style={styles.pendingDesc}>คุณได้ส่งคำขอเข้าร่วมกลุ่มแล้ว กรุณารอให้หัวหน้ากลุ่มกดยืนยันคำขอของคุณ</Text>
                
                <TouchableOpacity 
                  style={styles.leaveBtnPending} 
                  onPress={() => {
                    Alert.alert("ยกเลิกคำขอ", "ยืนยันการยกเลิกคำขอเข้าร่วมกลุ่มหรือไม่?", [
                      { text: "ยกเลิก", style: "cancel" },
                      { text: "ยืนยัน", style: "destructive", onPress: async () => {
                        await leaveGroupAPI(student.student_id);
                        fetchMyGroup();
                      }}
                    ]);
                  }}
                >
                  <Text style={styles.leaveBtnTextPending}>ยกเลิกคำขอ</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <LinearGradient colors={["#D23669", "#a73355"]} style={styles.groupDetailCard}>
                <Text style={{ color: "#FDEEF4", fontSize: 12 }}>GROUP CODE</Text>
                <Text style={{ color: "#fff", fontSize: 32, fontWeight: "bold", letterSpacing: 2 }}>{groupInfo.group.group_code}</Text>
                {isMyLeader && <View style={styles.leaderBadge}><Text style={styles.leaderBadgeText}>LEADER</Text></View>}
              </LinearGradient>

              {needsSync && isMyLeader && (
                <View style={styles.syncWarning}><MaterialIcons name="warning" size={20} color="#f59e0b" /><Text style={styles.syncWarningText}>มีสมาชิกใหม่! กรุณา Sync ตะกร้าอีกครั้ง</Text></View>
              )}

              <Text style={styles.sectionTitle}>สมาชิก ({approvedMembers.length}/5)</Text>
              {groupInfo.members.map((m, i) => (
                <View key={i} style={styles.memberCard}>
                  {m.avatar_url ? <Image source={{ uri: m.avatar_url }} style={styles.memberAvatar} /> : <View style={styles.memberAvatarPlaceholder}><MaterialIcons name="person" size={24} color="#a73355" /></View>}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.memberName}>{m.name || m.student_id}</Text>
                    <Text style={styles.memberId}>{m.student_id}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {m.status === "APPROVED" ? (
                      m.student_id === groupInfo.group.leader_id ? <MaterialIcons name="star" size={22} color="#f59e0b" /> :
                      m.is_ready ? <MaterialIcons name="check-circle" size={22} color="#10b981" /> : <MaterialIcons name="hourglass-empty" size={22} color="#888" />
                    ) : (
                      isMyLeader && (
                        <View style={{ flexDirection: "row", gap: 5 }}>
                          <TouchableOpacity onPress={() => handleApprove(m.student_id, "REJECT")} style={styles.rejectBtn}><MaterialIcons name="close" size={18} color="#ef4444" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => handleApprove(m.student_id, "APPROVE")} style={styles.approveBtn}><MaterialIcons name="check" size={18} color="#fff" /></TouchableOpacity>
                        </View>
                      )
                    )}
                    {isMyLeader && m.status === "APPROVED" && m.student_id !== student.student_id && (
                      <TouchableOpacity onPress={() => handleApprove(m.student_id, "REJECT")} style={styles.removeBtn}><MaterialIcons name="person-remove" size={18} color="#ef4444" /></TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              <Text style={styles.sectionTitle}>ตารางเรียนกลุ่ม (จากตะกร้าหัวหน้า)</Text>
              {!showLeaderCart ? (
                <View style={styles.lockedCart}><MaterialIcons name="lock" size={40} color="#ccc" /><Text style={styles.lockedCartText}>รอหัวหน้า Sync ตะกร้า</Text></View>
              ) : (
                <View style={styles.gridOuterContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={{ width: TOTAL_GRID_WIDTH + DAY_COLUMN_WIDTH + 20 }}>
                      <View style={styles.timeHeaderRow}>
                        <View style={{ width: DAY_COLUMN_WIDTH }} />
                        {Array.from({ length: COLUMN_COUNT + 1 }, (_, i) => GRID_START_HOUR + i).map((h, i) => (
                          <Text key={h} style={[styles.timeLabel, { position: "absolute", left: i * ONE_HOUR_WIDTH + DAY_COLUMN_WIDTH - 10, width: 20, textAlign: "center" }]}>{h}</Text>
                        ))}
                      </View>
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(dayKey => (
                        <View key={dayKey} style={styles.dayRow}>
                          <View style={styles.dayLabelContainer}><Text style={styles.dayTextSmall}>{DAY_MAP[dayKey]}</Text></View>
                          <View style={[styles.gridContent, { width: TOTAL_GRID_WIDTH }]}>
                            {cartData.filter(c => c.day.includes(DAY_MAP[dayKey])).map((item, idx) => {
                              const pos = getBoxStyle(item.time_info);
                              return (
                                <View key={idx} style={[styles.courseBox, { left: pos.left + 1, width: pos.width - 2 }]}>
                                  <Text style={styles.boxCode} numberOfLines={1}>{item.course_code} ({item.section_type})</Text>
                                  <Text style={styles.boxTime} numberOfLines={1}>{formatTimeDisplay(item.time_info.split(" - ")[0])}</Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              <View style={styles.detailsList}>
                {cartData.map((item, idx) => (
                  <View key={idx} style={styles.courseCardMini}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniCode}>{item.course_code} Sec {item.section} ({item.section_type})</Text>
                      <Text style={styles.miniName} numberOfLines={1}>{item.course_name}</Text>
                      <Text style={styles.miniSeats}>ที่นั่ง: {item.enrolled_seats}/{item.max_seats} (ว่าง {item.max_seats - item.enrolled_seats})</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.footerActions}>
                {isMyLeader ? (
                  <>
                    <TouchableOpacity style={[styles.mainBtn, !allReady && { opacity: 0.5 }]} disabled={!allReady} onPress={handleRegisterGroup}>
                      <Text style={styles.btnText}>ลงทะเบียนทั้งกลุ่ม</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.syncBtn} onPress={handleSyncCart}>
                      <LinearGradient colors={["#10b981", "#059669"]} style={styles.syncGradient}><MaterialIcons name="sync" size={20} color="#fff" /><Text style={styles.syncBtnText}>Sync ตะกร้าให้ทุกคน</Text></LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dangerBtnOutline} onPress={() => { Alert.alert("ยุบกลุ่ม", "ยืนยันการลบกลุ่มหรือไม่?", [{ text: "ยกเลิก" }, { text: "ลบ", style: "destructive", onPress: async () => { await deleteGroupAPI(student.student_id); fetchMyGroup(); } }]) }}>
                      <Text style={styles.dangerBtnText}>ยุบกลุ่ม</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity 
                      style={[
                        styles.readyBtn, 
                        myMemberData?.is_ready && { backgroundColor: "#ef4444" },
                        !lastSync && { opacity: 0.5 } // ลดความชัดของปุ่มถ้าหัวหน้ายังไม่ Sync
                      ]} 
                      disabled={!lastSync} // ปิดการคลิกถ้าหัวหน้ายังไม่ Sync
                      onPress={async () => { 
                        await toggleReadyAPI(student.student_id); 
                        fetchMyGroup(); 
                      }}
                    >
                      <Text style={styles.btnText}>
                        {!lastSync 
                          ? "รอหัวหน้า Sync วิชาก่อน" 
                          : myMemberData?.is_ready 
                          ? "✕ ยกเลิกความพร้อม" 
                          : "✓ ยืนยันความพร้อม"}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.dangerBtnOutline} onPress={() => { Alert.alert("ออกจากกลุ่ม", "ยืนยันหรือไม่?", [{ text: "ยกเลิก" }, { text: "ออก", style: "destructive", onPress: async () => { await leaveGroupAPI(student.student_id); fetchMyGroup(); } }]) }}>
                      <Text style={styles.dangerBtnText}>ออกจากกลุ่ม</Text>
                    </TouchableOpacity>
                  </>
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
  header: { flexDirection: "row", justifyContent: "space-between", padding: 20, alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#7b5455" },
  backButton: { padding: 8, backgroundColor: "white", borderRadius: 12 },
  content: { padding: 20 },
  noGroupContainer: { marginTop: 40 },
  tabContainer: { flexDirection: "row", marginBottom: 20 },
  tabBtn: { flex: 1, padding: 12, alignItems: "center", borderBottomWidth: 2, borderColor: "transparent" },
  tabBtnActive: { borderColor: "#a73355" },
  tabText: { color: "#999", fontSize: 16 },
  tabTextActive: { color: "#a73355", fontWeight: "bold" },
  actionCard: { backgroundColor: "#fff", padding: 20, borderRadius: 20, elevation: 2 },
  input: { backgroundColor: "#f9f9f9", padding: 15, borderRadius: 12, marginBottom: 15, textAlign: "center", fontSize: 18, borderWidth: 1, borderColor: "#eee" },
  primaryBtn: { backgroundColor: "#a73355", padding: 15, borderRadius: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "bold" },
  groupDetailCard: { padding: 20, borderRadius: 20, marginBottom: 20 },
  leaderBadge: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
  leaderBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  syncWarning: { flexDirection: "row", backgroundColor: "#fffbeb", padding: 12, borderRadius: 12, alignItems: "center", marginBottom: 15 },
  syncWarningText: { color: "#92400e", fontSize: 12, marginLeft: 8, fontWeight: "bold" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#1f1a1c", marginBottom: 15, marginTop: 10 },
  memberCard: { backgroundColor: "#fff", padding: 12, borderRadius: 15, marginBottom: 10, flexDirection: "row", alignItems: "center", elevation: 2 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  memberAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fce7f3", justifyContent: "center", alignItems: "center" },
  memberName: { fontWeight: "bold", fontSize: 14 },
  memberId: { fontSize: 11, color: "#888" },
  rejectBtn: { backgroundColor: "#fee2e2", padding: 6, borderRadius: 10 },
  approveBtn: { backgroundColor: "#10b981", padding: 6, borderRadius: 10 },
  removeBtn: { padding: 6, marginLeft: 5 },
  lockedCart: { height: 150, backgroundColor: "#f3f4f6", borderRadius: 20, justifyContent: "center", alignItems: "center", borderStyle: "dashed", borderWidth: 2, borderColor: "#ccc" },
  lockedCartText: { color: "#9ca3af", marginTop: 10, fontWeight: "bold" },
  gridOuterContainer: { backgroundColor: "#fff", borderRadius: 15, paddingVertical: 10, marginBottom: 20, elevation: 2, borderWidth: 1, borderColor: "#eee" },
  timeHeaderRow: { flexDirection: "row", height: 25, position: "relative" },
  timeLabel: { fontSize: 8, color: "#aaa" },
  dayRow: { flexDirection: "row", height: 35, borderBottomWidth: 1, borderBottomColor: "#f9f9f9" },
  dayLabelContainer: { width: DAY_COLUMN_WIDTH, justifyContent: "center", alignItems: "center" },
  dayTextSmall: { fontSize: 8, fontWeight: "bold", color: "#837375" },
  gridContent: { position: "relative" },
  courseBox: { position: "absolute", top: 2, bottom: 2, backgroundColor: "#ffaeb5", borderRadius: 4, justifyContent: "center", alignItems: "center" },
  boxCode: { fontSize: 7, fontWeight: "bold" },
  boxTime: { fontSize: 6, color: "#666" },
  detailsList: { marginBottom: 20 },
  courseCardMini: { backgroundColor: "#fff", padding: 12, borderRadius: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#a73355", elevation: 1 },
  miniCode: { fontSize: 13, fontWeight: "bold", color: "#a73355" },
  miniName: { fontSize: 11, color: "#514345" },
  miniSeats: { fontSize: 10, fontWeight: "bold", color: "#837375", marginTop: 4 },
  footerActions: { gap: 12, marginBottom: 50 },
  mainBtn: { backgroundColor: "#a73355", padding: 16, borderRadius: 15, alignItems: "center" },
  readyBtn: { backgroundColor: "#10b981", padding: 16, borderRadius: 15, alignItems: "center" },
  syncBtn: { borderRadius: 15, overflow: "hidden" },
  syncGradient: { flexDirection: "row", padding: 16, justifyContent: "center", alignItems: "center" },
  syncBtnText: { color: "#fff", fontWeight: "bold" },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  dangerBtnOutline: { borderWidth: 1, borderColor: "#ef4444", padding: 16, borderRadius: 15, alignItems: "center" },
  dangerBtnText: { color: "#ef4444", fontWeight: "bold" },
  
  pendingContainer: { flex: 1, marginTop: 20 },
  groupDetailCardPending: { padding: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.5)', marginBottom: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: '#a73355' },
  pendingCard: { backgroundColor: "#fff", padding: 30, borderRadius: 25, alignItems: "center", elevation: 3 },
  pendingTitle: { fontSize: 18, fontWeight: "bold", color: "#a73355", marginTop: 15, marginBottom: 10 },
  pendingDesc: { fontSize: 14, color: "#837375", textAlign: "center", lineHeight: 20, marginBottom: 25 },
  leaveBtnPending: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 15, borderWidth: 1, borderColor: "#ef4444" },
  leaveBtnTextPending: { color: "#ef4444", fontWeight: "bold" },
});
