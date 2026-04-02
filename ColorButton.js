// ColorButton.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const ColorButton = ({ title, backgroundColor, onPress }) => {
  return (
    <TouchableOpacity 
      style={[styles.button, { backgroundColor: backgroundColor }]} // รับสีมาจาก props
      onPress={onPress}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    width: '100%',     // ให้ปุ่มกว้างเต็มจอ
    marginBottom: 10,  // เว้นระยะห่างระหว่างปุ่ม
    alignItems: 'center',
    borderRadius: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    elevation: 3,
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  }
});

export default ColorButton;