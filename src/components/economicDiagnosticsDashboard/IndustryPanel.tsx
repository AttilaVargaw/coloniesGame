import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Alert, AlertDescription } from "../ui/alert"
import { Badge } from "../ui/badge"
import { formatNumber, formatPct, STATUS_COLORS } from "./constants"

interface IndustryPanelProps {
  industry: ReturnType<typeof import("@/game/economics/diagnostics/industryHealthAnalyzer").IndustryHealthAnalyzer.prototype.analyze> | null
}

export function IndustryPanel({ industry }: IndustryPanelProps) {
  const assessments = industry?.assessments ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Industry Health Assessments</h3>
        <div className="flex gap-2">
          {["healthy", "under_pressure", "unprofitable", "resource_constrained", "inactive"].map(status => (
            <Badge
              key={status}
              variant="outline"
              className={STATUS_COLORS[status as keyof typeof STATUS_COLORS]}
            >
              {status}: {assessments.filter(a => a.status === status).length}
            </Badge>
          ))}
        </div>
      </div>
      {assessments.length === 0 ? (
        <Alert className="bg-gray-500/10 border-gray-500/20">
          <AlertDescription>No industry data available.</AlertDescription>
        </Alert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b border-muted">
              <TableHead className="text-left p-2 font-medium">Sector</TableHead>
              <TableHead className="text-center p-2 font-medium">Status</TableHead>
              <TableHead className="text-right p-2 font-medium">Pre-Subsidy Result</TableHead>
              <TableHead className="text-right p-2 font-medium">Post-Subsidy Result</TableHead>
              <TableHead className="text-right p-2 font-medium">Utilization</TableHead>
              <TableHead className="text-right p-2 font-medium">Input Avail.</TableHead>
              <TableHead className="text-right p-2 font-medium">Labor Avail.</TableHead>
              <TableHead className="text-center p-2 font-medium">Stopped</TableHead>
              <TableHead className="text-left p-2 font-medium">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.map((assessment, i) => (
              <TableRow key={i} className="border-b border-muted/50 last:border-0">
                <TableCell className="font-mono p-2 text-left">{assessment.sectorId}</TableCell>
                <TableCell className="p-2 text-center">
                  <Badge variant="outline" className={STATUS_COLORS[assessment.status]}>
                    {assessment.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell className={`p-2 text-right ${assessment.operatingResultPreSubsidy < 0 ? "text-red-400" : "text-green-400"}`}>
                  {formatNumber(assessment.operatingResultPreSubsidy)}
                </TableCell>
                <TableCell className={`p-2 text-right ${assessment.operatingResultPostSubsidy < 0 ? "text-red-400" : "text-green-400"}`}>
                  {formatNumber(assessment.operatingResultPostSubsidy)}
                </TableCell>
                <TableCell className="p-2 text-right">{formatPct(assessment.utilization)}</TableCell>
                <TableCell className="p-2 text-right">{formatPct(assessment.inputAvailabilityScore)}</TableCell>
                <TableCell className="p-2 text-right">{formatPct(assessment.laborAvailabilityScore)}</TableCell>
                <TableCell className="p-2 text-center">{assessment.consecutiveStoppedTicks > 0 ? assessment.consecutiveStoppedTicks : "-"}</TableCell>
                <TableCell className="p-2 text-left max-w-[300px] truncate">
                  {assessment.assessmentDetails.join("; ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}