/**
 * Tab bar icons, drawn to match the Midnight Glass mockup (same as the website).
 */
import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type TabIconName = "home" | "chat" | "studio" | "games" | "you";

export function TabIcon({ name, color, size = 22 }: { name: TabIconName; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" && <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" {...p} />}
      {name === "chat" && <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" {...p} />}
      {name === "studio" && <Path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" {...p} />}
      {name === "games" && (
        <>
          <Rect x={2.5} y={7} width={19} height={11} rx={5.5} {...p} />
          <Path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01" {...p} />
        </>
      )}
      {name === "you" && (
        <>
          <Circle cx={12} cy={8} r={4} {...p} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...p} />
        </>
      )}
    </Svg>
  );
}
