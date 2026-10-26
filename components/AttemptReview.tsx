import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./AppText";
import EmptyState from "./EmptyState";
import type { AttemptQuestion } from "../lib/test";

type Filter = "wrong" | "all";

// 문항 하나: 단어, 내가 고른 답(오답이면 빨강), 정답(초록), 예시 문장과 그 뜻.
function QuestionRow({ question }: { question: AttemptQuestion }) {
  const wrong = question.is_correct === false;
  const picked =
    question.selected_index !== null
      ? question.choices[question.selected_index]
      : null;
  const correct =
    question.correct_index !== null
      ? question.choices[question.correct_index]
      : null;

  return (
    <View
      className={`rounded-2xl border px-4 py-3 ${
        wrong ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-bold text-ink">
          {question.position}. {question.word}
        </Text>
        <View
          className={`rounded-full px-2.5 py-0.5 ${
            wrong ? "bg-red-100" : "bg-emerald-100"
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              wrong ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {wrong ? "오답" : "정답"}
          </Text>
        </View>
      </View>
      {wrong && picked && (
        <Text className="mt-2 text-base text-red-500">
          내가 고른 답: {picked}
        </Text>
      )}
      {correct && (
        <Text className="mt-1 text-base text-emerald-700">
          정답: {correct}
        </Text>
      )}
      {question.example && (
        <Text className="mt-1.5 text-sm text-ink-soft">{question.example}</Text>
      )}
      {question.example_meaning && (
        <Text className="mt-0.5 text-sm text-ink-soft">
          {question.example_meaning}
        </Text>
      )}
    </View>
  );
}

// 한 회차의 문제 목록: [틀린 문제 N | 전체 N] 필터와 문항별 결과.
// 시험을 마친 직후 화면과 지난 회차 결과 화면이 함께 쓴다.
export default function AttemptReview({
  questions,
}: {
  questions: AttemptQuestion[];
}) {
  const [filter, setFilter] = useState<Filter>("wrong");
  const wrongQuestions = questions.filter((q) => q.is_correct === false);
  const shown = filter === "wrong" ? wrongQuestions : questions;

  return (
    <View className="gap-5">
      <View className="flex-row gap-2">
        {(
          [
            ["wrong", `틀린 문제 ${wrongQuestions.length}`],
            ["all", `전체 ${questions.length}`],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            className={`rounded-full border px-4 py-2 ${
              filter === key ? "border-brand bg-brand" : "border-line bg-white"
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                filter === key ? "text-white" : "text-ink-soft"
              }`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon="checkmark-circle-outline"
          title="틀린 문제가 없어요"
          description="모든 문제를 맞혔어요"
        />
      ) : (
        <View className="gap-3">
          {shown.map((question) => (
            <QuestionRow key={question.position} question={question} />
          ))}
        </View>
      )}
    </View>
  );
}
