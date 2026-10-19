import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { categoryColors } from "../lib/theme";
import { KIND_LABEL } from "../lib/weekly";
import type { WeekTest } from "../lib/results";
import StatusChip from "./StatusChip";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// 그 주차에 본(또는 아직 못 본) 시험 하나. 누르면 해당 시험 화면으로 간다.
export default function TestResultCard({ test }: { test: WeekTest }) {
  const palette = categoryColors[test.kind];
  const done = test.status === "completed";

  return (
    <Pressable
      onPress={() =>
        router.push(
          test.kind === "vocab" ? `/test/${test.id}` : `/writing/${test.id}`,
        )
      }
      style={{
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
      className="rounded-3xl px-5 py-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <View
            className="rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: palette.accent }}
          >
            <Text className="text-sm font-bold" style={{ color: palette.fg }}>
              {KIND_LABEL[test.kind]}
            </Text>
          </View>
          <Text className="flex-1 text-lg font-bold text-ink">{test.title}</Text>
        </View>
        {done && test.scoreLabel ? (
          <View className="rounded-full bg-white px-3 py-1">
            <Text
              className="text-base font-extrabold"
              style={{ color: palette.fg }}
            >
              {test.scoreLabel}
            </Text>
          </View>
        ) : (
          <StatusChip status={test.status} />
        )}
      </View>
      <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
        {done && test.detail && test.date && (
          <Text className="text-sm text-ink-soft">
            {test.detail} · {formatDate(test.date)}
          </Text>
        )}
        {!done && (
          <Text className="text-sm text-ink-soft">
            {test.status === "in_progress"
              ? "이어서 풀 수 있어요"
              : "아직 응시하지 않았어요"}
          </Text>
        )}
        {test.timings.map((tag) => (
          <View
            key={tag.label}
            className={`rounded-full px-2 py-0.5 ${
              tag.kind === "overdue" ? "bg-red-100" : "bg-amber-100"
            }`}
          >
            <Text
              className={`text-[12px] font-bold ${
                tag.kind === "overdue" ? "text-red-600" : "text-amber-700"
              }`}
            >
              {tag.label}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
