import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { normalize } from '../utils/responsive';
import { Text, useTheme, Button, Divider } from 'react-native-paper';
import { WordInfo } from '../api/voca';

export interface SessionStats {
  correctCount: number;
  incorrectCount: number;
  missedCountMap: Record<number, number>;
  initialIncorrectIds: Set<number>;
}

interface StudySummaryProps {
  stats: SessionStats;
  words: WordInfo[];
  duration: string;
  totalSwipes: number;
  setTitle: string;
  onRetry: () => void;
  onRetryFailed?: () => void;
  onDashboard: () => void;
}

const StudySummary: React.FC<StudySummaryProps> = ({ 
  stats, 
  words, 
  duration,
  totalSwipes,
  setTitle,
  onRetry, 
  onRetryFailed,
  onDashboard 
}) => {
  const theme = useTheme();
  
  // Current Date/Time
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')} (${['일', '월', '화', '수', '목', '금', '토'][now.getDay()]}) ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // Unique words list
  const uniqueWords = useMemo(() => {
    const map = new Map<number, WordInfo>();
    words.forEach(w => {
      if (!map.has(w.id)) map.set(w.id, w);
    });
    return Array.from(map.values());
  }, [words]);

  const studiedCount = stats.correctCount;

  // Top 3 Missed Words (Session Specific)
  const top3Missed = useMemo(() => {
    return uniqueWords
      .map(w => ({
        ...w,
        missedCount: stats.missedCountMap[w.id] || 0
      }))
      .filter(w => w.missedCount > 0) // 한 번이라도 틀린 단어들 대상
      .sort((a, b) => b.missedCount - a.missedCount)
      .slice(0, 3);
  }, [uniqueWords, stats.missedCountMap]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.dateTimeText}>{dateStr}</Text>
          <Text style={StyleSheet.flatten([styles.sessionTitle, { color: theme.colors.onBackground }])}>{setTitle}</Text>
          <Divider style={styles.topDivider} />
        </View>

        {/* Hero Stats */}
        <View style={styles.heroSection}>
          <View style={styles.mainStatContainer}>
            <Text style={StyleSheet.flatten([styles.mainStatValue, { color: theme.colors.onBackground }])}>{studiedCount}</Text>
            <Text style={styles.mainStatLabel}>공부단어수</Text>
          </View>
          
          <View style={styles.sideStatsContainer}>
            <View style={styles.sideStatItem}>
              <Text style={StyleSheet.flatten([styles.sideStatValue, { color: theme.colors.onBackground }])}>{duration}</Text>
              <Text style={styles.sideStatLabel}>소요시간</Text>
            </View>
            <View style={styles.sideStatItem}>
              <Text style={StyleSheet.flatten([styles.sideStatValue, { color: theme.colors.onBackground }])}>{totalSwipes}</Text>
              <Text style={styles.sideStatLabel}>총 스와이프</Text>
            </View>
          </View>
        </View>

        {/* Top Missed Words */}
        {top3Missed.length > 0 && (
          <View style={styles.missedSection}>
            <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.colors.onBackground }])}>자주틀린단어 TOP {top3Missed.length}</Text>
            
            {top3Missed.map((word) => (
              <View key={word.id} style={styles.missedRow}>
                <View style={styles.missedWordInfo}>
                  <Text style={StyleSheet.flatten([styles.missedWordText, { color: theme.colors.onBackground }])}>{word.word}</Text>
                  <Text style={styles.missedWordSubText}>{word.pos} / {word.meaning}</Text>
                </View>
                <Text style={StyleSheet.flatten([styles.missedCount, { color: theme.colors.onBackground }])}>{word.missedCount}회</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button 
            mode="contained" 
            onPress={onRetry}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
            icon="refresh"
          >
            한번 더 하기
          </Button>

          {stats.initialIncorrectIds.size > 0 && onRetryFailed && (
            <Button 
              mode="contained" 
              onPress={onRetryFailed}
              style={[styles.actionButton, { backgroundColor: '#EF4444', marginTop: 12 }]}
              contentStyle={styles.actionButtonContent}
              icon="alert-circle-outline"
            >
              틀린 단어만 다시 보기
            </Button>
          )}

          <Button 
            mode="outlined" 
            onPress={onDashboard}
            style={[styles.actionButton, { marginTop: 12 }]}
            contentStyle={styles.actionButtonContent}
            icon="home-outline"
          >
            대시보드로 가기
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: normalize(24),
    paddingTop: normalize(60),
    paddingBottom: normalize(80),
  },
  header: {
    marginBottom: normalize(40),
  },
  dateTimeText: {
    fontSize: normalize(14),
    color: '#6B7280',
    marginBottom: normalize(8),
  },
  sessionTitle: {
    fontSize: normalize(24),
    fontWeight: 'bold',
    marginBottom: normalize(16),
  },
  topDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  heroSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: normalize(60),
  },
  mainStatContainer: {
    flex: 1,
  },
  mainStatValue: {
    fontSize: normalize(100),
    fontWeight: '900',
    lineHeight: normalize(110),
    letterSpacing: -4,
  },
  mainStatLabel: {
    fontSize: normalize(18),
    color: '#6B7280',
    fontWeight: '500',
    marginTop: normalize(-5),
  },
  sideStatsContainer: {
    alignItems: 'flex-end',
    paddingTop: normalize(10),
  },
  sideStatItem: {
    alignItems: 'flex-end',
    marginBottom: normalize(20),
  },
  sideStatValue: {
    fontSize: normalize(28),
    fontWeight: 'bold',
  },
  sideStatLabel: {
    fontSize: normalize(14),
    color: '#6B7280',
  },
  missedSection: {
    marginBottom: normalize(40),
  },
  sectionTitle: {
    fontSize: normalize(20),
    fontWeight: 'bold',
    marginBottom: normalize(24),
  },
  missedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(24),
  },
  missedWordInfo: {
    flex: 1,
  },
  missedWordText: {
    fontSize: normalize(24),
    fontWeight: 'bold',
    marginBottom: normalize(4),
  },
  missedWordSubText: {
    fontSize: normalize(14),
    color: '#6B7280',
  },
  missedCount: {
    fontSize: normalize(20),
    fontWeight: '500',
  },
  actions: {
    marginTop: normalize(20),
  },
  actionButton: {
    borderRadius: normalize(16),
  },
  actionButtonContent: {
    height: normalize(56),
  },
});

export default StudySummary;
