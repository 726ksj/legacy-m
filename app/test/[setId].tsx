import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import { isTestKind, KIND_TITLES } from "../../lib/study";
import { roundRoute, type TestKind } from "../../lib/weekly";
import {
  friendlyTestError,
  getTestStatus,
  retestDescription,
  ROUND_TITLE,
  startAttempt,
  startLabel,
  type TestRound,
  type TestStatus,
} from "../../lib/test";

type Timing = "late" | "overdue" | null;

const TIMING_LABEL = { late: "지각", overdue: "기한 초과" } as const;

// 기한(주차 종료일)이 걸린 시험은 1차 시험과 2차 시험이고, 재시험에는 별도 기한이 없다.
const isExamRound = (roundNo: number) => roundNo === 1 || roundNo === 3;

// 시험 회차 한 장. 끝낸 회차는 점수가 있는 작은 줄(눌러서 결과 보기)이고,
// 지금 응시할 회차(current)는 테두리가 강조된 큰 카드에 시작 버튼이 들어 있다.
function RoundCard({
  kind,
  roundNo,
  round,
  timing,
  current,
  actionLabel,
  starting,
  onStart,
  onPress,
}: {
  kind: TestKind;
  roundNo: number;
  round: TestRound | undefined;
  // 응시한 회차는 그 회차의 기록, 아직 안 푼 시험은 지금 시작하면 적용될 값.
  timing: Timing;
  current: boolean;
  actionLabel: string;
  starting: boolean;
  onStart: () => void;
  // 응시를 마친 회차만 눌러서 틀린 문제를 볼 수 있다.
  onPress?: () => void;
}) {
  let badge = "대기";
  let badgeBg = "bg-blush";
  let badgeText = "text-ink-soft";
  if (round?.status === "completed") {
    badge = `${round.score}점`;
    badgeBg = "bg-cream";
    badgeText = "text-berry";
  } else if (round?.status === "in_progress") {
    badge = "진행 중";
    badgeBg = "bg-amber-100";
    badgeText = "text-amber-700";
  }

  if (current) {
    return (
      <View
        className="rounded-3xl bg-white px-5 py-5 shadow-md shadow-brand/30"
        style={{ borderWidth: 2, borderColor: colors.brand }}
      >
        <View className="flex-row items-center gap-2">
          <View className="rounded-full bg-brand px-2.5 py-0.5">
            <Text className="text-xs font-bold text-white">지금 응시</Text>
          </View>
          {timing && (
            <View
              className={`rounded-full px-2 py-0.5 ${
                timing === "overdue" ? "bg-red-100" : "bg-amber-100"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  timing === "overdue" ? "text-red-600" : "text-amber-700"
                }`}
              >
                {TIMING_LABEL[timing]}
              </Text>
            </View>
          )}
        </View>
        <Text className="mt-2 text-2xl font-extrabold text-ink">
          {ROUND_TITLE[roundNo]}
        </Text>
        {(round?.status === "in_progress" || retestDescription(roundNo, kind)) && (
          <Text className="mt-1 text-sm text-ink-soft">
            {round?.status === "in_progress"
              ? "풀던 시험을 이어서 풀어요"
              : retestDescription(roundNo, kind)}
          </Text>
        )}
        <Pressable
          onPress={onStart}
          disabled={starting}
          style={({ pressed }) => ({ opacity: pressed || starting ? 0.8 : 1 })}
          className="mt-4 items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
        >
          {starting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-lg font-bold text-white">{actionLabel}</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ opacity: onPress && pressed ? 0.85 : 1 })}
      className="flex-row items-center justify-between rounded-3xl border border-line bg-white px-5 py-4 shadow-sm shadow-brand/20"
    >
      <View className="flex-1 pr-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-bold text-ink">
            {ROUND_TITLE[roundNo]}
          </Text>
          {timing && (
            <View
              className={`rounded-full px-2 py-0.5 ${
                timing === "overdue" ? "bg-red-100" : "bg-amber-100"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  timing === "overdue" ? "text-red-600" : "text-amber-700"
                }`}
              >
                {TIMING_LABEL[timing]}
              </Text>
            </View>
          )}
        </View>
        <Text className="mt-1 text-sm text-ink-soft">
          {round
            ? `${round.correct_count ?? 0} / ${round.total_count} 정답`
            : (retestDescription(roundNo, kind) ?? "아직 시작하지 않았어요")}
        </Text>
      </View>
      <View className="flex-row items-center gap-1">
        <View className={`min-w-[72px] items-center rounded-full px-3 py-1 ${badgeBg}`}>
          <Text className={`text-sm font-bold ${badgeText}`}>{badge}</Text>
        </View>
        {onPress && (
          <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
        )}
      </View>
    </Pressable>
  );
}

export default function TestOverviewScreen() {
  const { setId, kind: kindParam } = useLocalSearchParams<{ setId: string; kind?: string }>();
  // 단어(기본) 외에 어순/순서/문장 배열도 같은 회차 화면을 쓴다.
  const kind: TestKind = isTestKind(kindParam) ? kindParam : "vocab";
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const [{ data: set }, nextStatus] = await Promise.all([
        supabase
          .from(`${kind}_sets`)
          .select("title")
          .eq("id", setId)
          .maybeSingle(),
        getTestStatus(setId, kind),
      ]);
      setTitle(set?.title ?? "");
      setStatus(nextStatus);
    } catch (e) {
      setError(friendlyTestError(e));
    }
  }, [setId, kind]);

  // 문제를 풀고 돌아올 때마다 최신 진행 상황을 다시 불러온다.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const inProgress = status?.rounds.find(
    (round) => round.status === "in_progress",
  );
  // 아직 시작하지 않은 시험(1차·2차). 기한이 지났다면 지각 안내 대상이다.
  const pendingExams = [1, 3].filter(
    (n) => !status?.rounds.some((round) => round.round_no === n),
  );
  const timingOf = (roundNo: number, round: TestRound | undefined): Timing => {
    if (round) return round.is_overdue ? "overdue" : round.is_late ? "late" : null;
    if (!isExamRound(roundNo) || !status) return null;
    return status.is_overdue ? "overdue" : status.is_late ? "late" : null;
  };
  const allDone = status !== null && !inProgress && status.next_round === null;

  const onPrimary = async () => {
    if (!status) return;
    // 단어 외 유형은 회차 번호를 들고 해당 풀이 화면으로 간다(문제는 화면이 서버에서 받는다).
    if (kind !== "vocab") {
      const round = inProgress?.round_no ?? status.next_round;
      if (round) router.push(roundRoute(kind, setId, round));
      return;
    }
    if (inProgress) {
      router.push(`/attempt/${inProgress.attempt_id}`);
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const attemptId = await startAttempt(setId);
      router.push(`/attempt/${attemptId}`);
    } catch (e) {
      setError(friendlyTestError(e));
    } finally {
      setStarting(false);
    }
  };

  const primaryLabel = inProgress
    ? `${ROUND_TITLE[inProgress.round_no]} 이어서 풀기`
    : status?.next_round
      ? status.rounds.length === 0
        ? "테스트 시작"
        : startLabel(status.next_round, kind)
      : "";

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader
        title={kind === "vocab" ? "단어 테스트" : `${KIND_TITLES[kind]} 테스트`}
        back
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="px-6 py-6 gap-6"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
            />
          }
        >
          <View>
            <Text className="text-2xl font-extrabold text-ink">
              {title || "단어장"}
            </Text>
          </View>

          {error && (
            <View className="rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-base font-semibold text-red-500">
                {error}
              </Text>
            </View>
          )}

          {pendingExams.length > 0 && status?.is_overdue && (
            <View className="rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-base font-bold text-red-600">
                기한 초과
              </Text>
              <Text className="mt-0.5 text-sm text-red-600">
                {pendingExams.map((n) => ROUND_TITLE[n]).join("·")} 기한(주차
                종료 후 5일)이 지났어요. 응시할 수 있지만 기한 초과로 표시되고
                점수는 반영돼요.
              </Text>
            </View>
          )}
          {pendingExams.length > 0 && status?.is_late && !status.is_overdue && (
            <View className="rounded-xl bg-amber-50 px-4 py-3">
              <Text className="text-base font-bold text-amber-700">
                지각 응시 안내
              </Text>
              <Text className="mt-0.5 text-sm text-amber-700">
                {pendingExams.map((n) => ROUND_TITLE[n]).join("·")}을(를) 기한
                안에 응시하지 못했어요. 지금 응시하면 지각으로 표시되고 점수는
                반영돼요.
              </Text>
            </View>
          )}

          {status && (
            <>
              <View className="gap-3">
                {/* 응시한 회차(끝낸 것)와 지금 응시할 회차만 순서대로 보인다. 아직 오지 않은 회차와 건너뛴 재시험은 나오지 않는다. */}
                {[1, 2, 3, 4, 5]
                  .filter(
                    (roundNo) =>
                      status.rounds.some(
                        (round) => round.round_no === roundNo,
                      ) ||
                      status.next_round === roundNo,
                  )
                  .map((roundNo) => (
                    <RoundCard
                      key={roundNo}
                      kind={kind}
                      roundNo={roundNo}
                      round={status.rounds.find(
                        (round) => round.round_no === roundNo,
                      )}
                      current={
                        !allDone &&
                        (inProgress
                          ? inProgress.round_no === roundNo
                          : status.next_round === roundNo)
                      }
                      actionLabel={primaryLabel}
                      starting={starting}
                      onStart={onPrimary}
                      onPress={(() => {
                        const done = status.rounds.find(
                          (round) =>
                            round.round_no === roundNo &&
                            round.status === "completed",
                        );
                        // 응시 기록이 있는 회차(단어)만 눌러서 틀린 문제를 본다.
                        return done?.attempt_id
                          ? () => router.push(`/result/${done.attempt_id}`)
                          : undefined;
                      })()}
                      timing={timingOf(
                        roundNo,
                        status.rounds.find(
                          (round) => round.round_no === roundNo,
                        ),
                      )}
                    />
                  ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
