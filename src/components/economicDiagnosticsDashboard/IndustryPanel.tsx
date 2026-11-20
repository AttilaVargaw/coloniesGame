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
            <TableRow>
              <TableHead>Sector</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pre-Subsidy Result</TableHead>
              <TableHead>Post-Subsidy Result</TableHead>
              <TableHead>Utilization</TableHead>
              <TableHead>Input Avail.</TableHead>
              <TableHead>Labor Avail.</TableHead>
              <TableHead>Stopped</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.map((assessment, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono">{assessment.sectorId}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_COLORS[assessment.status]}>
                    {assessment.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell className={assessment.operatingResultPreSubsidy < 0 ? "text-red-400" : "text-green-400"}>
                  {formatNumber(assessment.operatingResultPreSubsidy)}
                </TableCell>
                <TableCell className={assessment.operatingResultPostSubsidy < 0 ? "text-red-400" : "text-green-400"}>
                  {formatNumber(assessment.operatingResultPostSubsidy)}
                </TableCell>
                <TableCell>{formatPct(assessment.utilization)}</TableCell>
                <TableCell>{formatPct(assessment.inputAvailabilityScore)}</TableCell>
                <TableCell>{formatPct(assessment.laborAvailabilityScore)}</TableCell>
                <TableCell>{assessment.consecutiveStoppedTicks > 0 ? assessment.consecutiveStoppedTicks : "-"}</TableCell>
                <TableCell className="max-w-[300px] truncate">
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