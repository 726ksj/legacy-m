import { supabase } from "./supabase";

export interface WritingSetItem {
  id: string;
  title: string;
  week: number | null;
  sentenceCount: number;
}

export interface WritingGroup {
  key: string;
  label: string;
  sets: WritingSetItem[];
}

export interface WritingSentence {
  id: string;
  order_no: number;
  english: string;
  korean: string;
  // 정답 문장을 나눈 배열 단위(순서대로).
  chunks: string[];
  // 강사가 표시한 핵심 어구(chunks 중 일부).
  key_phrases: string[];
}

interface SetRow {
  id: string;
  title: string;
  week: number | null;
  created_at: string;
  courses: { id: string; subject: string; title: string } | null;
  writing_sentences: { count: number }[];
}

// 수강 중인 강좌의 서술형 세트를 강좌별로 묶어서 가져온다. 숨긴 세트와 수강하지
// 않는 강좌의 세트는 RLS가 걸러준다.
export async function fetchWritingGroups(): Promise<WritingGroup[]> {
  const { data, error } = await supabase
    .from("writing_sets")
    .select(
      "id, title, week, created_at, courses(id, subject, title), writing_sentences(count)",
    )
    .order("week", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .returns<SetRow[]>();
  if (error) throw new Error(error.message);

  const groups = new Map<string, WritingGroup>();
  for (const row of data ?? []) {
    const course = row.courses;
    const key = course ? course.id : "etc";
    const label = course ? `[${course.subject}] ${course.title}` : "서술형";
    if (!groups.has(key)) groups.set(key, { key, label, sets: [] });
    groups.get(key)!.sets.push({
      id: row.id,
      title: row.title,
      week: row.week,
      sentenceCount: row.writing_sentences[0]?.count ?? 0,
    });
  }
  return Array.from(groups.values());
}

export async function fetchWritingSet(setId: string): Promise<{
  title: string;
  sentences: WritingSentence[];
}> {
  const [
    { data: set, error: setError },
    { data: sentences, error: sentencesError },
  ] = await Promise.all([
    supabase.from("writing_sets").select("title").eq("id", setId).maybeSingle(),
    supabase
      .from("writing_sentences")
      .select("id, order_no, english, korean, chunks, key_phrases")
      .eq("writing_set_id", setId)
      .order("order_no", { ascending: true })
      .returns<WritingSentence[]>(),
  ]);
  if (setError || sentencesError) {
    throw new Error((setError ?? sentencesError)!.message);
  }
  if (!set) throw new Error("not found");
  return { title: set.title, sentences: sentences ?? [] };
}

// ---- 배열 풀이(서버가 섞고 채점한다) ----

export interface WritingPiece {
  // 섞인 순서의 번호. 이 번호만으로는 정답 순서를 알 수 없다.
  id: number;
  text: string;
}

export interface WritingAttemptStart {
  attempt_id: string;
  attempt_no: number;
  sentence_id: string;
  order_no: number;
  korean: string;
  pieces: WritingPiece[];
  already_completed: boolean;
}

export interface WritingSubmitResult {
  is_correct: boolean;
  attempt_no: number;
  english: string;
  korean: string;
  chunks: string[];
  key_phrases: string[];
  submitted_chunks?: string[];
  order_accuracy?: number;
  // 이번 제출로 새로 얻은 문장 점수(첫 시도 5 · 2번째 3 · 3번째 이후 1).
  points?: number;
  sentence_completed?: boolean;
  was_already_completed?: boolean;
  set_completed?: boolean;
  already_submitted?: boolean;
}

export interface WritingSentenceProgress {
  sentence_id: string;
  order_no: number;
  korean: string;
  attempts: number;
  completed: boolean;
  first_try_correct: boolean;
  points: number;
}

export interface WritingProgress {
  sentences: WritingSentenceProgress[];
  total: number;
  completed: number;
  points: number;
  max_points: number;
  first_try_rate: number | null;
  passed: boolean;
  // 주차 종료 후 5일 이내에 응시하는 경우(지각 응시).
  is_late: boolean;
  // 주차 종료 후 5일이 지나 응시하는 경우(기한 초과).
  is_overdue: boolean;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const startWritingAttempt = (sentenceId: string) =>
  rpc<WritingAttemptStart>("start_writing_attempt", {
    p_sentence_id: sentenceId,
  });

export const submitWritingAttempt = (attemptId: string, pieceIds: number[]) =>
  rpc<WritingSubmitResult>("submit_writing_attempt", {
    p_attempt_id: attemptId,
    p_piece_ids: pieceIds,
  });

export const getWritingProgress = (setId: string) =>
  rpc<WritingProgress>("get_writing_set_progress", { p_set_id: setId });

export function friendlyWritingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not available")) {
    return "이 서술형은 지금 풀 수 없어요.";
  }
  if (message.includes("invalid arrangement")) {
    return "답안이 올바르지 않아요. 처음부터 다시 만들어 주세요.";
  }
  return "서술형을 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
}
