import { EconomicHealthSnapshot } from "@/game/economics/diagnostics/economicHealthMetrics"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { formatNumber } from "./constants"

interface TreasuryPanelProps {
  health: EconomicHealthSnapshot | null
}

export function TreasuryPanel({ health }: TreasuryPanelProps) {
  if(!health) return <div className="text-center text-muted-foreground py-8">No treasury data available</div>

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Balance</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{formatNumber(health.treasury.balance)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Subsidy Outflow</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-red-400">{formatNumber(health.treasury.subsidyOutflowRate)}/tick</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Other Outflow</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-orange-400">{formatNumber(health.treasury.otherOutflowRate)}/tick</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Inflow</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-green-400">{formatNumber(health.treasury.inflowRate)}/tick</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Financial Runway</CardTitle></CardHeader>
        <CardContent>
          {health.treasury.runway ? (
            <>
              <div className="text-3xl font-bold">
                {health.treasury.runway < 20 ? "⚠️ " : ""}
                {health.treasury.runway.toFixed(0)} ticks remaining
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                At current outflow rate (subsidies: {formatNumber(health.treasury.subsidyOutflowRate)}, other: {formatNumber(health.treasury.otherOutflowRate)}/tick)
              </div>
            </>
          ) : (
            <div className="text-3xl font-bold text-green-400">Infinite (positive net flow)</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}