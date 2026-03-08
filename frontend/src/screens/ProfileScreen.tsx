import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator, Share, Alert } from 'react-native';
import { Title, Text, Card, useTheme, IconButton } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { getUserStats, UserStatsResponse } from '../api/voca';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

const ProfileScreen: React.FC<any> = ({ navigation }) => {
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchStats();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getUserStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      // 텍스트 공유 (Expo Go 호환성 최우선)
      const shareMessage = `[VibeVoca 학습 성취도]\n오늘 학습: ${stats?.today_studied}개\n마스터: ${stats?.mastered_count}개\n총 누적: ${stats?.total_studied}개\n\n오늘도 열심히 공부했어요! 🔥`;

      await Share.share({
        message: shareMessage,
        title: 'VibeVoca 성취도 공유',
      });
    } catch (error) {
      console.error('Error sharing achievement:', error);
      Alert.alert('공유 실패', '공유하는 중 오류가 발생했습니다.');
    }
  };

  if (loading || !stats) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // 차트 데이터를 위한 x축 레이블(Date)과 y축 데이터(Count) 매핑
  const labels = stats.daily_stats.map(s => {
    const parts = s.date.split('-');
    return `${parts[1]}/${parts[2]}`;
  });
  const dataPoints = stats.daily_stats.map(s => s.studied_count);

  const chartData = {
    labels: labels.length > 0 ? labels : ['No Data'],
    datasets: [
      {
        data: dataPoints.length > 0 ? dataPoints : [0],
        color: (opacity = 1) => theme.dark ? `rgba(129, 140, 248, ${opacity})` : `rgba(99, 102, 241, ${opacity})`,
        strokeWidth: 3,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => theme.dark ? `rgba(129, 140, 248, ${opacity})` : `rgba(99, 102, 241, ${opacity})`,
    labelColor: (opacity = 1) => theme.dark ? `rgba(156, 163, 175, ${opacity})` : `rgba(75, 85, 99, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: theme.colors.primary,
      fill: theme.colors.surface
    },
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <Title style={[styles.headerTitle, { color: theme.colors.onBackground }]}>학습 성취도</Title>
        <IconButton
          icon="share-variant"
          iconColor={theme.colors.primary}
          size={24}
          onPress={handleShare}
          style={styles.shareButton}
        />
      </View>

      {/* 학습 요약 영역 */}
      <View style={{ backgroundColor: theme.colors.background, padding: 10, borderRadius: 20 }}>


        <View style={styles.summaryContainer}>
          <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>오늘 학습</Text>
              <Title style={[styles.summaryValue, { color: theme.colors.primary }]}>{stats.today_studied}</Title>
            </Card.Content>
          </Card>

          <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>마스터</Text>
              <Title style={[styles.summaryValue, { color: '#10B981' }]}>{stats.mastered_count}</Title>
            </Card.Content>
          </Card>
        </View>

        <Card style={[styles.totalCard, { backgroundColor: theme.dark ? '#1E1B4B' : '#EEF2FF' }]}>
          <Card.Content style={styles.totalContent}>
            <Text style={[styles.totalLabel, { color: theme.dark ? '#94A3B8' : '#4B5563' }]}>총 누적 학습 단어: </Text>
            <Text style={[styles.totalValue, { color: theme.colors.primary }]}>{stats.total_studied}개</Text>
          </Card.Content>
        </Card>
      </View>

      <Title style={[styles.chartTitle, { color: theme.colors.onBackground }]}>최근 7일 일일 학습량</Title>
      <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}>
        <LineChart
          data={chartData}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
        />
      </View>

      {/* Spacer for floating tab bar */}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 20,
    paddingTop: 30,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1F2937',
  },
  shareButton: {
    position: 'absolute',
    right: -10,
  },
  shareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    gap: 8,
  },
  shareBrand: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    flex: 0.48,
    borderRadius: 24,
    backgroundColor: '#fff',
    elevation: 2,
  },
  summaryContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  totalCard: {
    marginBottom: 24,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    elevation: 0,
  },
  totalContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    color: '#4B5563',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginLeft: 4,
    color: '#1F2937',
  },
  chartContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 24,
  },
});

export default ProfileScreen;
