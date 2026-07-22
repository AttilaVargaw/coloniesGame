import { Plus, ChevronLeft, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "../ui/button";
import { SelectOptionModal } from "../selectOptionModal/selectOptionModal";

interface QueueItem {
    id: number;
    name: string;
    imageUrl: string;
    totalDays: number;
    remainingDays: number;
}

interface ProductionLine {
    name: string;
    queue: QueueItem[];
}

interface ProductionBarProps {
    lines: ProductionLine[];
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    onAdd?: () => void;
}

export function ProductionBar({ lines, collapsed = false, onToggleCollapse, onAdd }: ProductionBarProps) {
    const [openLines, setOpenLines] = useState<Set<number>>(new Set(lines.map((_, idx) => idx)));
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);

    const toggleLine = (idx: number) => {
        setOpenLines(prev => {
            const next = new Set(prev);
            if(next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const handleOpenModal = (idx: number) => {
        setActiveLineIndex(idx);
        if (!onAdd) setIsModalOpen(true);
    };

    const modalOptions = activeLineIndex !== null ? [
        { id: "a", label: "Heavy Cruiser", description: "High armor, long build time" },
        { id: "b", label: "Light Cruiser", description: "Balanced speed and firepower" },
        { id: "c", label: "Destroyer", description: "Fast, agile escort" },
    ] : [];

    return (
        <div className="relative flex h-full flex-col gap-4 overflow-hidden border border-neutral-700 bg-neutral-900 p-4 text-neutral-100 shadow-lg transition-all duration-200">
            {/* Expanded content */}
            <div
                className={`absolute inset-0 flex h-full flex-col gap-4 overflow-y-auto p-4 transition-opacity duration-200 ${collapsed ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"}`}
            >
                <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold tracking-wide">Production</span>
                    {onToggleCollapse && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggleCollapse}
                            aria-label="Collapse sidebar"
                        >
                            <ChevronLeft className="size-5 rotate-180" aria-hidden="true" />
                        </Button>
                    )}
                </div>

                {lines.map(({ name, queue }, idx) => {
                    const isOpen = openLines.has(idx);

                    return (
                        <div key={name} className="flex flex-col gap-3 rounded-md border border-neutral-800 bg-neutral-800/40 p-4">
                            <button
                                type="button"
                                onClick={() => toggleLine(idx)}
                                className="flex w-full items-center justify-between gap-2 text-left"
                            >
                                <div className="flex items-center gap-2 text-lg font-semibold tracking-wide">
                                    <ChevronDown
                                        className={`size-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                        aria-hidden="true"
                                    />
                                    <span>{name}</span>
                                </div>
                            </button>

                            {isOpen && (
                                <>
                                    <div className="flex flex-col gap-3">
                                        {queue.map((item) => {
                                            const progress =
                                                item.totalDays > 0
                                                    ? ((item.totalDays - item.remainingDays) / item.totalDays) * 100
                                                    : 0;

                                            return (
                                                <div
                                                    key={item.id}
                                                    className="flex items-stretch gap-3 rounded-md border border-neutral-800 bg-neutral-800/40 p-3"
                                                >
                                                    <div className="flex size-16 shrink-0 items-center justify-center rounded bg-neutral-700">
                                                        {item.imageUrl ? (
                                                            <img
                                                                src={item.imageUrl}
                                                                alt={item.name}
                                                                className="size-full rounded object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-xs text-neutral-400">unit pic</span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-1 flex-col justify-center gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium">{item.name}</span>
                                                            <Badge className="h-5 px-1.5 py-0 font-mono text-[0.7rem]">
                                                                {item.remainingDays}d left
                                                            </Badge>
                                                        </div>

                                                        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-700">
                                                            <div
                                                                className="h-full rounded-full bg-neutral-200 transition-all"
                                                                style={{ width: `${Math.min(progress, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex justify-center">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handleOpenModal(idx)}
                                            aria-label="Add production item"
                                        >
                                            <Plus className="size-5" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Collapsed content */}
            <div
                className={`absolute inset-0 flex flex-col items-center gap-4 rounded-lg bg-neutral-900 p-2 transition-opacity duration-200 ${!collapsed ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"}`}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleCollapse}
                    aria-label="Expand sidebar"
                    className="shrink-0"
                >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                </Button>
            </div>

            <SelectOptionModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                title="Add Unit"
                options={modalOptions}
                onSelect={(id) => {
                    console.log("Selected:", id, "for line:", activeLineIndex);
                    setIsModalOpen(false);
                }}
            />
        </div>
    );
}
