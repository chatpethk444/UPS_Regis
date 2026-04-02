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
} from "../api";

export default function GroupSyncScreen({ student, setView }) {
  const [groupCode, setGroupCode] = useState("");
  const [mode, setMode] = useState("JOIN");
  const [loading, setLoading] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);

  useEffect(() => {
    fetchMyGroup();
    let syncTimeout;

    const channel = supabase
      .channel("group-sync-room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "study_group" },
        () => {
          clearTimeout(syncTimeout);
          syncTimeout = setTimeout(fetchMyGroup, 1000);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_member" },
        () => {
          clearTimeout(syncTimeout);
          syncTimeout = setTimeout(fetchMyGroup, 1000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(syncTimeout);
    };
  }, []);

  const fetchMyGroup = async () => {
    try {
      const data = await getMyGroupAPI(student.student_id);
      setGroupInfo(data);
    } catch (e) {
      console.log("Fetch Group Error:", e.message);
    }
  };

  const handleCreateGroup = async () => {
    setLoading(true);
    try {
      await createGroupAPI(student.student_id);
      setTimeout(async () => {
        await fetchMyGroup();
        setLoading(false);
      }, 1000);
    } catch (e) {
      Alert.alert("ข้อผิดพลาด", e.message);
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!groupCode.trim())
      return Alert.alert("แจ้งเตือน", "กรุณากรอกรหัสกลุ่ม");
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
    try {
      await approveMemberAPI(student.student_id, target_id, action);
      if (action === "REJECT") Alert.alert("สำเร็จ", "นำสมาชิกออกจากกลุ่มแล้ว");
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
              Alert.alert(
                "สำเร็จ!",
                "อัปเดตวิชาในตะกร้าให้เพื่อนทุกคนเรียบร้อย",
              );
              fetchMyGroup();
            } catch (e) {
              Alert.alert("ข้อผิดพลาด", e.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert("ยืนยัน", "คุณต้องการออกจากกลุ่มใช่หรือไม่?", [
      { text: "ยกเลิก" },
      {
        text: "ออกจากกลุ่ม",
        onPress: async () => {
          setLoading(true);
          try {
            await leaveGroupAPI(student.student_id);
            fetchMyGroup();
          } catch (e) {
            Alert.alert("Error", e.message);
          } finally {
            setLoading(false);
          }
        },
        style: "destructive",
      },
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      "ยุบกลุ่มปาร์ตี้",
      "คุณแน่ใจหรือไม่ว่าจะยุบกลุ่มนี้? สมาชิกทุกคนจะถูกลบออก",
      [
        { text: "ยกเลิก" },
        {
          text: "ยุบกลุ่ม",
          onPress: async () => {
            setLoading(true);
            try {
              await deleteGroupAPI(student.student_id);
              fetchMyGroup();
            } catch (e) {
              Alert.alert("Error", e.message);
            } finally {
              setLoading(false);
            }
          },
          style: "destructive",
        },
      ],
    );
  };

  const formatSyncTime = (isoString) => {
    if (!isoString) return "ยังไม่เคย Sync";
    const date = new Date(isoString);
    return (
      date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) +
      " น."
    );
  };

  if (loading && !groupInfo) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#a73355" />
      </View>
    );
  }

  // ตัวแปรข้อมูลกลุ่ม
  const hasGroup = groupInfo && groupInfo.group !== null;
  const groupData = hasGroup ? groupInfo.group : {};
  const isMyLeader = groupInfo ? groupInfo.is_leader : false;

  // แยกสมาชิกที่อนุมัติแล้วออกจากคนที่รอ
  const allMembers = groupInfo?.members || [];
  const approvedMembers = allMembers.filter((m) => m.status === "APPROVED");

  // กรองเอาเฉพาะสมาชิกคนอื่นๆ ที่ไม่ใช่หัวหน้า และต้องได้รับการอนุมัติแล้ว
  const otherMembers = approvedMembers.filter(
    (m) => String(m.student_id) !== String(groupData.leader_id),
  );

  // เงื่อนไข: ถ้าไม่มีสมาชิกอื่นเลย (อยู่คนเดียว) หรือ ถ้ามีสมาชิกอื่นแล้วทุกคนต้องกด Ready
  const allApprovedReady =
    otherMembers.length === 0 || otherMembers.every((m) => m.is_ready);

  // ข้อมูลของตัวเอง
  const myMemberData = hasGroup
    ? allMembers.find(
        (m) => String(m.student_id) === String(student.student_id),
      )
    : null;
  const myStatus = myMemberData ? myMemberData.status : null;

  return (
    <LinearGradient
      colors={["#FFDAE4", "#FFF8F8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.3 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setView("MENU")}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>เพื่อนช่วยลง</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={fetchMyGroup}
              style={{ marginRight: 12 }}
            >
              <MaterialIcons name="refresh" size={26} color="#a73355" />
            </TouchableOpacity>
            {student?.avatar_url ? (
              <Image
                source={{ uri: student.avatar_url }}
                style={styles.myAvatar}
                resizeMode="cover"
              />
            ) : (
              <MaterialIcons name="account-circle" size={40} color="#a73355" />
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ----- กรณีที่ยังไม่มีกลุ่ม ----- */}
          {groupInfo && !hasGroup && (
            <View style={styles.noGroupContainer}>
              <MaterialIcons
                name="groups"
                size={80}
                color="rgba(167,51,85,0.3)"
                style={{ alignSelf: "center", marginBottom: 20 }}
              />
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    mode === "JOIN" && styles.tabBtnActive,
                  ]}
                  onPress={() => setMode("JOIN")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      mode === "JOIN" && styles.tabTextActive,
                    ]}
                  >
                    เข้าร่วมกลุ่ม
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    mode === "CREATE" && styles.tabBtnActive,
                  ]}
                  onPress={() => setMode("CREATE")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      mode === "CREATE" && styles.tabTextActive,
                    ]}
                  >
                    สร้างกลุ่มใหม่
                  </Text>
                </TouchableOpacity>
              </View>

              {mode === "JOIN" ? (
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
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleJoinGroup}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>ขอเข้าร่วมกลุ่ม</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionCard}>
                  <Text
                    style={[
                      styles.label,
                      { textAlign: "center", marginBottom: 20 },
                    ]}
                  >
                    สร้างกลุ่มใหม่เพื่อเป็นหัวหน้าปาร์ตี้{"\n"}
                    และจัดการรายวิชาให้เพื่อนๆ
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleCreateGroup}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>สร้างกลุ่ม</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ----- กรณีส่งคำขอและรออนุมัติ ----- */}
          {hasGroup && myStatus === "PENDING" && (
            <View style={styles.pendingContainer}>
              <MaterialIcons
                name="hourglass-empty"
                size={80}
                color="#f59e0b"
                style={{ alignSelf: "center", marginBottom: 20 }}
              />
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: "#1f1a1c",
                  textAlign: "center",
                }}
              >
                กำลังรออนุมัติ
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#514345",
                  textAlign: "center",
                  marginTop: 10,
                  marginBottom: 20,
                }}
              >
                ส่งคำขอเข้าร่วมกลุ่ม{" "}
                <Text style={{ fontWeight: "bold" }}>
                  {groupData.group_code}
                </Text>{" "}
                แล้ว
              </Text>
              <TouchableOpacity
                onPress={handleLeaveGroup}
                style={styles.dangerBtnOutline}
              >
                <Text style={styles.dangerBtnText}>ยกเลิกคำขอ</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ----- กรณีมีกลุ่มแล้ว (APPROVED) ----- */}
          {hasGroup && myStatus === "APPROVED" && (
            <View>
              <LinearGradient
                colors={["#D23669", "#a73355"]}
                style={styles.groupDetailCard}
              >
                <Text style={{ color: "#FDEEF4", fontSize: 14 }}>
                  รหัสกลุ่มของคุณ
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 5,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 32,
                      fontWeight: "bold",
                      letterSpacing: 2,
                    }}
                  >
                    {groupData.group_code}
                  </Text>
                  {isMyLeader && (
                    <View
                      style={{
                        backgroundColor: "rgba(255,255,255,0.2)",
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 20,
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      >
                        หัวหน้ากลุ่ม
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>

              {/* สถานะการ Sync ของลูกทีม */}
              {!isMyLeader && (
                <View style={styles.syncAlertBox}>
                  {groupData.last_synced_at ? (
                    <>
                      <MaterialIcons
                        name="check-circle"
                        size={24}
                        color="#10b981"
                      />
                      <Text
                        style={{
                          color: "#10b981",
                          marginLeft: 10,
                          fontWeight: "bold",
                          flex: 1,
                        }}
                      >
                        หัวหน้า Sync ตะกร้าให้แล้ว! (เวลา{" "}
                        {formatSyncTime(groupData.last_synced_at)})
                      </Text>
                    </>
                  ) : (
                    <>
                      <ActivityIndicator size="small" color="#f59e0b" />
                      <Text
                        style={{
                          color: "#f59e0b",
                          marginLeft: 10,
                          fontWeight: "bold",
                          flex: 1,
                        }}
                      >
                        กำลังรอหัวหน้า Sync ตะกร้าให้...
                      </Text>
                    </>
                  )}
                </View>
              )}

              {/* รายชื่อสมาชิก */}
              <Text style={styles.sectionTitle}>
                สมาชิก ({approvedMembers.length}/5 คน)
              </Text>

              {allMembers.map((member, idx) => {
                const isLeaderOfGroup =
                  String(member.student_id) === String(groupData.leader_id);
                return (
                  <View key={idx} style={styles.memberCard}>
                    {/* ✅ Avatar */}
                   {member.avatar_url ? (
  <Image 
    source={{ uri: member.avatar_url }} 
    style={styles.memberAvatarImg} 
    key={member.avatar_url} // ใส่ key เพื่อบังคับให้โหลดใหม่
  />
) : (
  <View style={styles.memberAvatarPlaceholder}>
    <MaterialIcons name="person" size={24} color="#a73355" />
  </View>
)}

                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={styles.memberName}>
                        {member.name || member.student_id}
                      </Text>
                      <Text style={styles.memberId}>{member.student_id}</Text>
                    </View>

                    {/* ✅ สถานะและปุ่ม Action */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {member.status === "APPROVED" ? (
                        isLeaderOfGroup ? (
                          <View style={{ alignItems: "center" }}>
                            <MaterialIcons
                              name="star"
                              size={24}
                              color="#f59e0b"
                            />
                            <Text
                              style={{
                                fontSize: 10,
                                color: "#f59e0b",
                                fontWeight: "bold",
                              }}
                            >
                              หัวหน้า
                            </Text>
                          </View>
                        ) : member.is_ready ? (
                          <View style={{ alignItems: "center" }}>
                            <MaterialIcons
                              name="check-circle"
                              size={24}
                              color="#10b981"
                            />
                            <Text
                              style={{
                                fontSize: 10,
                                color: "#10b981",
                                fontWeight: "bold",
                              }}
                            >
                              พร้อมแล้ว
                            </Text>
                          </View>
                        ) : (
                          <View style={{ alignItems: "center" }}>
                            <MaterialIcons
                              name="hourglass-empty"
                              size={24}
                              color="#888"
                            />
                            <Text
                              style={{
                                fontSize: 10,
                                color: "#888",
                                fontWeight: "bold",
                              }}
                            >
                              รอกดพร้อม
                            </Text>
                          </View>
                        )
                      ) : isMyLeader ? (
                        <View style={{ flexDirection: "row", gap: 5 }}>
                          <TouchableOpacity
                            onPress={() =>
                              handleApprove(member.student_id, "REJECT")
                            }
                            style={styles.rejectBtn}
                          >
                            <MaterialIcons
                              name="close"
                              size={20}
                              color="#ef4444"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              handleApprove(member.student_id, "APPROVE")
                            }
                            style={styles.approveBtn}
                          >
                            <MaterialIcons
                              name="check"
                              size={20}
                              color="#fff"
                            />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#f59e0b",
                            fontWeight: "bold",
                          }}
                        >
                          รออนุมัติ
                        </Text>
                      )}

                      {/* ปุ่มเตะออกสำหรับหัวหน้า */}
                      {isMyLeader &&
                        member.status === "APPROVED" &&
                        !isLeaderOfGroup && (
                          <TouchableOpacity
                            onPress={() =>
                              handleApprove(member.student_id, "REJECT")
                            }
                            style={styles.removeMemberBtn}
                          >
                            <MaterialIcons
                              name="person-remove"
                              size={20}
                              color="#ef4444"
                            />
                          </TouchableOpacity>
                        )}
                    </View>
                  </View>
                );
              })}

              {/* ตะกร้าของหัวหน้ากลุ่ม */}
              {groupInfo.leader_cart && groupInfo.leader_cart.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>ตะกร้าของหัวหน้ากลุ่ม</Text>
                  {groupInfo.leader_cart.map((item, idx) => (
                    <View key={idx} style={styles.courseCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.courseCode}>
                          {item.course_code}
                        </Text>
                        <Text style={styles.courseName}>
                          {item.course_name}
                        </Text>

                        {/* ✅ แสดงรายละเอียด Section, เวลา, และที่นั่ง */}
                        <View style={styles.badgeContainer}>
                          <View style={styles.infoBadge}>
                            <MaterialIcons
                              name="class"
                              size={12}
                              color="#a73355"
                            />
                            <Text style={styles.infoBadgeText}>
                              Sec {item.section}{" "}
                              {item.section_type
                                ? `(${item.section_type})`
                                : ""}
                            </Text>
                          </View>

                          <View style={styles.infoBadge}>
                            <MaterialIcons
                              name="schedule"
                              size={12}
                              color="#a73355"
                            />
                            <Text style={styles.infoBadgeText}>
                              {item.day || item.time_info
                                ? `${item.day || ""} ${item.time_info || ""}`.trim()
                                : "รอระบุเวลา"}
                            </Text>
                          </View>

                          <View style={styles.infoBadge}>
                            <MaterialIcons
                              name="event-seat"
                              size={12}
                              color="#a73355"
                            />
                            <Text style={styles.infoBadgeText}>
                              ที่นั่ง:{" "}
                              {item.capacity !== undefined
                                ? `${item.enrolled || 0}/${item.capacity}`
                                : "ไม่ระบุ"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* ปุ่ม Action ด้านล่างสุด */}
              <View style={{ marginTop: 20, marginBottom: 40 }}>
                {isMyLeader ? (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.mainBtn,
                        !allApprovedReady && { backgroundColor: "#ccc" },
                      ]}
                      disabled={!allApprovedReady}
                      onPress={async () => {
                        Alert.alert(
                          "ยืนยันการลงทะเบียน",
                          "ระบบจะทำการลงทะเบียนให้สมาชิกทุกคนในกลุ่ม และทำการยุบกลุ่มโดยอัตโนมัติ ยืนยันหรือไม่?",
                          [
                            { text: "ยกเลิก", style: "cancel" },
                            {
                              text: "ตกลง",
                              onPress: async () => {
                                setLoading(true);
                                try {
                                  // 1. เรียก API ลงทะเบียนให้ทุกคน
                                  await registerGroupAllAPI(student.student_id);

                                  // 2. เรียก API ลบกลุ่มทันทีหลังจากลงทะเบียนสำเร็จ
                                  await deleteGroupAPI(student.student_id);

                                  Alert.alert(
                                    "สำเร็จ",
                                    "ลงทะเบียนให้ทุกคนเรียบร้อยและยุบกลุ่มแล้ว!",
                                    [
                                      {
                                        text: "ตกลง",
                                        onPress: () => setView("SCHEDULE"),
                                      },
                                    ],
                                  );
                                } catch (e) {
                                  Alert.alert("เกิดข้อผิดพลาด", e.message);
                                } finally {
                                  setLoading(false);
                                }
                              },
                            },
                          ],
                        );
                      }}
                    >
                      <Text style={styles.btnText}>
                        ยืนยันการลงทะเบียนทั้งกลุ่ม
                      </Text>
                      {!allApprovedReady && (
                        <Text
                          style={{
                            fontSize: 11,
                            color: "red",
                            textAlign: "center",
                            marginTop: 5,
                          }}
                        >
                          *รอสมาชิกปัจจุบันในกลุ่มกดพร้อมครบทุกคน
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.syncBtn, { marginTop: 15 }]}
                      onPress={handleSyncCart}
                    >
                      <LinearGradient
                        colors={["#10b981", "#059669"]}
                        style={styles.syncBtnGradient}
                      >
                        <MaterialIcons
                          name="sync"
                          size={24}
                          color="#fff"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.syncBtnText}>
                          Sync ตะกร้าให้ทุกคน
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dangerBtnOutline, { marginTop: 15 }]}
                      onPress={handleDeleteGroup}
                    >
                      <Text style={styles.dangerBtnText}>
                        ยุบกลุ่ม (ลบทุกคน)
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* ✅ ปุ่ม Ready แบบเปลี่ยนสีตามสถานะ */}
                    <TouchableOpacity
                      style={[
                        styles.mainBtn,
                        myMemberData?.is_ready
                          ? { backgroundColor: "#ef4444" }
                          : { backgroundColor: "#10b981" },
                      ]}
                      onPress={async () => {
                        try {
                          await toggleReadyAPI(student.student_id);
                          fetchMyGroup();
                        } catch (e) {
                          Alert.alert("Error", e.message);
                        }
                      }}
                    >
                      <Text style={styles.btnText}>
                        {myMemberData?.is_ready
                          ? "✕ ยกเลิกความพร้อม"
                          : "✓ ยืนยันความพร้อม"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dangerBtnOutline, { marginTop: 15 }]}
                      onPress={handleLeaveGroup}
                    >
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  content: { padding: 20 },
  groupDetailCard: {
    backgroundColor: "#a73355",
    padding: 20,
    borderRadius: 15,
  },
  mainBtn: {
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#a73355",
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  syncBtn: { borderRadius: 10, overflow: "hidden" },
  syncBtnGradient: {
    flexDirection: "row",
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  syncBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  section: { marginTop: 25, marginBottom: 10 },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 12,
    fontSize: 16,
    color: "#1f1a1c",
  },

  memberCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  myAvatar: { width: 32, height: 32, borderRadius: 16 },
  memberAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ddd",
  },
  memberAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FDEEF4",
    alignItems: "center",
    justifyContent: "center",
  },
  memberName: { fontWeight: "bold", fontSize: 14, color: "#1f1a1c" },
  memberId: { color: "#888", fontSize: 12, marginTop: 2 },

  courseCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
  },
  courseCode: { fontSize: 14, fontWeight: "bold", color: "#a73355" },
  courseName: { fontSize: 14, color: "#514345", marginBottom: 8, marginTop: 4 },
  badgeContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDEEF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoBadgeText: {
    fontSize: 11,
    color: "#a73355",
    marginLeft: 4,
    fontWeight: "bold",
  },

  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    textAlign: "center",
    fontSize: 18,
    letterSpacing: 2,
  },
  primaryBtn: {
    backgroundColor: "#a73355",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  tabContainer: { flexDirection: "row", marginBottom: 20 },
  tabBtn: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  tabBtnActive: { borderColor: "#a73355" },
  tabText: { color: "#999", fontSize: 16 },
  tabTextActive: { color: "#a73355", fontWeight: "bold", fontSize: 16 },
  dangerBtnOutline: {
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
  },
  dangerBtnText: { color: "#ef4444", fontWeight: "bold", fontSize: 16 },
  removeMemberBtn: {
    padding: 6,
    backgroundColor: "#fee2e2",
    borderRadius: 20,
    marginLeft: 5,
  },
  rejectBtn: { padding: 8, backgroundColor: "#fee2e2", borderRadius: 20 },
  approveBtn: { padding: 8, backgroundColor: "#10b981", borderRadius: 20 },
  syncAlertBox: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
    elevation: 1,
  },
});
