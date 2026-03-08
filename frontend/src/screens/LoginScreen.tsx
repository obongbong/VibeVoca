import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { normalize } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { mockLogin, socialLogin } from '../api/auth';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { login as kakaoLogin } from '@react-native-seoul/kakao-login';

GoogleSignin.configure({
  webClientId: '680338426556-ibh1r73mo7m4p626294kvmosscgjo5gu.apps.googleusercontent.com',
  iosClientId: '680338426556-ibh1r73mo7m4p626294kvmosscgjo5gu.apps.googleusercontent.com',
});

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  // Removed Expo AuthSession useIdTokenAuthRequest

  const handleRealSocialLogin = useCallback(async (provider: string, idToken: string) => {
    try {
      setLoading(true);
      const res = await socialLogin(provider, idToken);
      await signIn(res.access_token);
    } catch (e: any) {
      Alert.alert('로그인 실패', '백엔드 인증에 실패했습니다.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [signIn]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // ignore error if not signed in
      }
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (idToken) {
        await handleRealSocialLogin('google', idToken);
      } else {
        throw new Error('No ID token present');
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('오류', 'Play Services not available or outdated');
      } else {
        Alert.alert('구글 로그인 오류', error.message || '알 수 없는 오류가 발생했습니다.');
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoSignIn = async () => {
    try {
      setLoading(true);
      const token = await kakaoLogin();
      if (token && token.accessToken) {
        // Send Kakao access token to our backend for verification
        await handleRealSocialLogin('kakao', token.accessToken);
      } else {
        throw new Error('카카오 액세스 토큰을 받아오지 못했습니다.');
      }
    } catch (error: any) {
      if (error.code === 'E_CANCELLED_OPERATION') {
        // User cancelled login
      } else {
        Alert.alert('카카오 로그인 오류', error.message || '알 수 없는 오류가 발생했습니다.');
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Temporary mock login since setting up real OAuth requires developer portal setup
  const handleMockLogin = async (provider: string) => {
    try {
      setLoading(true);
      // We pass the provider as a nickname for mock login ease-of-use
      const res = await mockLogin(`${provider}_user`);
      await signIn(res.access_token, {
        id: "mock-id",
        nickname: `${provider}_user`,
        provider: provider
      });
    } catch (e: any) {
      Alert.alert("로그인 실패", "서버와 연결할 수 없습니다.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View entering={FadeInDown.duration(800)} style={styles.header}>
        <Ionicons name="sparkles" size={60} color={theme.colors.primary} />
        <Text variant="displaySmall" style={[styles.title, { color: theme.colors.onBackground }]}>VibeVoca</Text>
        <Text variant="bodyLarge" style={[styles.subtitle, { color: '#6B7280' }]}>나만의 단어장을 만들고 완벽하게 습득하세요</Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(1000).delay(200)} style={styles.buttonContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: '#FEE500' }]}
              onPress={handleKakaoSignIn}
              disabled={loading}
            >
              <Ionicons name="chatbubble" size={24} color="#000000" style={styles.icon} />
              <Text variant="labelLarge" style={[styles.buttonText, { color: '#000000' }]}>카카오로 시작하기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderWidth: 1 }]}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={24} color="#DB4437" style={styles.icon} />
              <Text variant="labelLarge" style={[styles.buttonText, { color: '#374151' }]}>Google로 시작하기</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: '#000000' }]}
                onPress={() => handleMockLogin('apple')}
                disabled={loading}
              >
                <Ionicons name="logo-apple" size={24} color="#FFFFFF" style={styles.icon} />
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Apple로 시작하기</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: normalize(24),
  },
  header: {
    alignItems: 'center',
    marginBottom: normalize(60),
  },
  title: {
    fontSize: normalize(42),
    fontWeight: 'bold',
    lineHeight: normalize(50),
    marginTop: normalize(16),
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: normalize(16),
    color: '#6B7280',
    marginTop: normalize(12),
  },
  buttonContainer: {
    gap: normalize(16),
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(16),
    borderRadius: normalize(12),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: normalize(2) },
    shadowOpacity: 0.1,
    shadowRadius: normalize(4),
  },
  icon: {
    position: 'absolute',
    left: normalize(20),
  },
  buttonText: {
    fontSize: normalize(16),
    fontWeight: 'bold',
  }
});
