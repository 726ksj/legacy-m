import { supabase } from "./supabase";

export interface VocabSet {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  week: number | null;
}

export interface Course {
  id: string;
  subject: string;
  title: string;
  teacher_name: string;
}

export interface VocabSetItem extends VocabSet {
  wordCount: number;
  lastScore: number | null;
  lastTestedAt: string | null;
}

export interface VocabGroup {
  key: string;
  label: string;
  sets: VocabSetItem[];
}

export interface VocabOverview {
  groups: VocabGroup[];
  totalSets: number;
  testedSetCount: number;
}

interface AssignmentRow {
  assigned_at: string;
  vocab_sets: VocabSet | null;
  courses: Course | null;
}

export async function fetchVocabOverview(): Promise<VocabOverview> {
  const { data: assignmentRows } = await supabase
    .from("vocab_assignments")
    .select(
      "assigned_at, vocab_sets(id, title, description, created_at, week), courses(id, subject, title, teacher_name)",
    )
    .order("assigned_at", { ascending: false })
    .returns<AssignmentRow[]>();

  const rows = (assignmentRows ?? []).filter((row) => row.vocab_sets !== null);
  const setIds = rows.map((row) => row.vocab_sets!.id);

  const [{ data: wordRows }, { data: resultRows }] = await Promise.all([
    setIds.length
      ? supabase
          .from("vocab_words")
          .select("vocab_set_id")
          .in("vocab_set_id", setIds)
      : Promise.resolve({ data: [] as { vocab_set_id: string }[] }),
    setIds.length
      ? supabase
          .from("vocab_test_results")
          .select("vocab_set_id, score, tested_at")
          .in("vocab_set_id", setIds)
          .order("tested_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            vocab_set_id: string;
            score: number;
            tested_at: string;
          }[],
        }),
  ]);

  const wordCountBySet = new Map<string, number>();
  for (const row of wordRows ?? []) {
    wordCountBySet.set(
      row.vocab_set_id,
      (wordCountBySet.get(row.vocab_set_id) ?? 0) + 1,
    );
  }

  const lastResultBySet = new Map<
    string,
    { score: number; tested_at: string }
  >();
  for (const row of resultRows ?? []) {
    if (!lastResultBySet.has(row.vocab_set_id)) {
      lastResultBySet.set(row.vocab_set_id, {
        score: row.score,
        tested_at: row.tested_at,
      });
    }
  }

  const groupMap = new Map<string, VocabGroup>();
  for (const row of rows) {
    const set = row.vocab_sets!;
    const course = row.courses;
    const key = course ? course.id : "personal";
    const label = course
      ? `[${course.subject}] ${course.title}`
      : "개인 배정 단어장";
    const lastResult = lastResultBySet.get(set.id);

    if (!groupMap.has(key)) {
      groupMap.set(key, { key, label, sets: [] });
    }
    groupMap.get(key)!.sets.push({
      ...set,
      wordCount: wordCountBySet.get(set.id) ?? 0,
      lastScore: lastResult?.score ?? null,
      lastTestedAt: lastResult?.tested_at ?? null,
    });
  }

  // 같은 강좌 안에서는 주차 순(주차 미지정은 뒤), 같은 주차에서는 등록 순.
  for (const group of groupMap.values()) {
    group.sets.sort(
      (a, b) =>
        (a.week ?? 99) - (b.week ?? 99) ||
        a.created_at.localeCompare(b.created_at),
    );
  }

  return {
    groups: Array.from(groupMap.values()),
    totalSets: rows.length,
    testedSetCount: lastResultBySet.size,
  };
}
