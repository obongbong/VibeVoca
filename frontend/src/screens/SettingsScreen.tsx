import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Switch, List, useTheme, Divider, Portal, Dialog, RadioButton } from 'react-native-paper';
import { normalize } from '../utils/responsive';
import { useThemeContext } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { deleteAccount } from '../api/auth';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestNotificationPermissions, scheduleDailyReminder, cancelAllReminders } from '../utils/notifications';

const SettingsScreen: React.FC = () => {
  const { isDarkMode, toggleTheme } = useThemeContext();
  const theme = useTheme();
  const { signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  // Push Notification States
  const [isReminderEnabled, setIsReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date(new Date().setHours(21, 0, 0, 0))); // Default 21:00
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('reminderEnabled');
      const timeStr = await AsyncStorage.getItem('reminderTime');
      if (enabled === 'true') {
        setIsReminderEnabled(true);
      }
      if (timeStr) {
        setReminderTime(new Date(timeStr));
      }
    } catch (e) {
      console.error('Failed to load notification settings', e);
    }
  };

  const toggleReminder = async (value: boolean) => {
    try {
      if (value) {
        const hasPermission = await requestNotificationPermissions();
        if (!hasPermission) {
          Alert.alert('알림 권한 필요', '기기 설정에서 알림 권한을 허용해주세요.');
          return;
        }
        await scheduleDailyReminder(reminderTime.getHours(), reminderTime.getMinutes());
      } else {
        await cancelAllReminders();
      }
      setIsReminderEnabled(value);
      await AsyncStorage.setItem('reminderEnabled', value.toString());
    } catch (e) {
      console.error('Failed to toggle reminder', e);
      Alert.alert('오류', '알림 설정 중 문제가 발생했습니다.');
    }
  };

  const onTimeChange = async (hourString: string) => {
    setShowTimePicker(false);
    
    // Parses hour "08", "12", "18", "21", "23" etc.
    const selectedHour = parseInt(hourString, 10);
    const newDate = new Date();
    newDate.setHours(selectedHour, 0, 0, 0);
    
    setReminderTime(newDate);
    await AsyncStorage.setItem('reminderTime', newDate.toISOString());
    
    if (isReminderEnabled) {
      // Reschedule with new time
      await scheduleDailyReminder(newDate.getHours(), newDate.getMinutes());
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '정말로 계정을 삭제하시겠습니까? 학습 데이터가 모두 삭제되며 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteAccount();
              await signOut();
            } catch (error) {
              Alert.alert('오류', '계정 삭제에 실패했습니다. 다시 시도해주세요.');
              console.error(error);
            } finally {
              setDeleting(false);
            }
          }
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>설정</Text>
        <Text style={styles.subtitle}>VibeVoca v1.0.0</Text>
      </View>

      <List.Section>
        <Text variant="labelLarge" style={[styles.subheader, { color: theme.colors.primary }]}>표시 설정</Text>
        <View style={[styles.itemCard, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="다크 모드"
            titleStyle={{ color: theme.colors.onSurface }}
            left={() => <List.Icon icon="moon-waning-crescent" color={theme.colors.primary} style={{ marginLeft: normalize(10) }} />}
            right={() => (
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                color={theme.colors.primary}
              />
            )}
          />
        </View>
      </List.Section>

      <List.Section>
        <Text variant="labelLarge" style={[styles.subheader, { color: theme.colors.primary }]}>알림 설정</Text>
        <View style={[styles.itemCard, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="데일리 학습 리마인더"
            description="매일 정해진 시간에 단어 학습 알림을 받습니다."
            titleStyle={{ color: theme.colors.onSurface }}
            left={() => <List.Icon icon="bell-ring-outline" color={theme.colors.primary} style={{ marginLeft: normalize(10) }} />}
            right={() => (
              <Switch
                value={isReminderEnabled}
                onValueChange={toggleReminder}
                color={theme.colors.primary}
              />
            )}
          />
          {isReminderEnabled && (
            <>
              <Divider />
              <List.Item
                title="알림 시간 설정"
                description={reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " (매일)"}
                titleStyle={{ color: theme.colors.onSurface }}
                left={() => <List.Icon icon="clock-outline" color={theme.colors.primary} style={{ marginLeft: normalize(10) }} />}
                onPress={() => setShowTimePicker(true)}
              />
            </>
          )}
        </View>

        <Portal>
          <Dialog visible={showTimePicker} onDismiss={() => setShowTimePicker(false)}>
            <Dialog.Title>알림 받을 시간대</Dialog.Title>
            <Dialog.Content>
              <RadioButton.Group
                onValueChange={newValue => onTimeChange(newValue)}
                value={reminderTime.getHours().toString()}
              >
                <RadioButton.Item label="아침 8시 (08:00)" value="8" />
                <RadioButton.Item label="점심 12시 (12:00)" value="12" />
                <RadioButton.Item label="저녁 6시 (18:00)" value="18" />
                <RadioButton.Item label="밤 9시 (21:00)" value="21" />
                <RadioButton.Item label="밤 11시 (23:00)" value="23" />
              </RadioButton.Group>
            </Dialog.Content>
          </Dialog>
        </Portal>
      </List.Section>

      <List.Section>
        <Text variant="labelLarge" style={[styles.subheader, { color: theme.colors.primary }]}>데이터 관리</Text>
        <View style={[styles.itemCard, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="학습 기록 초기화"
            titleStyle={{ color: theme.colors.error }}
            left={() => <List.Icon icon="trash-can-outline" color={theme.colors.error} style={{ marginLeft: normalize(10) }} />}
            onPress={() => { }}
          />
        </View>
      </List.Section>

      <List.Section>
        <Text variant="labelLarge" style={[styles.subheader, { color: theme.colors.primary }]}>계정 관리</Text>
        <View style={[styles.itemCard, { backgroundColor: theme.colors.surface }]}>
          <List.Item
            title="로그아웃"
            titleStyle={{ color: theme.colors.onSurfaceVariant }}
            left={() => <List.Icon icon="logout" color={theme.colors.onSurfaceVariant} style={{ marginLeft: normalize(10) }} />}
            onPress={signOut}
          />
          <Divider />
          <List.Item
            title="회원 탈퇴"
            titleStyle={{ color: theme.colors.error }}
            left={() => <List.Icon icon="account-remove-outline" color={theme.colors.error} style={{ marginLeft: normalize(10) }} />}
            onPress={handleDeleteAccount}
            disabled={deleting}
          />
        </View>
      </List.Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 VibeVoca Team</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: normalize(24),
    paddingTop: normalize(10),
  },
  title: {
    fontSize: normalize(28),
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#6B7280',
    marginTop: normalize(4),
  },
  subheader: {
    paddingHorizontal: normalize(16),
    paddingBottom: normalize(8),
    fontWeight: 'bold',
  },
  itemCard: {
    marginHorizontal: normalize(16),
    borderRadius: normalize(16),
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: normalize(2) },
    shadowOpacity: 0.05,
    shadowRadius: normalize(8),
  },
  footer: {
    marginTop: normalize(40),
    alignItems: 'center',
    paddingBottom: normalize(40),
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: normalize(12),
  }
});

export default SettingsScreen;
