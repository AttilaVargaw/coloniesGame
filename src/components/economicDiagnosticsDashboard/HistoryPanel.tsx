import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Alert, AlertDescription } from "../ui/alert"
import { EconomicHealthSnapshot } from "@/game/economics/diagnostics/economicHealthMetrics"

interface HistoryPanelProps {
  health: EconomicHealthSnapshot | null
  historyLength: number
}

export function HistoryPanel({ health, historyLength }: HistoryPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Diagnostic History</h3>
        <div className="text-sm text-muted-foreground">
          Showing last {historyLength} ticks (adjustable above)
        </div>
      </div>
      <Alert className="bg-blue-500/10 border-blue-500/20">
        <AlertDescription>
          Historical time-series charts for market prices, industry health, household metrics, and cascade progression
          will be rendered here using the history buffers from each diagnostic analyzer.
        </AlertDescription>
      </Alert>
      {health && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Price Volatility (Last {historyLength} Ticks)</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs bg-[#0a0a0a] p-3 rounded overflow-auto max-h-[300px]">
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(health.prices.byGood)
                      .filter(([, v]) => v.volatility !== null)
                      .map(([k, v]) => [k, { volatility: v.volatility?.toFixed(4), current: v.currentPrice, change: v.priceChangePct.toFixed(4) }])
                  ),
                  null,
                  2
                )}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Treasury History (Last {historyLength} Ticks)</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs bg-[#0a0a0a] p-3 rounded overflow-auto max-h-[300px]">
                {JSON.stringify(
                  health.treasury,
                  null,
                  2
                )}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}