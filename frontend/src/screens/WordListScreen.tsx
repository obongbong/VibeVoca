import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Text, useTheme, FAB, Portal, Dialog, RadioButton, Button } from 'react-native-paper';
import { normalize } from '../utils/responsive';
import { getWordsByStatus, WordItemOut, WordListResponse } from '../api/voca';

const WordListScreen: React.FC<any> = ({ route, navigation }) => {
  const { status } = route.params || { status: 'all' }; // all, mastered, due
  const [words, setWords] = useState<WordItemOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [showRandomModal, setShowRandomModal] = useState(false);
  const [randomCount, setRandomCount] = useState<number>(20);
  const [studyMode, setStudyMode] = useState<'random' | 'sequential'>('random');
  const theme = useTheme();

  const getScreenTitle = () => {
    if (status === 'mastered') return '학습 완료';
    if (status === 'due') return '복습 필요';
    return '전체 단어';
  };

  const PAGE_SIZE = 50;

  useEffect(() => {
    navigation.setOptions({ title: getScreenTitle() });

    fetchWords(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, navigation]);

  const fetchWords = async (skip: number) => {
    try {
      if (skip === 0) setLoading(true);
      else setLoadingMore(true);

      const res: WordListResponse = await getWordsByStatus(status, skip, PAGE_SIZE);
      
      if (skip === 0) {
        setWords(res.items);
      } else {
        setWords(prev => [...prev, ...res.items]);
      }
      
      setTotal(res.total);
      setHasMore(skip + res.items.length < res.total);
    } catch (err) {
      console.error('Failed to fetch words by status:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchWords(words.length);
    }
  };

  const startRandomStudy = () => {
    setShowRandomModal(false);
    navigation.navigate('Study', {
      setId: 0, 
      setTitle: `${getScreenTitle()} ${studyMode === 'random' ? '셔플' : '순차'}`,
      randomStatus: status,
      limit: randomCount,
      mode: studyMode // pass study mode
    });
  };

  const renderItem = ({ item }: { item: WordItemOut }) => {
    // Determine badge color based on status
    let badgeColor = '#9CA3AF'; // new
    let badgeLabel = '새 단어';
    if (item.status === 'learning') {
      badgeColor = '#F59E0B';
      badgeLabel = '학습 중';
    } else if (item.status === 'review') {
      badgeColor = '#3B82F6';
      badgeLabel = '복습 중';
    } else if (item.status === 'mastered') {
      badgeColor = '#10B981';
      badgeLabel = '마스터';
    }

    return (
      <View style={[styles.wordCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.wordHeader}>
          <Text style={[styles.wordText, { color: theme.colors.onSurface }]}>{item.word}</Text>
          <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
          </View>
        </View>
        <Text style={[styles.meaningText, { color: theme.dark ? '#9CA3AF' : '#4B5563' }]}>{item.meaning}</Text>
      </View>
    );
  };

  if (loading && words.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.summaryContainer}>
        <Text style={[styles.summaryText, { color: theme.colors.onBackground }]}>
          총 {total}개의 단어
        </Text>
      </View>
      <FlatList
        data={words}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color={theme.colors.primary} style={styles.footerLoader} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>해당하는 단어가 없습니다.</Text>
            </View>
          ) : null
        }
      />
      
      {words.length > 0 && (
        <FAB
          icon="shuffle"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color="#ffffff"
          label="랜덤 학습"
          onPress={() => setShowRandomModal(true)}
        />
      )}

      {/* 단어 수 설정 모달 */}
      <Portal>
        <Dialog 
          visible={showRandomModal} 
          onDismiss={() => setShowRandomModal(false)}
          style={{ backgroundColor: theme.colors.surface, borderRadius: normalize(16) }}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>학습 설정</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.dark ? '#9CA3AF' : '#4B5563', marginBottom: normalize(8), fontWeight: 'bold' }}>
              학습 방식 선택
            </Text>
            <RadioButton.Group onValueChange={value => setStudyMode(value as any)} value={studyMode}>
              <View style={{ flexDirection: 'row', marginBottom: normalize(16) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: normalize(16) }}>
                  <RadioButton value="random" color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.onSurface }}>무작위</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <RadioButton value="sequential" color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.onSurface }}>순차적</Text>
                </View>
              </View>
            </RadioButton.Group>

            <Text style={{ color: theme.dark ? '#9CA3AF' : '#4B5563', marginBottom: normalize(8), fontWeight: 'bold' }}>
              단어 개수 선택
            </Text>
            <RadioButton.Group onValueChange={value => setRandomCount(Number(value))} value={randomCount.toString()}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[10, 20, 30, 40, 50].map((count) => (
                  <View key={count} style={{ flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: normalize(8) }}>
                    <RadioButton value={count.toString()} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.onSurface }}>{count}개</Text>
                  </View>
                ))}
              </View>
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRandomModal(false)} textColor={theme.dark ? '#9CA3AF' : '#4B5563'}>취소</Button>
            <Button onPress={startRandomStudy} mode="contained" buttonColor={theme.colors.primary} style={{ borderRadius: normalize(8) }}>학습 시작</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    padding: normalize(16),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  summaryText: {
    fontSize: normalize(16),
    fontWeight: 'bold',
  },
  listContent: {
    padding: normalize(16),
  },
  wordCard: {
    padding: normalize(16),
    borderRadius: normalize(12),
    marginBottom: normalize(12),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(8),
  },
  wordText: {
    fontSize: normalize(18),
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
  },
  badgeText: {
    fontSize: normalize(12),
    fontWeight: 'bold',
  },
  meaningText: {
    fontSize: normalize(16),
  },
  footerLoader: {
    marginVertical: normalize(16),
  },
  emptyContainer: {
    padding: normalize(32),
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    margin: normalize(16),
    right: 0,
    bottom: normalize(90), // FAB should be above the floating tab bar (bottom 20 + height 60)
    borderRadius: normalize(28),
    elevation: 6,
  }
});

export default WordListScreen;
