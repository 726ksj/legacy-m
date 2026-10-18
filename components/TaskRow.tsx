import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { categoryColors, colors } from "../lib/theme";
import { KIND_LABEL, STATUS_LABEL, type WeeklyTask } from "../lib/weekly";

const STATUS_STYLE: Record<WeeklyTask["status"], { bg: string; text: string }> =
  {
    not_started: { bg: "bg-white/80", text: "text-ink-soft" },
    in_progress: { bg: "bg-amber-100", text: "text-amber-700" },
    completed: { bg: "bg-white", text: "text-emerald-600" },
  };

export default function TaskRow({
  task,
  deadline,
}: {
  task: WeeklyTask;
  // 이번 주 마감까지 남은 기간 칩("D-3"). 끝낸 시험이나 지난 주 시험에는 주지 않는다.
  deadline?: { label: string; urgent: boolean } | null;
}) {
  const style = STATUS_STYLE[task.status];
  // 단어는 민트, 어순 배열은 분홍으로 구분한다.
  const palette =
    task.kind === "vocab" ? categoryColors.vocab : categoryColors.writing;
  const open = () =>
    router.push(
      task.kind === "vocab" ? `/test/${task.id}` : `/writing/${task.id}`,
    );

  return (
    <Pressable
      onPress={open}
      style={{
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
      className="rounded-3xl px-5 py-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <View
              className="rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: palette.accent }}
            >
              <Text
                className="text-[13px] font-bold"
                style={{ color: palette.fg }}
              >
                {KIND_LABEL[task.kind]}
              </Text>
            </View>
            {task.week !== null && (
              <Text className="text-sm font-semibold text-ink-soft">
                {task.week}주차
              </Text>
            )}
          </View>
          <Text className="mt-1.5 text-lg font-bold text-ink">
            {task.title}
          </Text>
        </View>
        <View className="items-end gap-1.5">
          <View className={`rounded-full px-2.5 py-1 ${style.bg}`}>
            <Text className={`text-sm font-bold ${style.text}`}>
              {STATUS_LABEL[task.status]}
            </Text>
          </View>
          {deadline && task.status !== "completed" && (
            <View
              className={`rounded-full px-2.5 py-0.5 ${
                deadline.urgent ? "bg-red-100" : "bg-white"
              }`}
            >
              <Text
                className={`text-[13px] font-bold ${
                  deadline.urgent ? "text-red-600" : "text-ink-soft"
                }`}
              >
                {deadline.label}
              </Text>
            </View>
          )}
          {task.is_late && (
            <View className="rounded-full bg-amber-100 px-2.5 py-0.5">
              <Text className="text-[13px] font-bold text-amber-700">
                지각 응시
              </Text>
            </View>
          )}
          {task.is_overdue && (
            <View className="rounded-full bg-red-100 px-2.5 py-0.5">
              <Text className="text-[13px] font-bold text-red-600">
                기한 초과
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
      </View>
    </Pressable>
  );
}
