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
}

interface SetRow {
  id: string;
  title: string;
  week: number | null;
  created_at: string;
  courses: { id: string; subject: string; title: string } | null;
  writing_sentences: { count: number }[];
}

// 수강 중인 강좌의 어순 배열 세트를 강좌별로 묶어서 가져온다. 숨긴 세트와 수강하지
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
    const label = course ? `[${course.subject}] ${course.title}` : "어순 배열";
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
      .select("id, order_no, english, korean, chunks")
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
  // 이미 제출한 문장이면 true(회차에서 문장마다 한 번만 푼다).
  answered: boolean;
}

export interface WritingSubmitResult {
  is_correct: boolean;
  attempt_no: number;
  english: string;
  korean: string;
  chunks: string[];
  submitted_chunks?: string[];
  order_accuracy?: number;
  round_no: number;
  // 이 제출로 회차의 마지막 문장을 끝냈는지.
  round_completed: boolean;
  set_completed: boolean;
  already_submitted?: boolean;
}

export interface WritingQuestionProgress {
  question_id: string;
  order_no: number;
  attempt_id: string | null;
  answered: boolean;
  is_correct: boolean | null;
}

// 한 회차의 진행 상황(그 회차에 나오는 문장들).
export interface WritingProgress {
  title: string;
  week: number | null;
  round_no: number;
  questions: WritingQuestionProgress[];
  total: number;
  answered: number;
  correct: number;
  completed: boolean;
  score: number | null;
  // 주차 종료 후 5일 이내에 응시하는 경우(지각 응시).
  is_late: boolean;
  // 주차 종료 후 5일이 지나 응시하는 경우(기한 초과).
  is_overdue: boolean;
}

// 내가 볼 수 있는 모든 어순 배열 세트와 결과(학습 결과·홈 요약용). 순서/문장 배열과 같은 모양.
export interface WritingOverviewRow {
  id: string;
  title: string;
  week: number | null;
  course_id: string;
  total: number;
  answered: number;
  completed: boolean;
  score: number | null;
  correct: number | null;
  first_score: number | null;
  final_score: number | null;
  completed_at: string | null;
  is_late: boolean;
  is_overdue: boolean;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const startWritingAttempt = (sentenceId: string, round: number) =>
  rpc<WritingAttemptStart>("start_writing_attempt", {
    p_sentence_id: sentenceId,
    p_round: round,
  });

export const submitWritingAttempt = (attemptId: string, pieceIds: number[]) =>
  rpc<WritingSubmitResult>("submit_writing_attempt", {
    p_attempt_id: attemptId,
    p_piece_ids: pieceIds,
  });

export const fetchWritingOverview = () => rpc<WritingOverviewRow[]>("get_writing_overview", {});

// round를 생략하면 지금 풀 회차(풀던 회차 또는 다음 회차)의 진행 상황.
export const getWritingProgress = (setId: string, round?: number) =>
  rpc<WritingProgress>("get_writing_set_progress", {
    p_set_id: setId,
    p_round: round ?? null,
  });

export function friendlyWritingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not available")) {
    return "이 어순 배열은 지금 풀 수 없어요.";
  }
  if (message.includes("invalid arrangement")) {
    return "답안이 올바르지 않아요. 처음부터 다시 만들어 주세요.";
  }
  return "어순 배열을 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
}
