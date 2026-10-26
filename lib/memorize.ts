import { supabase } from "./supabase";
import type { TestKind } from "./weekly";

// 암기 카드 한 장의 내용: 위에서 아래로 쌓이는 블록들. emphasis는 크게 보여 줄 줄이다.
export interface MemorizeBlock {
  label: string;
  text: string;
  emphasis?: boolean;
}

export interface MemorizeCard {
  key: string;
  // 카드 맨 위 작은 이름표(예: "문제 1").
  badge: string;
  blocks: MemorizeBlock[];
}

export interface TextMemorizeSet {
  title: string;
  cards: MemorizeCard[];
}

interface WritingRow {
  id: string;
  order_no: number;
  english: string;
  korean: string;
  chunks: string[];
  key_phrases: string[] | null;
}

interface OrderPayload {
  title: string;
  questions: { order_no: number; intro: string; parts: string[] }[];
}

interface SentencePayload {
  title: string;
  questions: { order_no: number; intro: string; sentences: string[] }[];
}

const ORDINAL = ["첫 번째", "두 번째", "세 번째"];

async function rpc<T>(fn: string, setId: string): Promise<T> {
  const { data, error } = await supabase.rpc(fn, { p_set_id: setId });
  if (error) throw new Error(error.message);
  return data as T;
}

// 어순 배열·순서 배열·문장 배열의 암기용 카드를 만든다(단어는 별도 화면).
// 정답 순서를 보여 주므로 시험 전에 외우는 용도다.
export async function fetchTextMemorize(
  kind: Exclude<TestKind, "vocab">,
  setId: string,
): Promise<TextMemorizeSet> {
  if (kind === "writing") {
    const [{ data: set, error: setError }, { data: rows, error }] = await Promise.all([
      supabase.from("writing_sets").select("title").eq("id", setId).maybeSingle(),
      supabase
        .from("writing_sentences")
        .select("id, order_no, english, korean, chunks, key_phrases")
        .eq("writing_set_id", setId)
        .order("order_no", { ascending: true })
        .returns<WritingRow[]>(),
    ]);
    if (setError || error || !set) throw new Error((setError ?? error)?.message ?? "not found");
    return {
      title: set.title,
      cards: (rows ?? []).map((row) => {
        const blocks: MemorizeBlock[] = [
          { label: "우리말", text: row.korean },
          { label: "영어", text: row.english, emphasis: true },
          { label: "끊어 읽기", text: row.chunks.join("  /  ") },
        ];
        if (row.key_phrases && row.key_phrases.length > 0) {
          blocks.push({ label: "핵심 어구", text: row.key_phrases.join(", ") });
        }
        return { key: row.id, badge: `문장 ${row.order_no}`, blocks };
      }),
    };
  }

  if (kind === "order") {
    const data = await rpc<OrderPayload>("get_order_memorize", setId);
    return {
      title: data.title,
      cards: data.questions.map((q) => ({
        key: String(q.order_no),
        badge: `문제 ${q.order_no}`,
        blocks: [
          { label: "주어진 글", text: q.intro },
          ...q.parts.map((text, i) => ({
            label: `${ORDINAL[i]} 덩어리`,
            text,
            emphasis: true,
          })),
        ],
      })),
    };
  }

  const data = await rpc<SentencePayload>("get_sentence_memorize", setId);
  return {
    title: data.title,
    cards: data.questions.map((q) => ({
      key: String(q.order_no),
      badge: `문제 ${q.order_no}`,
      blocks: [
        { label: "첫 문장", text: q.intro },
        ...q.sentences.map((text, i) => ({
          label: `${i + 2}번째 문장`,
          text,
          emphasis: true,
        })),
      ],
    })),
  };
}
