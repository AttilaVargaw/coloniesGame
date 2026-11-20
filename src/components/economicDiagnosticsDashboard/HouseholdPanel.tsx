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
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Wealth</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Affordability</TableHead>
              <TableHead>QoL</TableHead>
              <TableHead>Purchasing Power</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.map((assessment, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono capitalize">{assessment.category}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={HOUSEHOLD_STATUS_COLORS[assessment.status]}>
                    {assessment.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatNumber(assessment.cashWealth)}</TableCell>
                <TableCell>{formatPct(assessment.consumptionFulfillmentRatio)}</TableCell>
                <TableCell>{formatPct(assessment.affordabilityRatio)}</TableCell>
                <TableCell>{assessment.qol.toFixed(1)} / {assessment.expectedQol.toFixed(1)}</TableCell>
                <TableCell>{formatPct(assessment.purchasingPower)}</TableCell>
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