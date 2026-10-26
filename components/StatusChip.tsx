import { View } from "react-native";
import { Text } from "./AppText";
import type { SetStatus } from "../lib/progress";

const STYLE: Record<SetStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: "미응시", bg: "bg-white/80", text: "text-ink-soft" },
  in_progress: { label: "진행 중", bg: "bg-amber-100", text: "text-amber-700" },
  completed: { label: "완료", bg: "bg-white", text: "text-emerald-600" },
};

// 단어장/어순 배열 세트의 진행 상태 칩.
export default function StatusChip({ status }: { status: SetStatus }) {
  const style = STYLE[status];
  return (
    <View className={`min-w-[72px] items-center rounded-full px-3 py-1 ${style.bg}`}>
      <Text className={`text-sm font-bold ${style.text}`}>{style.label}</Text>
    </View>
  );
}
