import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

/**
 * 푸시 알림 권한을 요청 (더미). 엑스포 Go 호환성을 위해 실제 권한 대신 바로 true 반환.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  return true;
}

/**
 * 시간 저장 (로컬 데이터베이스에만 저장)
 * @param hour 시간 (0-23)
 * @param minute 분 (0-59)
 */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  try {
    await AsyncStorage.setItem('fakeReminderHour', hour.toString());
    await AsyncStorage.setItem('fakeReminderMinute', minute.toString());
    console.log(`Fake Scheduled daily reminder at ${hour}:${minute}`);
  } catch (e) {
    console.error("Failed to save fake schedule", e);
  }
}

/**
 * 모든 알림 취소 (더미)
 */
export async function cancelAllReminders(): Promise<void> {
  try {
    await AsyncStorage.removeItem('fakeReminderHour');
    await AsyncStorage.removeItem('fakeReminderMinute');
    console.log('Cancelled fake scheduled notifications');
  } catch(e) {
    console.error(e);
  }
}

/**
 * (선택사항) 앱 진입 시 알림 시간이 되었는지 검사하고 Alert를 띄우는 가짜 푸시 확인 함수
 */
export async function checkAndShowFakeNotification() {
  const hour = await AsyncStorage.getItem('fakeReminderHour');
  const minute = await AsyncStorage.getItem('fakeReminderMinute');
  if (hour !== null && minute !== null) {
      const now = new Date();
      if (now.getHours() === parseInt(hour, 10)) {
         // 매시간 정각 근처라고 가정 (실제로는 더 복잡한 로직이 필요하지만 예시)
         Alert.alert("단어장 출석체크 할 시간이에요! 🚨", "하루 10분 꾸준함이 영어 실력을 만듭니다.");
      }
  }
}
