import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, ActivityIndicator, Dimensions, Alert, Share } from 'react-native';
import { Title, Text, Card, useTheme, IconButton } from 'react-native-paper';
import { ContributionGraph, BarChart, PieChart } from 'react-native-chart-kit';
import { getUserStats, getAnalysisStats, UserStatsResponse, AnalysisResponse } from '../api/voca';

const screenWidth = Dimensions.get('window').width;

const posLabels: { [key: string]: string } = {
  n: '명사', noun: '명사',
  v: '동사', verb: '동사',
  adj: '형용사', adjective: '형용사',
  adv: '부사', adverb: '부사',
  prep: '전치사', preposition: '전치사',
  conj: '접속사', conjunction: '접속사',
  pron: '대명사', pronoun: '대명사',
  int: '감탄사', interjection: '감탄사',
};

const ProfileScreen: React.FC<any> = ({ navigation }) => {
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
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
      const [statsData, analysisData] = await Promise.all([
        getUserStats(),
        getAnalysisStats()
      ]);
      setStats(statsData);
      setAnalysis(analysisData);
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

  if (loading || !stats || !analysis) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

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
    },
  };

  // 1. 잔디심기 (Contribution Graph) 데이터
  // ContributionGraph는 { date: 'yyyy-mm-dd', count: number } 형태 배열을 받음
  const contributionData = stats.contribution_stats || [];
  // 90일 전 계산 끝나는 날짜
  const endDate = new Date();

  // 2. 품사별 정답률 데이터 (Bar Chart) - 하위 5개 표시
  const weakPos = [...analysis.pos_accuracy]
    .sort((a, b) => a.accuracy_rate - b.accuracy_rate)
    .slice(0, 5);

  const barChartData = {
    labels: weakPos.length > 0 ? weakPos.map(item => posLabels[item.pos] || item.pos) : ['데이터 없음'],
    datasets: [{
      data: weakPos.length > 0 ? weakPos.map(item => item.accuracy_rate) : [0]
    }]
  };

  // 3. 난이도별 학습 분포 (Pie Chart)
  const pieChartData = analysis.difficulty_distribution.map((item, index) => {
    const colors = ['#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE', '#E0E7FF'];
    return {
      name: `Level ${item.difficulty}`,
      population: item.count,
      color: colors[index % colors.length],
      legendFontColor: theme.dark ? '#9CA3AF' : '#4B5563',
      legendFontSize: 12,
    };
  });

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

      <Title style={[styles.chartTitle, { color: theme.colors.onBackground }]}>학습 달력 (최근 90일)</Title>
      <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface, paddingHorizontal: 0, paddingVertical: 15 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ContributionGraph
            values={contributionData}
            endDate={endDate}
            numDays={90}
            width={screenWidth + 50}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => theme.dark ? `rgba(99, 102, 241, ${opacity})` : `rgba(99, 102, 241, ${opacity})`,
            }}
            gutterSize={3}
            squareSize={14}
            style={{ borderRadius: 16 }}
            tooltipDataAttrs={(value: any) => {
              return {
                'data-tooltip': `${value.date}: ${value.count} words`
              } as any;
            }}
          />
        </ScrollView>
      </View>

      <Title style={[styles.chartTitle, { color: theme.colors.onBackground }]}>취약 품사 (정답률 분석)</Title>
      <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface, paddingTop: 20, paddingBottom: 10 }]}>
        <BarChart
          data={barChartData}
          width={screenWidth - 60}
          height={240}
          yAxisLabel=""
          yAxisSuffix="%"
          chartConfig={{
            ...chartConfig,
            formatYLabel: (yLabel) => `${Math.round(Number(yLabel))}`,
            propsForLabels: {
              fontSize: 11,
            },
            barPercentage: 0.6,
          }}
          style={{
            borderRadius: 16,
            paddingRight: 0,
          }}
          showValuesOnTopOfBars
          fromZero
        />
        <Text style={{ textAlign: 'center', marginTop: 0, color: theme.colors.onSurfaceVariant, fontSize: 13 }}>
          정답률이 가장 낮은 품사 5개를 보여줍니다.
        </Text>
      </View>

      <Title style={[styles.chartTitle, { color: theme.colors.onBackground }]}>학습 난이도 분포</Title>
      <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface, alignItems: 'center', paddingVertical: 10 }]}>
        {pieChartData.length > 0 ? (
          <PieChart
            data={pieChartData}
            width={screenWidth - 40}  // 컨테이너 폭에 여유있게 맞춤
            height={200}  // 높이를 살짝 줄이면 파이가 작아져 잘리지 않음
            chartConfig={chartConfig}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={"15"} // 왼쪽 여백 확보
            center={[10, 0]}   // 파이 그래프 중심점 미세 조정
            absolute
          />
        ) : (
          <View style={{ height: 220, justifyContent: 'center' }}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>데이터가 없습니다.</Text>
          </View>
        )}
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
