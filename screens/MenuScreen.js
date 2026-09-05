import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NavBar } from "../components/shared";

const THEME = {
  primary: "#a73355",
  primaryDark: "#852642",
  accent: "#D23669",
  accentDark: "#a82d68",
  theoryBg: "#FDEEF4",
  cardBg: "rgba(255, 255, 255, 0.9)",
  waitlistBg: "#FFF5F7",
  waitlistBorder: "#FFD6DD",
  waitlistIconBg: "#FFEBEE",
  waitlistAccent: "#D32F2F",
  text: "#1F1A1C",
  textMid: "#514345",
  textMuted: "#837375",
  success: "#22C55E",
  shadowColor: "#A73355",
  white: "#FFFFFF",
};

function computeStudentYear(studentId) {
  if (!studentId || typeof studentId !== "string" || studentId.length < 2) return 1;
  const prefix = parseInt(studentId.substring(0, 2), 10);
  if (isNaN(prefix)) return 1;
  const currentYear = 68; // B.E. 2568
  const year = currentYear - prefix + 1;
  return year > 0 ? year : 1;
}

function ActionCard({
  icon,
  iconColor,
  iconBg,
  badge,
  badgeStyle,
  badgeTextStyle,
  title,
  description,
  actionLabel,
  actionIcon = "arrow-forward",
  onPress,
  secondaryLabel,
  onSecondaryPress,
  variant = "default",
}) {
  const isWaitlist = variant === "waitlist";
  return (
    <TouchableOpacity
      style={[styles.mainCard, isWaitlist && styles.waitlistCard]}
      activeOpacity={0.92}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${description}`}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBoxMain, iconBg && { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={22} color={iconColor || THEME.accent} />
        </View>
        {badge ? (
          <View style={[styles.badge, badgeStyle]}>
            <Text style={[styles.badgeText, badgeTextStyle]}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{description}</Text>

      <TouchableOpacity
        style={[styles.actionBtn, isWaitlist && styles.actionBtnWaitlist]}
        onPress={onPress}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.btnText}>{actionLabel}</Text>
        <MaterialIcons name={actionIcon} size={18} color="#FFFFFF" />
      </TouchableOpacity>

      {secondaryLabel && onSecondaryPress ? (
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={onSecondaryPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
        >
          <MaterialIcons name="playlist-add" size={18} color={THEME.primary} />
          <Text style={styles.secondaryActionText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

function QuickActionCard({ icon, title, description, actionLabel, onPress }) {
  return (
    <TouchableOpacity
      style={styles.subCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${actionLabel}`}
    >
      <View style={styles.iconBoxSub}>
        <MaterialIcons name={icon} size={20} color={THEME.accent} />
      </View>
      <Text style={styles.subCardTitle}>{title}</Text>
      <Text style={styles.subCardDesc}>{description}</Text>
      <View style={styles.textBtn}>
        <Text style={styles.textBtnText}>{actionLabel}</Text>
        <MaterialIcons name="chevron-right" size={16} color={THEME.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function MenuScreen({ student, setView, onBatch, onLogout }) {
  const year = computeStudentYear(student?.student_id);
  const displayName = student?.first_name || "นักศึกษา";
  const major = student?.major || "วิศวกรรมคอมพิวเตอร์";
  const semester = student?.current_semester || "2/2567";

  return (
    <LinearGradient
      colors={["#FFDAE4", "#FFF5F7", "#FFFFFF"]}
      locations={[0, 0.35, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.4 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={require("../assets/icon_UPS_BW.png")}
              style={styles.logo}
              accessibilityLabel="UPS Regis"
            />
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>UPS Regis</Text>
              <Text style={styles.headerSubtitle}>ภาคการศึกษา {semester}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => setView("WAITLIST")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="ดูรายการรอคิวและการแจ้งเตือน"
          >
            <MaterialIcons name="notifications-none" size={24} color={THEME.textMid} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Section */}
          <TouchableOpacity
            style={styles.profileSection}
            activeOpacity={0.8}
            onPress={() => setView("PROFILE")}
            accessibilityRole="button"
            accessibilityLabel={`โปรไฟล์ ${displayName}`}
          >
            <View style={styles.profileImageContainer}>
              {student?.avatar_url ? (
                <Image
                  source={{ uri: student.avatar_url }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <MaterialIcons name="person" size={32} color={THEME.primary} />
                </View>
              )}
              <View style={styles.statusDot} />
            </View>
            <View style={styles.profileTextBlock}>
              <Text style={styles.welcomeText}>สวัสดี {displayName}</Text>
              <Text style={styles.majorText}>
                {major} · ชั้นปีที่ {year}
              </Text>
            </View>
            <View style={styles.profileArrowBox}>
              <MaterialIcons name="chevron-right" size={24} color={THEME.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Primary Registration Action */}
          <ActionCard
            icon="auto-awesome"
            badge="แนะนำ"
            title="ลงทะเบียนวิชาภาคฯ ยกชุด"
            description="คัดสรรวิชาตามแผนการเรียนประจำเทอมของคุณโดยอัตโนมัติ"
            actionLabel="จัดการแผนการเรียน"
            onPress={() => setView("REGISTRATION")}
            secondaryLabel="เพิ่มวิชาบังคับลงตะกร้าทันที"
            onSecondaryPress={onBatch}
          />

          {/* Waitlist Status Action */}
          <ActionCard
            variant="waitlist"
            icon="hourglass-bottom"
            iconColor={THEME.waitlistAccent}
            iconBg={THEME.waitlistIconBg}
            badge="รอคิว"
            badgeStyle={{ backgroundColor: THEME.waitlistIconBg }}
            badgeTextStyle={{ color: THEME.waitlistAccent }}
            title="ลำดับรอคิวและสถานะ"
            description="ตรวจสอบสถานะคิววิชาที่เต็ม และรับสิทธิ์ยืนยันเมื่อมีที่นั่งว่าง"
            actionLabel="ดูรายการรอคิว"
            actionIcon="history"
            onPress={() => setView("WAITLIST")}
          />

          {/* Planning Tools Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>เครื่องมือช่วยวางแผน</Text>
          </View>

          {/* Quick Tools Grid */}
          <View style={styles.gridRow}>
            <QuickActionCard
              icon="event-note"
              title="ตารางเรียนอัตโนมัติ"
              description="จัด 2–5 แผนการเรียนที่ไม่ชนกัน"
              actionLabel="เริ่มสร้าง"
              onPress={() => setView("AI")}
            />
            <QuickActionCard
              icon="people"
              title="เพื่อนช่วยลง"
              description="ซิงค์ตารางกับเพื่อนสูงสุด 5 คน"
              actionLabel="รวมกลุ่ม"
              onPress={() => setView("GROUP_SYNC")}
            />
          </View>
        </ScrollView>

        <NavBar setView={setView} active="HOME" />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 34,
    height: 34,
  },
  headerTitleGroup: {
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 1,
    fontWeight: "500",
  },
  bellButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.accent,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 8,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  profileImageContainer: {
    position: "relative",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: THEME.white,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 29,
    borderColor: THEME.accentDark,
    borderWidth: 2,
  },
  profilePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 29,
    backgroundColor: THEME.theoryBg,
    justifyContent: "center",
    alignItems: "center",
    borderColor: THEME.accentDark,
    borderWidth: 2,
  },
  statusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    backgroundColor: THEME.success,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: THEME.white,
  },
  profileTextBlock: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.text,
    marginBottom: 2,
  },
  majorText: {
    fontSize: 13,
    fontWeight: "500",
    color: THEME.textMid,
  },
  profileArrowBox: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  mainCard: {
    backgroundColor: THEME.cardBg,
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    shadowColor: THEME.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  waitlistCard: {
    backgroundColor: THEME.waitlistBg,
    borderColor: THEME.waitlistBorder,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  iconBoxMain: {
    backgroundColor: THEME.theoryBg,
    padding: 10,
    borderRadius: 14,
  },
  badge: {
    backgroundColor: THEME.accentDark,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.white,
    letterSpacing: 0.2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: THEME.text,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: THEME.textMid,
    marginBottom: 18,
    lineHeight: 19,
  },
  actionBtn: {
    backgroundColor: THEME.accent,
    flexDirection: "row",
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
    gap: 8,
  },
  actionBtnWaitlist: {
    backgroundColor: THEME.accent,
  },
  btnText: {
    color: THEME.white,
    fontWeight: "600",
    fontSize: 14,
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  secondaryActionText: {
    color: THEME.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeader: {
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: THEME.textMid,
    letterSpacing: -0.2,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
  },
  subCard: {
    flex: 1,
    backgroundColor: THEME.cardBg,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    shadowColor: THEME.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  iconBoxSub: {
    width: 38,
    height: 38,
    backgroundColor: THEME.theoryBg,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  subCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.text,
    marginBottom: 6,
  },
  subCardDesc: {
    fontSize: 12,
    color: THEME.textMid,
    marginBottom: 14,
    lineHeight: 17,
    flex: 1,
  },
  textBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 28,
  },
  textBtnText: {
    color: THEME.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
