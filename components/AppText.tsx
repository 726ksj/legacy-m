import { Text as RNText, type TextProps } from "react-native";

// 앱 전체 글꼴(Pretendard). 굵기마다 폰트 파일이 따로라서, className에 든 font-* 굵기에
// 맞는 폰트를 골라 적용한다. 굵기 클래스가 없으면 Regular.
export const FONT = {
  regular: "Pretendard-Regular",
  medium: "Pretendard-Medium",
  semibold: "Pretendard-SemiBold",
  bold: "Pretendard-Bold",
  extrabold: "Pretendard-ExtraBold",
} as const;

export function fontFor(className?: string) {
  if (!className) return FONT.regular;
  if (/\bfont-(extrabold|black)\b/.test(className)) return FONT.extrabold;
  if (/\bfont-bold\b/.test(className)) return FONT.bold;
  if (/\bfont-semibold\b/.test(className)) return FONT.semibold;
  if (/\bfont-medium\b/.test(className)) return FONT.medium;
  return FONT.regular;
}

export function Text({
  className,
  style,
  ...props
}: TextProps & { className?: string }) {
  return (
    <RNText
      {...props}
      className={className}
      // 굵기는 폰트 파일이 이미 갖고 있다. font-bold 같은 클래스의 fontWeight가 남으면
      // 웹/안드로이드가 그 위에 한 번 더 굵게 칠하므로 normal로 덮는다.
      style={[{ fontFamily: fontFor(className), fontWeight: "normal" }, style]}
    />
  );
}
