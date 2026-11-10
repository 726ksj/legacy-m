import { supabase } from "./supabase";

export interface WrongNote {
  word_id: string;
  word: string;
  meaning: string;
  example: string | null;
  vocab_set_id: string;
  set_title: string;
  week: number | null;
  wrong_count: number;
  // 마스터 칸(0~2). 서로 다른 날 연속 2번 맞히면 마스터한다.
  streak: number;
  status: "active" | "graduated";
  // 마스터 후 다시 틀려 돌아온 횟수.
  return_count: number;
  last_wrong_at: string;
  graduated_at: string | null;
}

export interface ReviewQuestion {
  position: number;
  word: string;
  choices: string[];
  selected_index: number | null;
  is_correct: boolean | null;
  correct_index: number | null;
  example: string | null;
  graduated: boolean;
  streak: number;
  wrong_count: number;
}

export interface ReviewSession {
  id: string;
  status: "in_progress" | "completed";
  week: number | null;
  total_count: number;
  correct_count: number | null;
  remaining_before: number;
  remaining_after: number | null;
  questions: ReviewQuestion[];
}

export interface ReviewAnswer {
  is_correct: boolean;
  correct_index: number;
  graduated: boolean;
  streak: number;
  finished: boolean;
}

export const GRADUATION_STEPS = 2;
export const MAX_REVIEW_QUESTIONS = 30;

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const listWrongNotes = () => rpc<WrongNote[]>("list_wrong_notes");

export const startReviewSession = (week: number | null) =>
  rpc<string>("start_wrong_note_session", { p_week: week });

export const getReviewSession = (sessionId: string) =>
  rpc<ReviewSession>("get_wrong_note_session", { p_session_id: sessionId });

export const answerReviewQuestion = (sessionId: string, position: number, selectedIndex: number) =>
  rpc<ReviewAnswer>("answer_wrong_note_question", {
    p_session_id: sessionId,
    p_position: position,
    p_selected_index: selectedIndex,
  });

export function friendlyReviewError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("no wrong notes")) {
    return "풀 수 있는 오답이 없어요.";
  }
  if (message.includes("not enough words")) {
    return "보기를 만들 단어가 부족해요.";
  }
  return "오답노트를 불러오지 못했어요.\n잠시 후 다시 시도해 주세요.";
}
