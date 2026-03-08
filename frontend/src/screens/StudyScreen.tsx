import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { normalize, widthPercentage, SCREEN_DIMENSIONS } from '../utils/responsive';
import { ActivityIndicator, Text, Title, ProgressBar, useTheme, Button, IconButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { 
  GestureDetector, 
  Gesture
} from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import Flashcard from '../components/Flashcard';
import { getTodayWords, submitReview, WordInfo, getUserStats, undoReview } from '../api/voca';

const SCREEN_WIDTH = SCREEN_DIMENSIONS.width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

import StudySummary from '../components/StudySummary';

const StudyScreen: React.FC<any> = ({ route, navigation }) => {
  const { setId, setTitle, mode = 'default', limit = 20 } = route.params;
  const [words, setWords] = useState<WordInfo[]>([]);
  const [initialWordCount, setInitialWordCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const theme = useTheme();

  // Session Statistics
  const [stats, setStats] = useState({
    correctCount: 0,
    incorrectCount: 0,
    missedCountMap: {} as Record<number, number>,
    initialIncorrectIds: new Set<number>(),
  });
  const [userStreak, setUserStreak] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [totalSwipes, setTotalSwipes] = useState(0);
  const [duration, setDuration] = useState('00:00');
  const [history, setHistory] = useState<{ 
    wordId: number, 
    quality: number, 
    addedToQueue: boolean,
    prevMissedCount: number,
    prevState: {
      repetition: number,
      interval: number,
      easiness_factor: number,
      next_review_at: string | null,
      status: string
    }
  }[]>([]);

  // Swipe shared values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    navigation.setOptions({ 
      headerShadowVisible: false,
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.dark ? '#F9FAFB' : '#1F2937',
    });
    fetchWords();
  }, [setId, theme.dark, theme.colors.background, mode, limit]);

  const fetchWords = async () => {
    try {
      setLoading(true);
      const data = await getTodayWords(setId, limit, mode);
      setWords(data.words || []);
      setInitialWordCount(data.words ? data.words.length : 0);
      
      // Fetch user stats for streak
      try {
        const userStats = await getUserStats();
        setUserStreak(userStats.streak || 0);
      } catch (sErr) {
        console.error('Failed to fetch streak in StudyScreen:', sErr);
      }

      // Reset stats for new session
      setStats({
        correctCount: 0,
        incorrectCount: 0,
        missedCountMap: {},
        initialIncorrectIds: new Set(),
      });
      setIsFinished(false);
      setCurrentIndex(0);
      setStartTime(new Date());
      setTotalSwipes(0);
      setDuration('00:00');
      setHistory([]);
      translateX.value = 0;
      translateY.value = 0;
    } catch (err) {
      Alert.alert('오류', '단어를 불러오지 못했습니다.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Animation lock
  const isAnimating = useSharedValue(false);

  // ... (maintain other shared values)

  const handleReview = useCallback((quality: number) => {
    const currentWord = words[currentIndex];
    if (!currentWord) {
      isAnimating.value = false;
      return;
    }

    const isCorrect = quality >= 3;
    console.log(`[Study] Review: "${currentWord.word}" (q=${quality}, isCorrect=${isCorrect})`);

    // Update stats
    setStats(prev => {
      const newMissedCountMap = { ...prev.missedCountMap };
      const newInitialIncorrectIds = new Set(prev.initialIncorrectIds);
      
      if (!isCorrect) {
        newMissedCountMap[currentWord.id] = (newMissedCountMap[currentWord.id] || 0) + 1;
        if (!prev.initialIncorrectIds.has(currentWord.id)) {
          newInitialIncorrectIds.add(currentWord.id);
        }
      }

      return {
        ...prev,
        correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
        incorrectCount: !isCorrect ? prev.incorrectCount + 1 : prev.incorrectCount,
        missedCountMap: newMissedCountMap,
        initialIncorrectIds: newInitialIncorrectIds,
      };
    });

    // Backend sync
    submitReview({ 
      word_id: currentWord.id, 
      set_id: Number(setId),
      quality 
    }).catch(err => console.error('[Study] Submit fail:', err));
    
    // Retry queue logic
    const isAlreadyInQueue = words.slice(currentIndex + 1).some(w => w.id === currentWord.id);
    const addedToQueue = !isCorrect && !isAlreadyInQueue;

    if (addedToQueue) {
      console.log(`[Study] Adding "${currentWord.word}" to retry queue`);
      setWords(prev => [...prev, currentWord]);
    }

    // Record history for Undo
    setHistory(prev => [...prev, {
      wordId: currentWord.id,
      quality,
      addedToQueue,
      prevMissedCount: stats.missedCountMap[currentWord.id] || 0,
      prevState: {
        repetition: currentWord.repetition,
        interval: currentWord.interval,
        easiness_factor: currentWord.easiness_factor,
        next_review_at: currentWord.next_review_at,
        last_reviewed_at: currentWord.last_reviewed_at,
        status: currentWord.status
      }
    }]);

    // Move to next or finish
    const nextWordsLength = addedToQueue ? words.length + 1 : words.length;
    if (currentIndex < nextWordsLength - 1) {
      setCurrentIndex(prev => prev + 1);
      translateX.value = 0;
      translateY.value = 0;
      isAnimating.value = false;
    } else {
      console.log('[Study] Session Finished');
      if (startTime) {
        const endTime = new Date();
        const diff = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        const mins = Math.floor(diff / 60).toString().padStart(2, '0');
        const secs = (diff % 60).toString().padStart(2, '0');
        setDuration(`${mins}:${secs}`);
      }
      setIsFinished(true);
      isAnimating.value = false;
    }
  }, [words, currentIndex, setId, startTime, stats.missedCountMap, translateX, translateY, isAnimating]);

  const handleBack = useCallback(() => {
    if (currentIndex === 0 || history.length === 0 || isAnimating.value) {
      console.log('[Study] Cannot undo: at start or animating');
      return;
    }

    isAnimating.value = true;
    const lastAction = history[history.length - 1];
    console.log(`[Study] Undo: wordId=${lastAction.wordId}`);
    setHistory(prev => prev.slice(0, -1));

    // Revert Stats
    const isCorrect = lastAction.quality >= 3;
    setStats(prev => {
      const newMissedCountMap = { ...prev.missedCountMap };
      if (!isCorrect) {
        if (lastAction.prevMissedCount === 0) {
          delete newMissedCountMap[lastAction.wordId];
        } else {
          newMissedCountMap[lastAction.wordId] = lastAction.prevMissedCount;
        }
      }

      const newInitialIncorrectIds = new Set(prev.initialIncorrectIds);
      if (!isCorrect && lastAction.prevMissedCount === 0) {
        newInitialIncorrectIds.delete(lastAction.wordId);
      }

      return {
        ...prev,
        correctCount: isCorrect ? prev.correctCount - 1 : prev.correctCount,
        incorrectCount: !isCorrect ? prev.incorrectCount - 1 : prev.incorrectCount,
        missedCountMap: newMissedCountMap,
        initialIncorrectIds: newInitialIncorrectIds,
      };
    });

    // Revert retry queue
    if (lastAction.addedToQueue) {
      console.log('[Study] Removing from retry queue');
      setWords(prev => prev.slice(0, -1));
    }

    // DB Undo
    undoReview({
      word_id: lastAction.wordId,
      set_id: Number(setId),
      quality: lastAction.quality as any,
      ...lastAction.prevState
    }).catch(err => console.error('[Study] DB Undo failed:', err));

    setCurrentIndex(prev => prev - 1);
    translateX.value = 0;
    translateY.value = 0;
    
    // Small delay to allow state updates to settle before unlocking
    setTimeout(() => {
      isAnimating.value = false;
    }, 100);
  }, [currentIndex, history, setId, translateX, translateY, isAnimating]);

  const onActionPress = (quality: number) => {
    if (isAnimating.value) return;
    isAnimating.value = true;
    
    const direction = quality >= 3 ? 1 : -1;
    setTotalSwipes(prev => prev + 1);
    translateX.value = withTiming(direction * SCREEN_WIDTH * 1.5, { duration: 250 }, (finished) => {
      if (finished) {
        runOnJS(handleReview)(quality);
      }
    });
  };

  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onStart(() => {
      if (isAnimating.value) return;
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (isAnimating.value) return;
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd((event) => {
      if (isAnimating.value) return;
      
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        isAnimating.value = true;
        const quality = event.translationX > 0 ? 5 : 1;
        translateX.value = withTiming(
          event.translationX > 0 ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
          { duration: 250 },
          (finished) => {
            if (finished) {
              runOnJS(handleReview)(quality);
            }
          }
        );
        runOnJS(setTotalSwipes)((prev: number) => prev + 1);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value, 
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2], 
      [-10, 0, 10], 
      Extrapolate.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolate.CLAMP),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolate.CLAMP),
  }));

  const handleRetryFailed = () => {
    // 세션 중 틀렸던 단어들을 중복 없이 추출 (ID 기준)
    const uniqueMissedWords: WordInfo[] = [];
    const seenIds = new Set<number>();
    
    // words 배열에는 학습 과정에서 추가된 중복이 있을 수 있으므로 처음부터 끝까지 돌며 
    // initialIncorrectIds에 포함된 단어 중 처음 발견되는 것만 담음
    for (const word of words) {
      if (stats.initialIncorrectIds.has(word.id) && !seenIds.has(word.id)) {
        uniqueMissedWords.push(word);
        seenIds.add(word.id);
      }
    }

    if (uniqueMissedWords.length === 0) return;

    setWords(uniqueMissedWords);
    setInitialWordCount(uniqueMissedWords.length);
    setCurrentIndex(0);
    setIsFinished(false);
    translateX.value = 0;
    translateY.value = 0;
    setStats({
      correctCount: 0,
      incorrectCount: 0,
      missedCountMap: {},
      initialIncorrectIds: new Set<number>(),
    });
    setStartTime(new Date());
    setTotalSwipes(0);
    setDuration('00:00');
    setHistory([]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (isFinished) {
    return (
      <StudySummary 
        stats={stats} 
        words={words}
        duration={duration}
        totalSwipes={totalSwipes}
        setTitle={setTitle}
        onRetry={fetchWords}
        onRetryFailed={handleRetryFailed}
        onDashboard={() => navigation.goBack()}
      />
    );
  }

  if (words.length === 0 || currentIndex >= words.length) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Ionicons name="sparkles" size={60} color={theme.colors.primary} />
        <Title style={[styles.doneTitle, { color: theme.colors.onBackground }]}>오늘 복습할 단어가 없습니다! 🎉</Title>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: theme.colors.primary }]} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>대시보드로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentWord = words[currentIndex];
  const progress = initialWordCount > 0 ? stats.correctCount / initialWordCount : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.headerInfo}>
          <TouchableOpacity 
            onPress={handleBack}
            disabled={currentIndex === 0 || history.length === 0}
            style={[
              styles.backActionBtn, 
              { opacity: (currentIndex === 0 || history.length === 0) ? 0.3 : 1 }
            ]}
          >
            <Ionicons 
              name="arrow-undo-outline" 
              size={24} 
              color={theme.dark ? '#F9FAFB' : '#1F2937'} 
            />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: normalize(10) }}>
            <Text style={[styles.categoryTitle, { color: theme.colors.onBackground }]}>{setTitle} 학습</Text>
            <Text style={styles.progressText}>{stats.correctCount} / {initialWordCount} 단어</Text>
          </View>
          <View style={[styles.streakContainer, { backgroundColor: theme.dark ? '#431407' : '#FFF7ED' }]}>
            <Text style={styles.streakText}>{userStreak}일</Text>
            <Ionicons name="flame" size={24} color="#F97316" />
          </View>
        </View>

        <ProgressBar progress={progress} color={theme.colors.primary} style={styles.topProgressBar} />

        <View style={styles.cardContainer}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.swipeWrapper, animatedCardStyle]}>
              <Flashcard 
                key={`${currentWord.id}-${currentIndex}`}
                word={currentWord.word} 
                meaning={currentWord.meaning} 
                phonetic={currentWord.phonetic}
                pos={currentWord.pos} 
              />
              
              <Animated.View style={[styles.feedbackLabel, styles.likeLabel, likeOpacity]}>
                <Text style={[styles.feedbackText, { color: '#10B981' }]}>알고있음</Text>
              </Animated.View>
              <Animated.View style={[styles.feedbackLabel, styles.nopeLabel, nopeOpacity]}>
                <Text style={[styles.feedbackText, { color: '#EF4444' }]}>복습필요</Text>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.dark ? '#450A0A' : '#FEE2E2' }]} 
            onPress={() => onActionPress(1)}
          >
            <Ionicons name="close" size={32} color="#EF4444" />
          </TouchableOpacity>
          
          <View style={styles.hintCenter}>
            <Text style={styles.actionHint}>← 복습 필요 | 알고 있음 →</Text>
            {currentWord.status === 'new' && (
              <View style={[styles.newBadge, { backgroundColor: theme.dark ? '#1E1B4B' : '#EEF2FF' }]}>
                <Text style={[styles.newBadgeText, { color: theme.colors.primary }]}>신규 단어</Text>
              </View>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.dark ? '#064E3B' : '#DCFCE7' }]} 
            onPress={() => onActionPress(5)}
          >
            <Ionicons name="checkmark" size={32} color="#10B981" />
          </TouchableOpacity>
        </View>
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
    padding: normalize(20),
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: normalize(24),
    paddingTop: normalize(10),
    paddingBottom: normalize(20),
  },
  categoryTitle: {
    fontSize: normalize(24),
    fontWeight: 'bold',
  },
  progressText: {
    fontSize: normalize(16),
    color: '#6B7280',
    marginTop: normalize(4),
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(20),
  },
  streakText: {
    fontSize: normalize(16),
    fontWeight: 'bold',
    color: '#F97316',
    marginRight: normalize(4),
  },
  backActionBtn: {
    width: normalize(44),
    height: normalize(44),
    borderRadius: normalize(22),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  topProgressBar: {
    height: normalize(6),
    backgroundColor: '#E5E7EB',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: normalize(450),
    zIndex: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: normalize(50),
    paddingTop: normalize(20),
  },
  hintCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: normalize(80),
    height: normalize(80),
    borderRadius: normalize(40),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.1,
    shadowRadius: normalize(8),
  },
  actionHint: {
    fontSize: normalize(14),
    color: '#9CA3AF',
    marginBottom: normalize(8),
  },
  newBadge: {
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(4),
    borderRadius: normalize(8),
  },
  newBadgeText: {
    fontSize: normalize(12),
    fontWeight: 'bold',
  },
  doneTitle: {
    fontSize: normalize(22),
    fontWeight: 'bold',
    marginTop: normalize(20),
    textAlign: 'center',
  },
  backButton: {
    marginTop: normalize(30),
    paddingHorizontal: normalize(24),
    paddingVertical: normalize(12),
    borderRadius: normalize(20),
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: normalize(16),
  },
  feedbackLabel: {
    position: 'absolute',
    top: normalize(50),
    paddingHorizontal: normalize(20),
    paddingVertical: normalize(10),
    borderRadius: normalize(10),
    borderWidth: 4,
    zIndex: 100,
    elevation: 10,
  },
  likeLabel: {
    right: normalize(30),
    borderColor: '#10B981',
    transform: [{ rotate: '15deg' }],
  },
  nopeLabel: {
    left: normalize(30),
    borderColor: '#EF4444',
    transform: [{ rotate: '-15deg' }],
  },
  feedbackText: {
    fontSize: normalize(32),
    fontWeight: 'bold',
  },
  swipeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  }
});

export default StudyScreen;
