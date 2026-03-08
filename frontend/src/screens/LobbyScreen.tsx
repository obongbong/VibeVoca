import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { normalize, widthPercentage, SCREEN_DIMENSIONS } from '../utils/responsive';
import { ActivityIndicator, Text, ProgressBar, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { getUserStats, UserStatsResponse, getVocaSets, VocaSet } from '../api/voca';

const { width } = SCREEN_DIMENSIONS;

const LobbyScreen: React.FC<any> = ({ navigation }) => {
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [sets, setSets] = useState<VocaSet[]>([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, setsData] = await Promise.all([
        getUserStats(),
        getVocaSets()
      ]);
      setStats(statsData);
      setSets(setsData.sets);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const totalWords = sets.reduce((acc, s) => acc + (s.word_count || 0), 0);
  const learnedCount = stats?.mastered_count || 0;
  const progressRate = totalWords > 0 ? (learnedCount / totalWords) : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall" style={[styles.headerTitle, { color: theme.colors.onBackground }]}>학습 대시보드</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.grid}>
        <StatCard
          icon="book"
          label="전체 단어"
          value={totalWords}
          color="#A855F7"
          bgColor={theme.dark ? "#3B0764" : "#F3E8FF"}
        />
        <StatCard
          icon="checkmark-circle"
          label="학습 완료"
          value={learnedCount}
          color="#10B981"
          bgColor={theme.dark ? "#064E3B" : "#DCFCE7"}
        />
        <StatCard
          icon="trending-up"
          label="복습 필요"
          value={stats?.due_count || 0}
          color="#EF4444"
          bgColor={theme.dark ? "#450A0A" : "#FEE2E2"}
        />
        <StatCard
          icon="flame"
          label="연속 학습"
          value={`${stats?.streak || 0}일`}
          color="#F97316"
          bgColor={theme.dark ? "#431407" : "#FFEDD5"}
        />
      </View>

      {/* Progress Section */}
      <View style={{ ...styles.progressCard, backgroundColor: theme.colors.surface }}>
        <View style={styles.progressHeader}>
          <Text variant="titleMedium" style={[styles.progressLabel, { color: theme.colors.onSurface }]}>전체 진행률</Text>
          <Text variant="titleLarge" style={[styles.progressValue, { color: theme.colors.primary }]}>{(progressRate * 100).toFixed(1)}%</Text>
        </View>
        <ProgressBar progress={progressRate} color={theme.colors.primary} style={styles.progressBar} />
        <Text style={styles.progressDetail}>
          {learnedCount}개 / {totalWords}개 완료
        </Text>
      </View>

      {/* Primary Action */}
      <TouchableOpacity
        style={{ ...styles.ctaButton, backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }}
        onPress={() => {
          navigation.navigate('SetSelection');
        }}
      >
        <Text style={styles.ctaText}>오늘도 학습을 시작해보세요!</Text>
        <Text style={styles.ctaSubtext}>첫 단어부터 시작해볼까요?</Text>
      </TouchableOpacity>

      {/* Spacer for floating tab bar */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const StatCard = ({ icon, label, value, color, bgColor }: any) => {
  const theme = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={28} color={color} />
      <Text style={[styles.statLabel, { color: theme.dark ? "#9CA3AF" : "#4B5563" }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: normalize(20),
    paddingTop: normalize(40),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: normalize(24),
  },
  headerTitle: {
    fontSize: normalize(28),
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: normalize(24),
  },
  statCard: {
    width: (width - normalize(56)) / 2,
    padding: normalize(20),
    borderRadius: normalize(24),
    marginBottom: normalize(16),
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: normalize(14),
    marginTop: normalize(12),
  },
  statValue: {
    fontSize: normalize(24),
    fontWeight: 'bold',
    marginTop: normalize(4),
  },
  progressCard: {
    padding: normalize(24),
    borderRadius: normalize(24),
    marginBottom: normalize(24),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.05,
    shadowRadius: normalize(10),
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(12),
  },
  progressLabel: {
    fontSize: normalize(18),
    fontWeight: 'bold',
  },
  progressValue: {
    fontSize: normalize(24),
    fontWeight: 'bold',
  },
  progressBar: {
    height: normalize(12),
    borderRadius: normalize(6),
    backgroundColor: '#E5E7EB',
  },
  progressDetail: {
    fontSize: normalize(14),
    marginTop: normalize(12),
  },
  ctaButton: {
    paddingVertical: normalize(24),
    borderRadius: normalize(24),
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: normalize(8) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(12),
  },
  ctaText: {
    fontSize: normalize(18),
    fontWeight: 'bold',
  },
  ctaSubtext: {
    fontSize: normalize(14),
    marginTop: normalize(4),
  }
});

export default LobbyScreen;
