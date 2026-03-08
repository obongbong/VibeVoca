import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, useTheme, ProgressBar } from 'react-native-paper';
import { normalize } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { getVocaSets, VocaSet, getProgressSummary } from '../api/voca';

import StudyConfigModal, { StudyMode } from '../components/StudyConfigModal';

const SetSelectionScreen: React.FC<any> = ({ navigation }) => {
  const [sets, setSets] = useState<VocaSet[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, { mastered: number, total: number, rate: number }>>({});
  const [loading, setLoading] = useState(true);
  const [configVisible, setConfigVisible] = useState(false);
  const [selectedSet, setSelectedSet] = useState<VocaSet | null>(null);
  const theme = useTheme();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchSetsAndProgress();
    });
    return unsubscribe;
  }, [navigation]);

  const onSetPress = (set: VocaSet) => {
    setSelectedSet(set);
    setConfigVisible(true);
  };

  const onStartStudy = (mode: StudyMode, limit: number) => {
    if (!selectedSet) return;
    setConfigVisible(false);
    navigation.navigate('Study', { 
      setId: selectedSet.id, 
      setTitle: selectedSet.title,
      mode,
      limit
    });
  };

  const fetchSetsAndProgress = async () => {
    try {
      setLoading(true);
      const data = await getVocaSets();
      const sortedSets = data.sets.sort((a, b) => a.display_order - b.display_order);
      setSets(sortedSets);

      const newProgressMap: Record<number, { mastered: number, total: number, rate: number }> = {};
      await Promise.all(
        sortedSets.map(async (set) => {
          try {
            const summary = await getProgressSummary(set.id);
            const learned = (summary.counts.review || 0) + (summary.counts.mastered || 0);
            newProgressMap[set.id] = {
              mastered: learned,
              total: summary.total || set.word_count || 0,
              rate: summary.mastery_rate || 0
            };
          } catch (e) {
            newProgressMap[set.id] = { mastered: 0, total: set.word_count || 0, rate: 0 };
          }
        })
      );
      setProgressMap(newProgressMap);
    } catch (err) {
      console.error('Failed to fetch voca sets:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'BASIC': return '#10B981';
      case 'INTERMEDIATE': return '#F97316';
      case 'ADVANCED': return '#EF4444';
      default: return '#6366F1';
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
      >
        <Text variant="headlineMedium" style={[styles.headerTitle, { color: theme.colors.onBackground }]}>단어장 선택</Text>
        <Text variant="bodyLarge" style={styles.headerSubtitle}>학습하고 싶은 세트를 골라보세요</Text>
        
        {sets.map((set) => {
          const progress = progressMap[set.id];
          const rate = progress?.rate || 0;
          return (
            <TouchableOpacity 
              key={set.id} 
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
              onPress={() => onSetPress(set)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.titleRow}>
                  <Ionicons name="book-outline" size={normalize(24)} color={theme.colors.primary} style={{ marginRight: normalize(8) }} />
                  <Text variant="titleLarge" style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                    {set.title}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: getDifficultyColor(set.level || '') + (theme.dark ? '30' : '15') }]}>
                  <Text style={[styles.badgeText, { color: getDifficultyColor(set.level || '') }]}>
                    {set.level}
                  </Text>
                </View>
              </View>
              
              <Text variant="bodyMedium" style={[styles.description, { color: theme.dark ? '#9CA3AF' : '#6B7280' }]}>
                {set.description}
              </Text>
              
              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <Text variant="bodySmall" style={[styles.stats, { color: theme.dark ? '#9CA3AF' : '#4B5563' }]}>
                    마스터 진행률
                  </Text>
                  <Text variant="labelLarge" style={[styles.percentageText, { color: theme.colors.primary }]}>
                    {progress?.mastered || 0} / {progress?.total || set.word_count} ({Math.round(rate)}%)
                  </Text>
                </View>
                <ProgressBar progress={rate / 100} color={theme.colors.primary} style={styles.progressBar} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedSet && (
        <StudyConfigModal
          visible={configVisible}
          onClose={() => setConfigVisible(false)}
          onStart={onStartStudy}
          setTitle={selectedSet.title}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: normalize(20),
    paddingTop: normalize(10),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: normalize(28),
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: normalize(16),
    color: '#6B7280',
    marginBottom: normalize(24),
    marginTop: normalize(4),
  },
  card: {
    padding: normalize(24),
    borderRadius: normalize(24),
    marginBottom: normalize(16),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.05,
    shadowRadius: normalize(10),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(12),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTitle: {
    fontSize: normalize(20),
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
  },
  badgeText: {
    fontSize: normalize(12),
    fontWeight: 'bold',
  },
  description: {
    marginBottom: normalize(20),
    fontSize: normalize(14),
  },
  progressSection: {
    marginTop: normalize(10),
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: normalize(8),
  },
  percentageText: {
    fontWeight: 'bold',
    fontSize: normalize(14),
  },
  progressBar: {
    height: normalize(8),
    borderRadius: normalize(4),
    backgroundColor: '#E5E7EB',
  },
  stats: {
    fontSize: normalize(14),
  },
});

export default SetSelectionScreen;
