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
import { roundTitle } from "../../lib/test";
import ScreenHeader from "../../components/ScreenHeader";

type Mode = "arrange" | "result" | "summary";

const HEADER_TITLE: Record<Mode, string> = {
  arrange: "배열 풀이",
  result: "정답 확인",
  summary: "회차 결과",
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
  const { setId, round: roundParam } = useLocalSearchParams<{ setId: string; round?: string }>();
  // 회차 현황 화면에서 넘겨 준 회차. 없으면 서버가 지금 풀 회차를 정한다.
  const round = Number(roundParam) || undefined;
  const [title, setTitle] = useState("");
  // 이 회차에 나오는 문장들(1·2차 시험은 전체, 재시험은 틀린 문장만).
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
      setProgress(await getWritingProgress(setId, round));
    } catch (e) {
      setError(friendlyWritingError(e));
    }
  }, [setId, round]);

  // 문장 하나의 배열 풀이를 시작한다(암기는 학습 화면의 [암기]에서 따로 한다).
  const begin = useCallback(
    async (target: WritingSentence, targetIndex: number, roundNo: number) => {
      setBusy(true);
      setError(null);
      try {
        const started = await startWritingAttempt(target.id, roundNo);
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
    },
    [],
  );

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
      const [loaded, loadedProgress] = await Promise.all([
        fetchWritingSet(setId),
        getWritingProgress(setId, round),
      ]);
      setTitle(loaded.title);
      setProgress(loadedProgress);
      // 이 회차에 나오는 문장만, 문제 번호 순서대로.
      const inRound = loadedProgress.questions
        .map((q) => loaded.sentences.find((s) => s.id === q.question_id))
        .filter((s): s is WritingSentence => s !== undefined);
      setSentences(inRound);
      // 아직 풀지 않은 첫 문장부터 바로 배열을 시작한다. 모두 풀었으면 결과를 보여 준다.
      const firstOpen = loadedProgress.questions.findIndex((q) => !q.answered);
      if (firstOpen === -1) {
        setMode("summary");
      } else {
        await begin(inRound[firstOpen], firstOpen, loadedProgress.round_no);
      }
    } catch (e) {
      setError(friendlyWritingError(e));
    }
  }, [setId, round, begin]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const sentence = sentences[index];
  const isLast = index === sentences.length - 1;

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
    if (isLast || !progress) {
      setBusy(true);
      await refreshProgress();
      setBusy(false);
      setMode("summary");
      return;
    }
    await begin(sentences[index + 1], index + 1, progress.round_no);
  };

  const showCounter = mode !== "summary" && sentences.length > 0;

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title={
          progress && mode !== "result" ? roundTitle(progress.round_no) : HEADER_TITLE[mode]
        }
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
        <View className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 py-6 gap-5"
          contentContainerStyle={{ flexGrow: 1 }}
        >
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

              {/* 내 답안 칸은 높이를 고정한다(단어를 고르는 만큼 아래 영역이 밀리지 않게). 넘치면 칸 안에서 스크롤. */}
              <View className="h-[168px] rounded-3xl border-2 border-dashed border-brand/40 bg-white px-4 py-4">
                <Text className="mb-2 text-sm font-bold text-ink-soft">
                  내 답안
                </Text>
                {selectedIds.length === 0 ? (
                  <Text className="text-base text-ink-soft">
                    아래 단어를 눌러 문장을 만들어요
                  </Text>
                ) : (
                  <ScrollView nestedScrollEnabled className="flex-1">
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
                  </ScrollView>
                )}
              </View>

              <View>
                <Text className="mb-2 text-sm font-bold text-ink-soft">
                  단어 목록
                </Text>
                {/* 고른 단어도 자리를 그대로 두고 안 보이게만 해서, 아래 버튼들이 움직이지 않는다. */}
                <View className="flex-row flex-wrap gap-2">
                  {attempt.pieces.map((piece) => {
                    const used = selectedIds.includes(piece.id);
                    return (
                      <Pressable
                        key={piece.id}
                        disabled={used}
                        onPress={() =>
                          setSelectedIds((ids) => [...ids, piece.id])
                        }
                        style={{ opacity: used ? 0 : 1 }}
                        className="rounded-xl border border-line bg-white px-3 py-2"
                      >
                        <Text className="text-lg font-semibold text-ink">
                          {piece.text}
                        </Text>
                      </Pressable>
                    );
                  })}
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
                      : "아쉬워요"}
                  </Text>
                </View>
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

              <View className="flex-1 rounded-3xl border border-line bg-white px-6 py-6 shadow-sm shadow-brand/20">
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
                  {roundTitle(progress.round_no)} · {progress.title}
                </Text>
                <Text className="mt-1 text-5xl font-extrabold text-white">
                  {progress.score ?? 0}점
                </Text>
                <Text className="mt-2 text-base text-white/90">
                  {progress.total}문장 중 {progress.correct}개 정답
                </Text>
              </LinearGradient>

              <View className="gap-3">
                <Text className="text-base font-bold text-ink-soft">
                  문장별 결과
                </Text>
                {progress.questions.map((item) => (
                  <View
                    key={item.question_id}
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
                        {sentences.find((x) => x.id === item.question_id)?.korean}
                      </Text>
                    </View>
                    <View
                      className={`rounded-full px-2.5 py-1 ${
                        item.is_correct ? "bg-emerald-50" : "bg-red-50"
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${
                          item.is_correct ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {item.is_correct ? "정답" : "오답"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View className="flex-row gap-3">
                <PrimaryButton label="완료" onPress={() => router.back()} />
              </View>
            </>
          )}
        </ScrollView>
        {/* 배열 풀이의 버튼은 스크롤 밖 화면 맨 아래에 고정한다. */}
        {mode === "arrange" && attempt && (
          <View className="gap-3 px-6 pb-6 pt-3">
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
        )}
        {mode === "result" && result && (
          <View className="flex-row gap-3 px-6 pb-6 pt-3">
            <PrimaryButton
              label={isLast ? "결과 보기" : "다음 문제"}
              onPress={goNext}
              loading={busy}
            />
          </View>
        )}
        </View>
      )}
    </View>
  );
}
