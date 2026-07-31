import { IndustryComponent } from "@/game/components/industryComponent";
import { convertToReadable } from "@/lib/utils";

export function IndustryBreakdown({ industry: { sectors } }: { industry: IndustryComponent; }) {
    return (
        <table style={{ width: "100%" }}>
            <thead>
                <tr>
                    <th>Sector</th>
                    <th>Level</th>
                </tr>
            </thead>
            <tbody>
                {Object.entries((sectors)).map(([key, value]) => <tr key={key}>
                    <td>{key}</td><td style={{ textAlign: "center" }}>{convertToReadable(value)}</td>
                </tr>
                )}
            </tbody>
        </table>
    );
}
