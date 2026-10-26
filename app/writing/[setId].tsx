import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { brandGradient, colors } from "../../lib/theme";
import {
  fetchWritingSet,
  friendlyWritingError,
  getWritingProgress,
  startWritingAttempt,
  submitWritingAttempt,
  type WritingAttemptStart,
  type WritingProgress,
  type WritingSentence,
  type WritingSubmitResult,
} from "../../lib/writing";
import ScreenHeader from "../../components/ScreenHeader";

type Mode = "arrange" | "result" | "summary";

const HEADER_TITLE: Record<Mode, string> = {
  arrange: "배열 풀이",
  result: "정답 확인",
  summary: "어순 배열 결과",
};

// 배열 단위를 칩으로 보여준다.
function ChunkChips({ chunks }: { chunks: string[] }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {chunks.map((chunk, i) => (
        <View key={i} className="rounded-xl bg-blush px-3 py-1.5">
          <Text className="text-base font-semibold text-ink-soft">{chunk}</Text>
        </View>
      ))}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{ opacity: disabled ? 0.4 : 1 }}
      className="flex-1 items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text className="text-lg font-bold text-white">{label}</Text>
      )}
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ opacity: disabled ? 0.4 : 1 }}
      className="flex-1 items-center rounded-2xl border border-line bg-white py-4"
    >
      <Text className="text-lg font-bold text-ink-soft">{label}</Text>
    </Pressable>
  );
}

export default function WritingStudyScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const [title, setTitle] = useState("");
  const [sentences, setSentences] = useState<WritingSentence[]>([]);
  const [progress, setProgress] = useState<WritingProgress | null>(null);
  const [mode, setMode] = useState<Mode>("arrange");
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState<WritingAttemptStart | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [result, setResult] = useState<WritingSubmitResult | null>(null);

  const refreshProgress = useCallback(async () => {
    try {
      setProgress(await getWritingProgress(setId));
    } catch (e) {
      setError(friendlyWritingError(e));
    }
  }, [setId]);

  // 문장 하나의 배열 풀이를 시작한다(암기는 학습 화면의 [암기]에서 따로 한다).
  const begin = useCallback(async (target: WritingSentence, targetIndex: number) => {
    setBusy(true);
    setError(null);
    try {
      const started = await startWritingAttempt(target.id);
      setIndex(targetIndex);
      setAttempt(started);
      setSelectedIds([]);
      setResult(null);
      setMode("arrange");
    } catch (e) {
      setError(friendlyWritingError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    try {
      const loaded = await fetchWritingSet(setId);
      setTitle(loaded.title);
      setSentences(loaded.sentences);
      const loadedProgress = await getWritingProgress(setId);
      setProgress(loadedProgress);
      // 아직 완성하지 못한 첫 문장부터 바로 배열을 시작한다. 모두 완성했으면 결과를 보여 준다.
      const firstOpen = loaded.sentences.findIndex(
        (s) =>
          !loadedProgress.sentences.find((p) => p.sentence_id === s.id)?.completed,
      );
      if (firstOpen === -1) {
        setMode("summary");
      } else {
        await begin(loaded.sentences[firstOpen], firstOpen);
      }
    } catch (e) {
      setError(friendlyWritingError(e));
    }
  }, [setId, begin]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const sentence = sentences[index];
  const isLast = index === sentences.length - 1;

  // 결과 화면의 "다시 풀기": 같은 문장을 새로 시작한다.
  const startArrange = () => {
    if (sentence) begin(sentence, index);
  };

  const submit = async () => {
    if (!attempt) return;
    setBusy(true);
    setError(null);
    try {
      const submitted = await submitWritingAttempt(
        attempt.attempt_id,
        selectedIds,
      );
      setResult(submitted);
      await refreshProgress();
      setMode("result");
    } catch (e) {
      setError(friendlyWritingError(e));
    } finally {
      setBusy(false);
    }
  };

  const goNext = async () => {
    if (isLast) {
      setBusy(true);
      await refreshProgress();
      setBusy(false);
      setMode("summary");
      return;
    }
    await begin(sentences[index + 1], index + 1);
  };

  const jumpTo = (sentenceId: string) => {
    const target = sentences.findIndex((s) => s.id === sentenceId);
    if (target >= 0) begin(sentences[target], target);
  };

  const showCounter = mode !== "summary" && sentences.length > 0;

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title={HEADER_TITLE[mode]}
        back
        right={
          showCounter ? (
            <View className="min-w-[72px] items-center rounded-full bg-white/25 px-2.5 py-1">
              <Text className="text-sm font-bold text-white">
                {index + 1} / {sentences.length}
              </Text>
            </View>
          ) : undefined
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : !sentence ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base font-semibold text-red-500">
            {error ?? "등록된 문장이 없어요."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-6 py-6 gap-5">
          <Text className="text-base font-bold text-ink-soft">{title}</Text>

          {progress?.is_late && (
            <View className="rounded-xl bg-amber-50 px-4 py-3">
              <Text className="text-base font-bold text-amber-700">
                지각 응시
              </Text>
              <Text className="mt-0.5 text-sm text-amber-700">
                주차가 끝난 지 5일 이내예요. 점수는 반영되고 지각으로 표시돼요.
              </Text>
            </View>
          )}
          {progress?.is_overdue && (
            <View className="rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-base font-bold text-red-600">
                기한 초과
              </Text>
              <Text className="mt-0.5 text-sm text-red-600">
                주차가 끝난 지 5일이 지났어요. 응시할 수 있지만 기한 초과로
                표시돼요.
              </Text>
            </View>
          )}

          {error && (
            <View className="rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-base font-semibold text-red-500">
                {error}
              </Text>
            </View>
          )}

          {mode === "arrange" && attempt && (
            <>
              <View className="rounded-3xl border border-line bg-white px-6 py-6 shadow-sm shadow-brand/20">
                <View className="flex-row items-center justify-between">
                  <View className="self-start rounded-full bg-cream px-3 py-1">
                    <Text className="text-sm font-bold text-berry">우리말</Text>
                  </View>
                  <Text className="text-sm font-semibold text-ink-soft">
                    {attempt.attempt_no}번째 시도
                  </Text>
                </View>
                <Text className="mt-3 text-xl font-bold leading-7 text-ink">
                  {attempt.korean}
                </Text>
              </View>

              <View className="min-h-[88px] rounded-3xl border-2 border-dashed border-brand/40 bg-white px-4 py-4">
                <Text className="mb-2 text-sm font-bold text-ink-soft">
                  내 답안
                </Text>
                {selectedIds.length === 0 ? (
                  <Text className="text-base text-ink-soft">
                    아래 단어를 눌러 문장을 만들어요
                  </Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {selectedIds.map((id) => {
                      const piece = attempt.pieces.find((p) => p.id === id);
                      return (
                        <Pressable
                          key={id}
                          onPress={() =>
                            setSelectedIds((ids) => ids.filter((x) => x !== id))
                          }
                          className="rounded-xl bg-brand px-3 py-2"
                        >
                          <Text className="text-lg font-semibold text-white">
                            {piece?.text}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <View>
                <Text className="mb-2 text-sm font-bold text-ink-soft">
                  단어 목록
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {attempt.pieces
                    .filter((p) => !selectedIds.includes(p.id))
                    .map((piece) => (
                      <Pressable
                        key={piece.id}
                        onPress={() =>
                          setSelectedIds((ids) => [...ids, piece.id])
                        }
                        className="rounded-xl border border-line bg-white px-3 py-2"
                      >
                        <Text className="text-lg font-semibold text-ink">
                          {piece.text}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </View>

              <View className="gap-3">
                <View className="flex-row gap-3">
                  <SecondaryButton
                    label="단어 취소"
                    disabled={selectedIds.length === 0}
                    onPress={() => setSelectedIds((ids) => ids.slice(0, -1))}
                  />
                  <SecondaryButton
                    label="처음부터"
                    disabled={selectedIds.length === 0}
                    onPress={() => setSelectedIds([])}
                  />
                </View>
                <View className="flex-row">
                  <PrimaryButton
                    label="정답 확인"
                    disabled={selectedIds.length !== attempt.pieces.length}
                    loading={busy}
                    onPress={submit}
                  />
                </View>
              </View>
            </>
          )}

          {mode === "result" && result && (
            <>
              <View
                className={`rounded-3xl border-2 px-6 py-6 ${
                  result.is_correct
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-red-300 bg-red-50"
                }`}
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name={
                      result.is_correct ? "checkmark-circle" : "close-circle"
                    }
                    size={26}
                    color={result.is_correct ? "#059669" : "#ef4444"}
                  />
                  <Text
                    className={`text-2xl font-extrabold ${
                      result.is_correct ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {result.is_correct
                      ? "정답이에요!"
                      : "아쉬워요, 다시 확인해 봐요"}
                  </Text>
                </View>
                {result.is_correct && result.sentence_completed && (
                  <Text className="mt-2 text-base font-semibold text-emerald-700">
                    {result.attempt_no === 1
                      ? "첫 시도에 맞혔어요"
                      : `${result.attempt_no}번째 시도에 맞혔어요`}{" "}
                    · +{result.points}점
                  </Text>
                )}
                {result.is_correct && result.was_already_completed && (
                  <Text className="mt-2 text-base text-ink-soft">
                    이미 완성한 문장이라 점수는 그대로예요
                  </Text>
                )}
                {!result.is_correct && result.order_accuracy !== undefined && (
                  <Text className="mt-2 text-base text-ink-soft">
                    어순 정확도 {Math.round(result.order_accuracy * 100)}%
                  </Text>
                )}
              </View>

              {!result.is_correct && result.submitted_chunks && (
                <View className="rounded-3xl border border-line bg-white px-5 py-5">
                  <Text className="mb-2 text-sm font-bold text-ink-soft">
                    내 답안
                  </Text>
                  <Text className="text-lg text-red-600">
                    {result.submitted_chunks.join(" ")}
                  </Text>
                </View>
              )}

              <View className="rounded-3xl border border-line bg-white px-6 py-6 shadow-sm shadow-brand/20">
                <View className="self-start rounded-full bg-cream px-3 py-1">
                  <Text className="text-sm font-bold text-berry">우리말</Text>
                </View>
                <Text className="mt-3 text-xl font-bold leading-7 text-ink">
                  {result.korean}
                </Text>
                <View className="mt-5 self-start rounded-full bg-blush px-3 py-1">
                  <Text className="text-sm font-bold text-brand-dark">
                    정답
                  </Text>
                </View>
                <Text className="mt-3 text-2xl font-extrabold leading-8 text-ink">
                  {result.english}
                </Text>
                <View className="mt-4">
                  <ChunkChips chunks={result.chunks} />
                </View>
              </View>

              <View className="flex-row gap-3">
                <SecondaryButton
                  label="다시 풀기"
                  onPress={startArrange}
                  disabled={busy}
                />
                <PrimaryButton
                  label={isLast ? "결과 보기" : "다음 문장"}
                  onPress={goNext}
                  loading={busy}
                />
              </View>
            </>
          )}

          {mode === "summary" && progress && (
            <>
              <LinearGradient
                colors={brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 28,
                  paddingHorizontal: 22,
                  paddingVertical: 24,
                }}
              >
                <Text className="text-sm font-bold text-cream">
                  {progress.passed ? "어순 배열 통과" : "진행 중"}
                </Text>
                <Text className="mt-1 text-5xl font-extrabold text-white">
                  {progress.points} / {progress.max_points}점
                </Text>
                <Text className="mt-2 text-base text-white/90">
                  완성 {progress.completed}/{progress.total}문장
                  {progress.first_try_rate !== null &&
                    ` · 첫 시도 정답률 ${progress.first_try_rate}%`}
                </Text>
              </LinearGradient>

              <View className="gap-3">
                <Text className="text-base font-bold text-ink-soft">
                  문장별 결과
                </Text>
                {progress.sentences.map((item) => (
                  <View
                    key={item.sentence_id}
                    className="flex-row items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3"
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-ink-soft">
                        {item.order_no}번
                      </Text>
                      <Text
                        className="mt-0.5 text-base text-ink"
                        numberOfLines={2}
                      >
                        {item.korean}
                      </Text>
                    </View>
                    {item.completed ? (
                      <View className="rounded-full bg-emerald-50 px-2.5 py-1">
                        <Text className="text-sm font-bold text-emerald-600">
                          +{item.points}점
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => jumpTo(item.sentence_id)}
                        className="rounded-full bg-brand px-3 py-1.5"
                      >
                        <Text className="text-sm font-bold text-white">
                          다시 풀기
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>

              <View className="flex-row gap-3">
                <SecondaryButton
                  label="처음부터 다시"
                  onPress={() => begin(sentences[0], 0)}
                />
                <PrimaryButton label="목록으로" onPress={() => router.back()} />
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
