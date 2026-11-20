import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Alert, AlertDescription } from "../ui/alert"
import { Badge } from "../ui/badge"
import { formatNumber, formatPct, HOUSEHOLD_STATUS_COLORS } from "./constants"

interface HouseholdPanelProps {
  household: ReturnType<typeof import("@/game/economics/diagnostics/householdHealthAnalyzer").HouseholdHealthAnalyzer.prototype.analyze> | null
}

export function HouseholdPanel({ household }: HouseholdPanelProps) {
  const assessments = household?.assessments ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Household Health Assessments</h3>
        <div className="flex gap-2">
          {["prosperous", "stable", "stressed", "destitute"].map(status => (
            <Badge
              key={status}
              variant="outline"
              className={HOUSEHOLD_STATUS_COLORS[status as keyof typeof HOUSEHOLD_STATUS_COLORS]}
            >
              {status}: {assessments.filter(a => a.status === status).length}
            </Badge>
          ))}
        </div>
      </div>
      {assessments.length === 0 ? (
        <Alert className="bg-gray-500/10 border-gray-500/20">
          <AlertDescription>No household data available.</AlertDescription>
        </Alert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b border-muted">
              <TableHead className="text-left p-2 font-medium">Category</TableHead>
              <TableHead className="text-center p-2 font-medium">Status</TableHead>
              <TableHead className="text-right p-2 font-medium">Wealth</TableHead>
              <TableHead className="text-right p-2 font-medium">Fulfillment</TableHead>
              <TableHead className="text-right p-2 font-medium">Affordability</TableHead>
              <TableHead className="text-right p-2 font-medium">QoL</TableHead>
              <TableHead className="text-right p-2 font-medium">Purchasing Power</TableHead>
              <TableHead className="text-left p-2 font-medium">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.map((assessment, i) => (
              <TableRow key={i} className="border-b border-muted/50 last:border-0">
                <TableCell className="font-mono capitalize p-2 text-left">{assessment.category}</TableCell>
                <TableCell className="p-2 text-center">
                  <Badge variant="outline" className={HOUSEHOLD_STATUS_COLORS[assessment.status]}>
                    {assessment.status}
                  </Badge>
                </TableCell>
                <TableCell className="p-2 text-right">{formatNumber(assessment.cashWealth)}</TableCell>
                <TableCell className="p-2 text-right">{formatPct(assessment.consumptionFulfillmentRatio)}</TableCell>
                <TableCell className="p-2 text-right">{formatPct(assessment.affordabilityRatio)}</TableCell>
                <TableCell className="p-2 text-right">{assessment.qol.toFixed(1)} / {assessment.expectedQol.toFixed(1)}</TableCell>
                <TableCell className="p-2 text-right">{formatPct(assessment.purchasingPower)}</TableCell>
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