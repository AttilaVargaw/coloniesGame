import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Alert, AlertDescription } from "../ui/alert"
import { Badge } from "../ui/badge"
import { SEVERITY_COLORS } from "./constants"

interface MarketPanelProps {
  market: ReturnType<typeof import("@/game/economics/diagnostics/marketStabilityAnalyzer").MarketStabilityAnalyzer.prototype.analyze> | null
}

export function MarketPanel({ market }: MarketPanelProps) {
  const alerts = market?.alerts ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Market Stability Alerts</h3>
        <Badge variant="outline" className={alerts.length > 0 ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}>
          {alerts.length} alerts
        </Badge>
      </div>
      {alerts.length === 0 ? (
        <Alert className="bg-green-500/10 border-green-500/20">
          <AlertDescription>No market stability alerts detected.</AlertDescription>
        </Alert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b border-muted">
              <TableHead className="text-left p-2 font-medium">Good</TableHead>
              <TableHead className="text-left p-2 font-medium">Type</TableHead>
              <TableHead className="text-center p-2 font-medium">Severity</TableHead>
              <TableHead className="text-center p-2 font-medium">Duration</TableHead>
              <TableHead className="text-left p-2 font-medium">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert, i) => (
              <TableRow key={i} className="border-b border-muted/50 last:border-0">
                <TableCell className="font-mono p-2 text-left">{alert.good}</TableCell>
                <TableCell className="p-2 text-left">{alert.type.replace(/_/g, " ")}</TableCell>
                <TableCell className="p-2 text-center">
                  <Badge variant="outline" className={SEVERITY_COLORS[alert.severity]}>
                    {alert.severity}
                  </Badge>
                </TableCell>
                <TableCell className="p-2 text-center">{alert.consecutiveTicks} ticks</TableCell>
                <TableCell className="p-2 text-left max-w-[300px] truncate">{alert.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}