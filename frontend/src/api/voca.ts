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

export interface UserStatsResponse {
  today_studied: number;
  total_studied: number;
  mastered_count: number;
  due_count: number;
  streak: number;
  daily_stats: DailyStat[];
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

