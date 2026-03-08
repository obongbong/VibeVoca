import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text, useTheme, Surface, Button, IconButton, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { normalize } from '../utils/responsive';

export type StudyMode = 'default' | 'errors_only' | 'struggled';

interface StudyConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onStart: (mode: StudyMode, limit: number) => void;
  setTitle: string;
}

const StudyConfigModal: React.FC<StudyConfigModalProps> = ({ visible, onClose, onStart, setTitle }) => {
  const theme = useTheme();
  const [selectedMode, setSelectedMode] = useState<StudyMode>('default');
  const [selectedLimit, setSelectedLimit] = useState<number>(20);

  const modes = [
    {
      id: 'default' as StudyMode,
      title: '일반 학습',
      desc: '복습 주기와 진도에 맞춘 최적화 학습',
      icon: 'school-outline',
      color: theme.colors.primary
    },
    {
      id: 'errors_only' as StudyMode,
      title: '틀린 단어 집중',
      desc: '과거에 틀렸던 오답만 모아서 폭풍 학습',
      icon: 'alert-circle-outline',
      color: '#EF4444'
    },
    {
      id: 'struggled' as StudyMode,
      title: '어려운 단어 정복',
      desc: '한번이라도 틀렸거나 아직 익숙하지 않은 단어',
      icon: 'trending-down-outline',
      color: '#F97316'
    },
  ];

  const limits = [10, 20, 30, 50, 100];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Surface style={[styles.modalContainer, { backgroundColor: theme.colors.background }]} elevation={5}>
          <View style={styles.header}>
            <Text variant="titleLarge" style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
              학습 설정
            </Text>
            <IconButton icon="close" size={normalize(24)} onPress={onClose} />
          </View>

          <Text style={[styles.setTitle, { color: theme.colors.onSurfaceVariant }]}>
            {setTitle}
          </Text>
          <Divider style={styles.divider} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>학습 모드 선택</Text>
            {modes.map((mode) => (
              <TouchableOpacity
                key={mode.id}
                onPress={() => setSelectedMode(mode.id)}
                activeOpacity={0.7}
              >
                <Surface
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: theme.colors.elevation.level1,
                      borderColor: selectedMode === mode.id ? mode.color : 'transparent',
                      borderWidth: 2,
                    }
                  ]}
                  elevation={selectedMode === mode.id ? 2 : 0}
                >
                  <View style={[styles.modeIcon, { backgroundColor: mode.color + '20' }]}>
                    <Ionicons name={mode.icon as any} size={normalize(26)} color={mode.color} />
                  </View>
                  <View style={styles.modeText}>
                    <Text style={[styles.modeTitle, { color: theme.colors.onSurface }]}>{mode.title}</Text>
                    <Text style={styles.modeDesc}>{mode.desc}</Text>
                  </View>
                  {selectedMode === mode.id && (
                    <Ionicons name="checkmark-circle" size={normalize(24)} color={mode.color} />
                  )}
                </Surface>
              </TouchableOpacity>
            ))}

            <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant, marginTop: 24 }]}>단어 수 설정</Text>
            <View style={styles.limitGrid}>
              {limits.map((limit) => (
                <TouchableOpacity
                  key={limit}
                  onPress={() => setSelectedLimit(limit)}
                  style={[
                    styles.limitChip,
                    {
                      backgroundColor: selectedLimit === limit ? theme.colors.primary : theme.colors.elevation.level2,
                      borderColor: selectedLimit === limit ? theme.colors.primary : 'transparent',
                    }
                  ]}
                >
                  <Text style={[
                    styles.limitText,
                    { color: selectedLimit === limit ? '#FFFFFF' : theme.colors.onSurface }
                  ]}>
                    {limit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              mode="contained"
              style={styles.startButton}
              contentStyle={styles.startButtonContent}
              labelStyle={styles.startButtonLabel}
              onPress={() => onStart(selectedMode, selectedLimit)}
            >
              학습 시작하기
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: normalize(32),
    borderTopRightRadius: normalize(32),
    paddingTop: normalize(8),
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: normalize(16),
    paddingTop: normalize(8),
  },
  headerTitle: {
    fontSize: normalize(28),
    fontWeight: 'bold',
    marginLeft: normalize(8),
  },
  divider: {
    marginHorizontal: normalize(24),
    marginBottom: normalize(8),
    opacity: 0.5,
  },
  setTitle: {
    fontSize: normalize(24),
    paddingHorizontal: normalize(24),
    marginBottom: normalize(10),
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: normalize(24),
    paddingBottom: normalize(16),
  },
  sectionTitle: {
    fontSize: normalize(16),
    fontWeight: '900',
    marginBottom: normalize(10),
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: normalize(16),
    paddingLeft: normalize(28),
    paddingRight: normalize(16),
    borderRadius: normalize(16),
    marginBottom: normalize(10),
  },
  modeIcon: {
    width: normalize(48),
    height: normalize(48),
    borderRadius: normalize(14),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: normalize(16),
  },
  modeText: {
    flex: 1,
  },
  modeTitle: {
    fontSize: normalize(21),
    fontWeight: 'bold',
    marginBottom: normalize(2),
  },
  modeDesc: {
    fontSize: normalize(16),
    color: '#6B7280',
  },
  limitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: normalize(8),
  },
  limitChip: {
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(10),
    borderRadius: normalize(12),
    minWidth: normalize(56),
    alignItems: 'center',
    borderWidth: 1,
  },
  limitText: {
    fontSize: normalize(20),
    fontWeight: 'bold',
  },
  footer: {
    padding: normalize(20),
    paddingBottom: normalize(30),
    backgroundColor: 'transparent',
  },
  startButton: {
    borderRadius: normalize(16),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: normalize(4) },
    shadowOpacity: 0.1,
    shadowRadius: normalize(8),
  },
  startButtonContent: {
    height: normalize(62),
  },
  startButtonLabel: {
    fontSize: normalize(20),
    fontWeight: 'bold',
  },
});

export default StudyConfigModal;
