import React from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { 
  Provider as PaperProvider, 
  MD3LightTheme, 
  MD3DarkTheme, 
  adaptNavigationTheme 
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

import LobbyScreen from './src/screens/LobbyScreen';
import StudyScreen from './src/screens/StudyScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SetSelectionScreen from './src/screens/SetSelectionScreen';
import LoginScreen from './src/screens/LoginScreen';
import { ThemeProvider, useThemeContext } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View } from 'react-native';

const { LightTheme: AdaptedLightTheme, DarkTheme: AdaptedDarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

// 네비게이션 루트 파라미터 타입 정의
export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  Study: { setId: number; setTitle: string };
  SetSelection: undefined;
};

export type TabParamList = {
  Lobby: undefined;
  Stats: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const customLightColors = {
  ...MD3LightTheme.colors,
  primary: '#6366F1',
  secondary: '#10B981',
  background: '#F8F9FA',
};

const customDarkColors = {
  ...MD3DarkTheme.colors,
  primary: '#818CF8',
  secondary: '#34D399',
  background: '#111827',
  surface: '#1F2937',
};

const lightTheme = {
  ...MD3LightTheme,
  colors: customLightColors,
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: customDarkColors,
};

const MainTabNavigator = () => {
  const { isDarkMode } = useThemeContext();
  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any = 'book';
          if (route.name === 'Lobby') iconName = focused ? 'book' : 'book-outline';
          else if (route.name === 'Stats') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: isDarkMode ? '#9CA3AF' : 'gray',
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          elevation: 5,
          backgroundColor: isDarkMode ? '#1F2937' : '#ffffff',
          borderRadius: 30,
          height: 60,
          paddingBottom: 5,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        headerTitleAlign: 'center',
        headerStyle: { 
          backgroundColor: theme.colors.background, 
          elevation: 0, 
          shadowOpacity: 0 
        },
        headerTintColor: isDarkMode ? '#F9FAFB' : '#1F2937',
      })}
    >
      <Tab.Screen name="Lobby" component={LobbyScreen} options={{ title: '학습' }} />
      <Tab.Screen name="Stats" component={ProfileScreen} options={{ title: '통계' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '설정' }} />
    </Tab.Navigator>
  );
};

const AppContent = () => {
  const { isDarkMode } = useThemeContext();
  const { token, isLoading } = useAuth();
  
  const paperTheme = isDarkMode ? darkTheme : lightTheme;
  const navigationTheme = isDarkMode ? AdaptedDarkTheme : AdaptedLightTheme;

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: paperTheme.colors.background }}>
        <ActivityIndicator size="large" color={paperTheme.colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <NavigationContainer theme={navigationTheme}>
          <Stack.Navigator>
            {token == null ? (
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false, animationTypeForReplace: 'pop' }}
              />
            ) : (
              <>
                <Stack.Screen
                  name="MainTabs"
                  component={MainTabNavigator}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="Study"
                  component={StudyScreen}
                  options={({ route }) => ({ 
                    title: route.params?.setTitle || '단어 학습', 
                    headerTitleAlign: 'center',
                    headerStyle: { backgroundColor: paperTheme.colors.background },
                    headerTintColor: isDarkMode ? '#F9FAFB' : '#1F2937',
                  })}
                />
                <Stack.Screen
                  name="SetSelection"
                  component={SetSelectionScreen}
                  options={{ 
                    title: '단어장 선택', 
                    headerTitleAlign: 'center',
                    headerStyle: { backgroundColor: paperTheme.colors.background },
                    headerTintColor: isDarkMode ? '#F9FAFB' : '#1F2937',
                  }}
                />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </GestureHandlerRootView>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
