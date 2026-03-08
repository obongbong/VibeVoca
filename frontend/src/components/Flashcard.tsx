import React from 'react';
import { View, StyleSheet } from 'react-native';
import { normalize, widthPercentage } from '../utils/responsive';
import { Text, useTheme } from 'react-native-paper';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming, 
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

interface FlashcardProps {
  word: string;
  meaning: string;
  phonetic: string | null;
  pos: string;
  onFlip?: (isFlipped: boolean) => void;
}

const CARD_WIDTH = widthPercentage(85);
const CARD_HEIGHT = normalize(420);

const Flashcard: React.FC<FlashcardProps> = ({ word, meaning, phonetic, pos, onFlip }) => {
  const spin = useSharedValue(0);
  const isButtonPressed = useSharedValue(false);
  const [isFlipped, setIsFlipped] = React.useState(false);
  const theme = useTheme();

  const handleFlip = () => {
    const nextState = !isFlipped;
    setIsFlipped(nextState);
    spin.value = withTiming(nextState ? 180 : 0, { duration: 300 });
    if (onFlip) {
      onFlip(nextState);
    }
  };


  const frontAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${spin.value}deg` }
      ],
      opacity: spin.value > 90 ? 0 : 1,
      zIndex: spin.value > 90 ? 0 : 1,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${spin.value + 180}deg` }
      ],
      opacity: spin.value > 90 ? 1 : 0,
      zIndex: spin.value > 90 ? 1 : 0,
    };
  });

  const speakWord = async () => {
    console.log(`[Flashcard] TTS requested: "${word}"`);
    try {
      // Visual & Haptic feedback
      buttonScale.value = withSpring(1.2, {}, () => {
        buttonScale.value = withSpring(1.0);
      });
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Ignore if haptics fail
      }

      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking) {
        await Speech.stop();
      }
      
      Speech.speak(word, { 
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onStart: () => console.log('[Flashcard] TTS started'),
        onError: (err) => console.error('[Flashcard] TTS onError:', err),
      });
    } catch (error) {
      console.error('[Flashcard] TTS Error:', error);
    }
  };

  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const flipGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (!isButtonPressed.value) {
        runOnJS(handleFlip)();
      }
    });

  const buttonGesture = Gesture.Tap()
    .onBegin(() => {
      isButtonPressed.value = true;
    })
    .onFinalize(() => {
      isButtonPressed.value = false;
    })
    .onEnd(() => {
      runOnJS(speakWord)();
    });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={flipGesture}>
        <View style={styles.gestureContainer}>
          {/* Front Side */}
          <Animated.View style={[
            styles.card, 
            frontAnimatedStyle, 
            { backgroundColor: theme.colors.surface }
          ]}>
            <View style={[styles.cardContent, { overflow: 'hidden', borderRadius: 32 }]}>
              <Text style={[styles.wordText, { color: theme.colors.primary }]}>{word}</Text>
              {phonetic && (
                <Text style={[styles.phoneticText, { color: theme.dark ? '#9CA3AF' : '#6B7280' }]}>
                  {phonetic}
                </Text>
              )}
              
              <Animated.View style={animatedButtonStyle}>
                <GestureDetector gesture={buttonGesture}>
                  <View 
                    style={[styles.audioPlaceholder, { backgroundColor: theme.dark ? '#312E81' : '#EEF2FF' }]} 
                  >
                    <Ionicons name="volume-medium-outline" size={24} color={theme.colors.primary} />
                  </View>
                </GestureDetector>
              </Animated.View>
              
              <Text style={styles.hintText}>탭하여 뜻 보기</Text>
            </View>
          </Animated.View>

          {/* Back Side */}
          <Animated.View style={[
            styles.card, 
            backAnimatedStyle, 
            { backgroundColor: theme.dark ? theme.colors.surface : '#F3F4F6' }
          ]}>
            <View style={[styles.cardContent, { overflow: 'hidden', borderRadius: 32 }]}>
              <Text style={[styles.posText, { color: theme.dark ? '#9CA3AF' : '#6B7280' }]}>[{pos}]</Text>
              <Text style={[styles.meaningText, { color: theme.colors.onSurface }]}>{meaning}</Text>
              <Text style={styles.hintText}>다시 탭하여 닫기</Text>
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  gestureContainer: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: normalize(32),
    backfaceVisibility: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: normalize(8) },
    shadowOpacity: 0.1,
    shadowRadius: normalize(15),
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: normalize(24),
  },
  wordText: {
    fontSize: normalize(44),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: normalize(20),
  },
  audioPlaceholder: {
    width: normalize(60),
    height: normalize(60),
    borderRadius: normalize(30),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(40),
    zIndex: 10,
  },
  phoneticText: {
    fontSize: normalize(20),
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: normalize(30),
  },
  hintText: {
    position: 'absolute',
    bottom: normalize(30),
    fontSize: normalize(14),
    color: '#9CA3AF',
  },
  posText: {
    fontSize: normalize(18),
    marginBottom: normalize(10),
  },
  meaningText: {
    fontSize: normalize(32),
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default Flashcard;
