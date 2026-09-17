import { convertToReadable } from "@/lib/utils";

export const colorBySign = (v: number) => <span color={v > 0 ? "green" : "red"}>
    {convertToReadable(v)}
</span>;
