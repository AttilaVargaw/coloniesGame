import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface OptionItem {
    id: string;
    label: string;
    description: string;
}

interface SelectOptionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    options: OptionItem[];
    onSelect: (id: string) => void;
}

export function SelectOptionModal({ open, onOpenChange, title, options, onSelect }: SelectOptionModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-4 pt-4">
                    {options.map((option) => (
                        <div
                            key={option.id}
                            className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-800/40 p-4"
                        >
                            <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-neutral-700">
                                <span className="font-mono text-sm text-neutral-400">PIC</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-medium">{option.label}</span>
                                <p className="text-xs text-neutral-400">{option.description}</p>
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="mx-auto mt-auto"
                                onClick={() => onSelect(option.id)}
                            >
                                <Plus className="size-5" />
                            </Button>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
