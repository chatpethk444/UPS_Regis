import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function ProfileScreen({ student, setView, onLogout }) {
  return (
    <LinearGradient
      colors={["#FFDAE4", "#FFF8F8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.3 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Top AppBar */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setView("MENU")}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#7b5455" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Student Profile</Text>
          <Text style={styles.brandLogo}>UPS</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Hero Section */}
          <View style={styles.profileHero}>
            <View style={styles.imageWrapper}>
              <LinearGradient
                colors={["rgba(210, 54, 105, 0.2)", "transparent"]}
                style={styles.imageGlow}
              />
              <View style={styles.profileImageContainer}>
                <Image
                  source={{ uri: student.avatar_url }}
                  style={styles.profileImage}
                />
              </View>
            </View>
            <Text style={styles.studentIdLabel}>
              STUDENT ID: {student?.student_id || "66040408"}
            </Text>
            <Text style={styles.studentName}>
              {student?.first_name || "พชรพล"} {student?.last_name}
            </Text>
          </View>

          {/* Academic Card */}
          <View style={styles.glassCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconBox}>
                <MaterialIcons
                  name="account-balance"
                  size={20}
                  color="#a73355"
                />
              </View>
              <View>
                <Text style={styles.label}>Faculty & Major</Text>
                <Text style={styles.valueMain}>
                  {student?.faculty || "คณะเทคโนโลยีสารสนเทศ"}
                </Text>
                <Text style={styles.valueSub}>
                  {student?.major || "สาขาวิชา วิศวกรรมคอมพิวเตอร์"}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.iconBox}>
                <MaterialIcons name="history-edu" size={20} color="#a73355" />
              </View>
              <View>
                <Text style={styles.label}>Program Details</Text>
                <Text style={styles.valueMain}>หลักสูตรตรีเช้า</Text>
                <Text
                  style={[
                    styles.valueSub,
                    { fontStyle: "italic", opacity: 0.6 },
                  ]}
                >
                  กลุ่มวิชาโท : —
                </Text>
              </View>
            </View>
          </View>

          {/* Contact Card */}
          <View style={styles.glassCard}>
            <Text style={styles.cardHeader}>UNIVERSITY CREDENTIALS</Text>

            <View style={styles.credentialRow}>
              <View style={styles.credentialLeft}>
                <MaterialIcons name="mail" size={18} color="#7b5455" />
                <View>
                  <Text style={styles.label}>Microsoft</Text>
                  <Text style={styles.emailText}>
                    patcharapol.kit@spulive.net
                  </Text>
                </View>
              </View>
              <MaterialIcons name="content-copy" size={16} color="#837375" />
            </View>

            <View style={styles.credentialRow}>
              <View style={styles.credentialLeft}>
                <MaterialIcons
                  name="alternate-email"
                  size={18}
                  color="#7b5455"
                />
                <View>
                  <Text style={styles.label}>Google</Text>
                  <Text style={styles.emailText}>
                    patcharapol.kit@spumail.net
                  </Text>
                </View>
              </View>
              <MaterialIcons name="content-copy" size={16} color="#837375" />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.editBtn}>
              <LinearGradient
                colors={["#7b5455", "#a73355"]}
                style={styles.editGradient}
              >
                <MaterialIcons name="edit" size={18} color="white" />
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
              <MaterialIcons name="logout" size={24} color="#a73355" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setView("MENU")}
          >
            <MaterialIcons name="home" size={24} color="#837375" />
            <Text style={styles.navText}>HOME</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setView("MANUAL")}
          >
            <MaterialIcons name="search" size={24} color="#837375" />
            <Text style={styles.navText}>SEARCH</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setView("CART")}
          >
            <MaterialIcons name="shopping-cart" size={24} color="#837375" />
            <Text style={styles.navText}>CART</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setView("SCHEDULE")}
          >
            <MaterialIcons name="calendar-today" size={24} color="#837375" />
            <Text style={styles.navText}>SCHEDULE</Text>
          </TouchableOpacity>
          <View style={styles.navItemActive}>
            <MaterialIcons name="person" size={24} color="#a73355" />
            <Text style={styles.navTextActive}>PROFILE</Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    height: 64,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1f1a1c" },
  brandLogo: {
    fontSize: 20,
    fontWeight: "900",
    color: "#7b5455",
    letterSpacing: -1,
  },
  scrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 },

  profileHero: { alignItems: "center", marginBottom: 32 },
  imageWrapper: {
    position: "relative",
    width: 128,
    height: 128,
    marginBottom: 16,
  },
  imageGlow: { position: "absolute", inset: 0, borderRadius: 64, opacity: 0.5 },
  profileImageContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: "white",
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  profileImage: { width: "100%", height: "100%" },
  studentIdLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#a73355",
    letterSpacing: 2,
    marginBottom: 4,
  },
  studentName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#D23669",
    letterSpacing: -0.5,
  },

  glassCard: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(214, 194, 196, 0.2)",
  },
  infoRow: { flexDirection: "row", gap: 16, marginBottom: 20 },
  iconBox: {
    backgroundColor: "rgba(123, 84, 85, 0.1)",
    padding: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#837375",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  valueMain: { fontSize: 14, fontWeight: "bold", color: "#87193e" },
  valueSub: { fontSize: 14, fontWeight: "500", color: "#514345" },

  cardHeader: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#a73355",
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(131, 115, 117, 0.1)",
    pb: 8,
    marginBottom: 16,
  },
  credentialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  credentialLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  emailText: { fontSize: 12, fontWeight: "600", color: "#87193e" },

  buttonRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  editBtn: { flex: 1, borderRadius: 12, overflow: "hidden", elevation: 4 },
  editGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  editBtnText: { color: "white", fontWeight: "bold", fontSize: 14 },
  logoutBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(167, 51, 85, 0.2)",
  },

  bottomNav: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 40,
    paddingHorizontal: 8,
    paddingVertical: 8,
    elevation: 10,
    shadowColor: "#a73355",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  navItem: { alignItems: "center", paddingHorizontal: 8 },
  navText: { fontSize: 9, fontWeight: "bold", color: "#837375", marginTop: 4 },
  navItemActive: {
    alignItems: "center",
    backgroundColor: "#f5ebed",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  navTextActive: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#a73355",
    marginTop: 4,
  },
});
