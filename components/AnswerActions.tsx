import { ActivityIndicator, Pressable, Text, View } from "react-native";

// 4지선다 하단 버튼. 보기를 누르면 "선택"만 되고, 확인을 눌러야 답이 확정된다
// (실수로 눌러 오답이 되는 것을 막기 위해). 답을 확정한 뒤에는 다음 단계 버튼 하나만 보인다.
export default function AnswerActions({
  answered,
  hasSelection,
  submitting,
  onCancel,
  onConfirm,
  onNext,
  nextLabel,
}: {
  answered: boolean;
  hasSelection: boolean;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  if (answered) {
    return (
      <Pressable
        onPress={onNext}
        className="items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
      >
        <Text className="text-lg font-bold text-white">{nextLabel}</Text>
      </Pressable>
    );
  }

  return (
    <View className="flex-row gap-3">
      <Pressable
        onPress={onCancel}
        disabled={!hasSelection || submitting}
        style={{ opacity: hasSelection && !submitting ? 1 : 0.4 }}
        className="flex-1 items-center rounded-2xl border border-line bg-white py-4"
      >
        <Text className="text-lg font-bold text-ink-soft">취소</Text>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        disabled={!hasSelection || submitting}
        style={{ opacity: hasSelection && !submitting ? 1 : 0.4 }}
        className="flex-1 items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-lg font-bold text-white">확인</Text>
        )}
      </Pressable>
    </View>
  );
}
