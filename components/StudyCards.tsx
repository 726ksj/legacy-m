import { View } from "react-native";
import { Text } from "./AppText";

// 아직 열리지 않은 학습 유형(순서 배열, 어법 학습)을 보여 주는 카드.
export function ComingSoonCard({
  title,
  subtitle,
  colors,
}: {
  title: string;
  subtitle: string;
  colors: { bg: string; fg: string; border: string };
}) {
  return (
    <View
      className="rounded-3xl px-6 py-5 opacity-70"
      style={{
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold" style={{ color: colors.fg }}>
          {title}
        </Text>
        <View className="rounded-full bg-white/70 px-2.5 py-0.5">
          <Text className="text-sm font-bold text-ink-soft">준비 중</Text>
        </View>
      </View>
      <Text className="mt-1 text-base text-ink-soft">{subtitle}</Text>
    </View>
  );
}
