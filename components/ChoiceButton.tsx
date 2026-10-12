import { Pressable, Text, View } from "react-native";

interface ChoiceQuestion {
  selected_index: number | null;
  correct_index: number | null;
  is_correct: boolean | null;
}

// 4지선다 보기 한 줄. 답하기 전에는 기본 모양, 답한 뒤에는 정답은 초록,
// 내가 고른 오답은 빨강으로 표시하고 나머지는 흐리게 한다.
export default function ChoiceButton({
  index,
  text,
  question,
  disabled,
  pending = false,
  onPress,
}: {
  index: number;
  text: string;
  question: ChoiceQuestion;
  disabled: boolean;
  // 아직 확정하지 않고 눌러 둔(선택 중인) 보기.
  pending?: boolean;
  onPress: () => void;
}) {
  const answered = question.selected_index !== null;
  const isCorrectChoice = answered && question.correct_index === index;
  const isWrongSelection =
    answered && question.selected_index === index && !question.is_correct;

  let containerClass = "border-line bg-white";
  let textClass = "text-ink";
  let numberBg = "bg-blush";
  let numberText = "text-berry";
  if (!answered && pending) {
    containerClass = "border-brand bg-blush";
    textClass = "text-berry font-bold";
    numberBg = "bg-brand";
    numberText = "text-white";
  } else if (isCorrectChoice) {
    containerClass = "border-emerald-500 bg-emerald-50";
    textClass = "text-emerald-700";
    numberBg = "bg-emerald-500";
    numberText = "text-white";
  } else if (isWrongSelection) {
    containerClass = "border-red-400 bg-red-50";
    textClass = "text-red-600";
    numberBg = "bg-red-400";
    numberText = "text-white";
  } else if (answered) {
    containerClass = "border-line bg-white opacity-50";
    textClass = "text-ink-soft";
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({ opacity: pressed && !answered ? 0.8 : 1 })}
      className={`flex-row items-center rounded-2xl border-2 px-4 py-4 ${containerClass}`}
    >
      <View
        className={`mr-3 h-7 w-7 items-center justify-center rounded-full ${numberBg}`}
      >
        <Text className={`text-base font-bold ${numberText}`}>{index + 1}</Text>
      </View>
      <Text className={`flex-1 text-lg ${textClass}`}>{text}</Text>
      {isCorrectChoice && (
        <Text className="text-sm font-bold text-emerald-600">정답</Text>
      )}
      {isWrongSelection && (
        <Text className="text-sm font-bold text-red-500">오답</Text>
      )}
    </Pressable>
  );
}
