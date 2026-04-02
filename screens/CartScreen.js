// screens/CartScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, SafeAreaView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ScreenHeader, CourseBadge, COLORS, sharedStyles } from "../components/shared";
import { getCartAPI, removeFromCartAPI, confirmEnrollmentAPI } from "../api";

export default function CartScreen({ student, setView }) {
  const [items, setItems]             = useState([]);
  const [loadingCart, setLoadingCart] = useState(false);

  useEffect(() => { fetchCart(); }, []);

  const fetchCart = async () => {
    setLoadingCart(true);
    try {
      const data = await getCartAPI(student.student_id);

      // ✅ จัดกลุ่มตาม course_code แต่เก็บ section แยก T/L
      // แต่ละ entry ใน cart มี section_type ต่างกัน → เก็บแยกใน array sections
      const grouped = data.reduce((acc, item) => {
        const code = item.course_code;
        if (!code) return acc;
        if (!acc[code]) {
          acc[code] = {
            course_code: code,
            course_name: item.course_name,
            credits: item.credits,
            sections: [],
          };
        }
        // เก็บแต่ละ section พร้อม type และ time_info
        const exists = acc[code].sections.find(
          (s) => s.section_number === item.section_number && s.section_type === item.section_type
        );
        if (!exists) {
          acc[code].sections.push({
            section_number: item.section_number,
            section_type: item.section_type || "T",
            time_info: item.time_info || "",
          });
        }
        return acc;
      }, {});

      setItems(Object.values(grouped));
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoadingCart(false);
    }
  };

  // นับหน่วยกิต (วิชาเดียวนับครั้งเดียว ไม่ว่าจะมีกี่ section)
  const totalCredits = items.reduce((sum, item) => {
    return sum + (parseInt(item.credits) || 3);
  }, 0);

  const removeItem = (courseCode) => {
    Alert.alert("ลบวิชา", `ต้องการลบ ${courseCode} ออกจากตะกร้าหรือไม่?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ", style: "destructive",
        onPress: async () => {
          try {
            await removeFromCartAPI(student.student_id, courseCode);
            setItems((prev) => prev.filter((i) => i.course_code !== courseCode));
          } catch (e) {
            Alert.alert("ข้อผิดพลาด", e.message);
          }
        },
      },
    ]);
  };

  const confirmRegistration = () => {
    Alert.alert("ยืนยัน", "ต้องการลงทะเบียนวิชาในตะกร้าทั้งหมดหรือไม่?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ยืนยัน",
        onPress: async () => {
          try {
            await confirmEnrollmentAPI(student.student_id);
            Alert.alert("สำเร็จ", "ลงทะเบียนเรียบร้อย!");
            setView("SCHEDULE");
          } catch (e) {
            Alert.alert("ข้อผิดพลาด", e.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={sharedStyles.container}>
      <ScreenHeader title="ตะกร้า" onBack={() => setView("MENU")} />

      {loadingCart ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Feather name="shopping-cart" size={60} color="#ccc" style={{ marginBottom: 15 }} />
          <Text style={sharedStyles.empty}>ยังไม่มีวิชาในตะกร้า</Text>
        </View>
      ) : (
        <>
          {/* สรุปหน่วยกิต */}
          <View style={{
            backgroundColor: "#EBF5FB", padding: 12,
            marginHorizontal: 15, marginTop: 10, borderRadius: 10,
            flexDirection: "row", justifyContent: "space-between",
          }}>
            <Text style={{ color: COLORS.primary, fontWeight: "bold" }}>
              รวม {items.length} วิชา
            </Text>
            <Text style={{ color: COLORS.primary, fontWeight: "bold" }}>
              ~{totalCredits} หน่วยกิต
            </Text>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.course_code}
            contentContainerStyle={{ padding: 15, paddingBottom: 120 }}
            renderItem={({ item }) => (
              <View style={sharedStyles.card}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <CourseBadge code={item.course_code} />
                    <Text style={{ fontSize: 14, fontWeight: "bold", marginTop: 8, color: "#1A1A1A" }}>
                      {item.course_name}
                    </Text>

                    {/* ✅ แสดงแต่ละ section พร้อม badge T/L */}
                    {item.sections.map((sec, idx) => {
                      const isT = sec.section_type === "T";
                      return (
                        <View key={idx} style={{ marginTop: 8, paddingTop: 8, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: "#F0F0F0" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {/* Section number */}
                            <Text style={{ fontSize: 13, color: "#555", fontWeight: "500" }}>
                              Sec {sec.section_number}
                            </Text>
                            {/* ✅ Badge T/L */}
                            <View style={{
                              paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
                              backgroundColor: isT ? "#FDEEF4" : "#E8F0FE",
                            }}>
                              <Text style={{
                                fontSize: 11, fontWeight: "bold",
                                color: isT ? "#a73355" : "#1a73e8",
                              }}>
                                {isT ? "Theory (T)" : "Lab (L)"}
                              </Text>
                            </View>
                          </View>
                          {/* เวลาเรียน */}
                          {sec.time_info ? (
                            <Text style={{ color: COLORS.primary, marginTop: 3, fontSize: 12 }}>
                              <Feather name="clock" size={11} /> {sec.time_info}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}

                    {/* แจ้งเตือนถ้าวิชามี T+L แต่ยังเลือกไม่ครบ */}
                    {item.sections.length === 1 && (
                      <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Feather name="alert-circle" size={12} color="#FF9800" />
                        <Text style={{ fontSize: 11, color: "#FF9800" }}>
                          ยังไม่ได้เลือก {item.sections[0].section_type === "T" ? "Lab (L)" : "Theory (T)"}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* ปุ่มลบ */}
                  <TouchableOpacity
                    style={{ padding: 10, backgroundColor: "#FCEBEA", borderRadius: 8, marginLeft: 8 }}
                    onPress={() => removeItem(item.course_code)}
                  >
                    <Feather name="trash-2" size={20} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          <View style={sharedStyles.bottomBar}>
            <TouchableOpacity
              style={[sharedStyles.actionButton, { backgroundColor: COLORS.success }]}
              onPress={confirmRegistration}
            >
              <Feather name="check-circle" size={20} color="#fff" />
              <Text style={sharedStyles.actionButtonText}>ยืนยันการลงทะเบียน</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}