import { IndustryComponent } from "@/game/components/industryComponent";
import { convertToReadable } from "@/lib/utils";

export function IndustryBreakdown({ industry: { sectors } }: { industry: IndustryComponent; }) {
    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-muted">
                    <th className="text-left p-2 font-medium">Sector</th>
                    <th className="text-center p-2 font-medium">Level</th>
                </tr>
            </thead>
            <tbody>
                {Object.entries((sectors)).map(([key, value]) => <tr key={key} className="border-b border-muted/50 last:border-0">
                    <td className="p-2 capitalize">{key}</td>
                    <td className="p-2 text-center">{convertToReadable(value)}</td>
                </tr>
                )}
            </tbody>
        </table>
    );
}
