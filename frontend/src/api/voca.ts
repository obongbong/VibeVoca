import apiClient from "./client";

export interface VocaSet {
  id: number;
  title: string;
  description: string;
  level: string;
  display_order: number;
  word_count: number;
}

export interface SetListResponse {
  sets: VocaSet[];
  total_count: number;
}

export const getVocaSets = async (): Promise<SetListResponse> => {
  const response = await apiClient.get<SetListResponse>("/sets");
  return response.data;
};

export interface ReviewSubmit {
  word_id: number;
  set_id: number;
  quality: number;
  // 0~5
}

export interface ReviewResult {
  next_review_at: string;
  interval: number;
  repetition: number;
  easiness_factor: number;
}

export interface WordInfo {
  id: number;
  set_id?: number;
  word: string;
  meaning: string;
  phonetic: string | null;
  pos: string;
  difficulty: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  repetition: number;
  easiness_factor: number;
  interval: number;
  status: string;
}

export interface TodayWordsResponse {
  set_id: number;
  total_due_count: number;
  words: WordInfo[];
}

export const getTodayWords = async (setId: number, limit: number = 20, mode: string = "default"): Promise<TodayWordsResponse> => {
  const response = await apiClient.get<TodayWordsResponse>(`/sets/${setId}/today?limit=${limit}&mode=${mode}`);
  return response.data;
};

export const getStudyWordsByStatus = async (status: string, limit: number = 20, mode: string = "random"): Promise<TodayWordsResponse> => {
  const response = await apiClient.get<TodayWordsResponse>(`/sets/words/study?status=${status}&limit=${limit}&mode=${mode}`);
  return response.data;
};

export const submitReview = async (review: ReviewSubmit): Promise<ReviewResult> => {
  const response = await apiClient.post<ReviewResult>('/review', review);
  return response.data;
};

export interface ProgressSummary {
  set_id: number;
  total: number;
  counts: Record<string, number>;
  mastery_rate: number;
}

export const getProgressSummary = async (setId: number): Promise<ProgressSummary> => {
  const response = await apiClient.get<ProgressSummary>(`/sets/${setId}/progress`);
  return response.data;
};

export interface DailyStat {
  date: string;
  studied_count: number;
}

export interface ContributionStat {
  date: string;
  count: number;
}

export interface UserStatsResponse {
  today_studied: number;
  total_studied: number;
  mastered_count: number;
  due_count: number;
  streak: number;
  daily_stats: DailyStat[];
  contribution_stats: ContributionStat[];
}

export const getUserStats = async (): Promise<UserStatsResponse> => {
  const response = await apiClient.get<UserStatsResponse>(`/sets/stats`);
  return response.data;
};

export interface UndoReview {
  word_id: number;
  set_id: number;
  quality: number;
  repetition: number;
  interval: number;
  easiness_factor: number;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  status: string;
}

export const undoReview = async (undo: UndoReview): Promise<{ status: string }> => {
  const response = await apiClient.post<{ status: string }>('/review/undo', undo);
  return response.data;
};

export interface WordItemOut {
  id: number;
  word: string;
  meaning: string;
  status: string;
  next_review_at: string | null;
}

export interface WordListResponse {
  total: number;
  items: WordItemOut[];
  skip: number;
  limit: number;
}

export const getWordsByStatus = async (status: string, skip: number = 0, limit: number = 50): Promise<WordListResponse> => {
  const response = await apiClient.get<WordListResponse>(`/sets/words?status=${status}&skip=${skip}&limit=${limit}`);
  return response.data;
};

export interface PosAccuracy {
  pos: string;
  total_reviews: number;
  correct_reviews: number;
  accuracy_rate: number;
}

export interface DifficultyDistribution {
  difficulty: number;
  count: number;
}

export interface AnalysisResponse {
  pos_accuracy: PosAccuracy[];
  difficulty_distribution: DifficultyDistribution[];
}

export const getAnalysisStats = async (): Promise<AnalysisResponse> => {
  const response = await apiClient.get<AnalysisResponse>('/sets/stats/analysis');
  return response.data;
};

