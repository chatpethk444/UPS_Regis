// components/shared.js — Component และ Style ที่ใช้ร่วมกันทุก Screen

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  UIManager,
  LayoutAnimation,
} from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ✅ NavBar ล่าง ใช้เหมือนกันทุกหน้า (ต้นแบบจาก MenuScreen)
// active: "HOME" | "COURSES" | "CART" | "SCHEDULE" | "" (ว่าง = ไม่ไฮไลต์แท็บไหน)
export const NAV_TABS = [
  { key: "HOME", icon: "home", label: "หน้าแรก", view: "MENU" },
  { key: "COURSES", icon: "menu-book", label: "รายวิชา", view: "MANUAL" },
  { key: "CART", icon: "shopping-bag", label: "ตะกร้า", view: "CART" },
  { key: "SCHEDULE", icon: "event", label: "ตารางเรียน", view: "SCHEDULE" },
];

const NAV_THEME = {
  primary: "#a73355",
  theoryBg: "#FDEEF4",
  textMuted: "#837375",
  white: "#FFFFFF",
};

function NavTab({ item, isActive, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();
  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();

  const handlePress = () => {
    if (isActive) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={isActive ? navBarStyles.navItemActive : navBarStyles.navItem}
        onPress={handlePress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={item.label}
      >
        <MaterialIcons
          name={item.icon}
          size={22}
          color={isActive ? NAV_THEME.primary : NAV_THEME.textMuted}
        />
        <Text style={isActive ? navBarStyles.navTextActive : navBarStyles.navText}>
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function NavBar({ setView, active = "" }) {
  const mountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(mountAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 7,
    }).start();
  }, [mountAnim]);

  return (
    <View style={navBarStyles.floatingNavContainer} pointerEvents="box-none">
      <Animated.View
        style={[
          navBarStyles.floatingNav,
          {
            opacity: mountAnim,
            transform: [
              {
                translateY: mountAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [28, 0],
                }),
              },
            ],
          },
        ]}
      >
        {NAV_TABS.map((item) => (
          <NavTab
            key={item.key}
            item={item}
            isActive={item.key === active}
            onPress={() => setView(item.view)}
          />
        ))}
      </Animated.View>
    </View>
  );
}

export const navBarStyles = StyleSheet.create({
  floatingNavContainer: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
  },
  floatingNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: NAV_THEME.white,
    borderRadius: 36,
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowColor: NAV_THEME.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  navItemActive: {
    alignItems: "center",
    backgroundColor: NAV_THEME.theoryBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    minHeight: 44,
    justifyContent: "center",
  },
  navTextActive: {
    fontSize: 10,
    fontWeight: "700",
    color: NAV_THEME.primary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  navItem: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  navText: {
    fontSize: 10,
    fontWeight: "600",
    color: NAV_THEME.textMuted,
    marginTop: 2,
    letterSpacing: 0.3,
  },
});

// ✅ ScreenHeader ใช้ซ้ำได้ทุกหน้า
export function ScreenHeader({ title, onBack }) {
  return (
    <View style={sharedStyles.headerRow}>
      <TouchableOpacity onPress={onBack} style={sharedStyles.backButton}>
        <Feather name="arrow-left" size={24} color="#333" />
        <Text style={sharedStyles.backText}>กลับ</Text>
      </TouchableOpacity>
      <Text style={sharedStyles.headerTitle}>{title}</Text>
    </View>
  );
}

// ✅ MenuCard ใช้ใน MenuScreen
export function MenuCard({ title, icon, color, onPress }) {
  return (
    <TouchableOpacity
      style={[sharedStyles.menuCard, { borderLeftColor: color }]}
      onPress={onPress}
    >
      <Text style={sharedStyles.menuIcon}>{icon}</Text>
      <Text style={sharedStyles.menuTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

// ✅ Badge สำหรับแสดงรหัสวิชา
export function CourseBadge({ code }) {
  return (
    <View style={sharedStyles.badge}>
      <Text style={sharedStyles.badgeText}>{code}</Text>
    </View>
  );
}

export const COLORS = {
  primary: "#1976D2",
  success: "#28A745",
  danger: "#E74C3C",
  warning: "#FF9800",
  ai: "#00BCD4",
  purple: "#9B59B6",
  bg: "#F5F7FA",
  card: "#FFFFFF",
  border: "#E0E0E0",
  textMain: "#1A1A1A",
  textSub: "#666666",
};

export const sharedStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: COLORS.bg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: COLORS.card,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    fontSize: 16,
    marginLeft: 5,
    color: "#333",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 20,
    color: COLORS.textMain,
  },
  // Login
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 30,
    color: COLORS.textMain,
  },
  input: {
    width: "100%",
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
  },
  btnPrimary: {
    width: "100%",
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 5,
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  // Menu
  menuCard: {
    backgroundColor: COLORS.card,
    width: "47%",
    padding: 20,
    borderRadius: 12,
    margin: "1.5%",
    alignItems: "center",
    elevation: 2,
    borderLeftWidth: 4,
  },
  menuIcon: { fontSize: 30, marginBottom: 8 },
  menuTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.textMain,
    textAlign: "center",
  },
  // Badge
  badge: {
    backgroundColor: "#EEEEEE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#333",
  },
  // Empty state
  empty: {
    textAlign: "center",
    marginTop: 50,
    color: "#999",
    fontSize: 16,
  },
  // Bottom action bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flexDirection: "row",
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 8,
  },
  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  smallText: { fontSize: 12, color: COLORS.textSub },
});

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  headerWrapper: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: "#a73355",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#a73355",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  appName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f1a1c",
    marginBottom: 4,
  },
  appSubName: {
    fontSize: 12,
    color: "#a73355",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  loginTitleWrapper: {
    marginBottom: 32,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f1a1c",
    marginBottom: 8,
  },
  titleDivider: {
    width: 40,
    height: 4,
    backgroundColor: "#a73355",
    borderRadius: 2,
  },
  formContainer: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#514345",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    position: "relative",
    justifyContent: "center",
  },
  inputIconLeft: {
    position: "absolute",
    left: 16,
    zIndex: 1,
  },
  inputIconRight: {
    position: "absolute",
    right: 16,
    zIndex: 1,
    padding: 5,
  },
  input: {
    width: "100%",
    height: 56,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 16,
    paddingLeft: 48,
    paddingRight: 48,
    color: "#1f1a1c",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a73355",
  },
  loginButton: {
    width: "100%",
    height: 60,
    backgroundColor: "#a73355",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#a73355",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
});
