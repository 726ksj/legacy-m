import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { categoryColors } from "../lib/theme";

interface VocabCardProps {
  totalSets: number;
  testedSetCount: number;
}

function ComingSoonCard({
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
      className="rounded-3xl px-5 py-4 opacity-70"
      style={{
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold" style={{ color: colors.fg }}>
          {title}
        </Text>
        <View className="rounded-full bg-white/70 px-2.5 py-0.5">
          <Text className="text-xs font-bold text-ink-soft">준비 중</Text>
        </View>
      </View>
      <Text className="mt-1 text-sm text-ink-soft">{subtitle}</Text>
    </View>
  );
}

export function VocabStudyCard({ totalSets, testedSetCount }: VocabCardProps) {
  const colors = categoryColors.vocab;
  const statusText =
    totalSets === 0
      ? "학습할 단어장 없음"
      : `${testedSetCount} / ${totalSets}개 완료`;

  return (
    <Pressable
      onPress={() => router.push("/vocab")}
      style={{
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      className="rounded-3xl px-5 py-5 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold" style={{ color: colors.fg }}>
          단어 학습
        </Text>
        <View className="flex-row items-center gap-1">
          <View
            className="rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: colors.accent }}
          >
            <Text className="text-sm font-bold" style={{ color: colors.fg }}>
              {statusText}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.fg} />
        </View>
      </View>
      <Text className="mt-1 text-sm text-ink-soft">
        단어를 암기하고 테스트해요
      </Text>
    </Pressable>
  );
}

export function WritingStudyCard() {
  const colors = categoryColors.writing;
  return (
    <Pressable
      onPress={() => router.push("/writing")}
      style={{
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      className="rounded-3xl px-5 py-5 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold" style={{ color: colors.fg }}>
          어순 배열
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.fg} />
      </View>
      <Text className="mt-1 text-sm text-ink-soft">
        문장을 암기하고 배열해요
      </Text>
    </Pressable>
  );
}

export function StudyCardList({ totalSets, testedSetCount }: VocabCardProps) {
  return (
    <View className="gap-3">
      <VocabStudyCard totalSets={totalSets} testedSetCount={testedSetCount} />
      <WritingStudyCard />
      <ComingSoonCard
        title="순서 배열"
        subtitle="지문과 문장의 순서를 맞춰요"
        colors={categoryColors.order}
      />
      <ComingSoonCard
        title="어법 학습"
        subtitle="문맥에 맞는 어법을 선택해요"
        colors={categoryColors.grammar}
      />
    </View>
  );
}
