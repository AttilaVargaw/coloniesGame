import { convertToReadable } from "@/lib/utils";

export const colorBySign = (v: number) => (
    <span style={{ color: v > 0 ? "#4ade80" : "#f87171" }}>
        {convertToReadable(v)}
    </span>
);
