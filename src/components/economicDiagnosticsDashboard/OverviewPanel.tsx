import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { formatNumber, SEVERITY_COLORS } from "./constants"

interface OverviewCardsProps {
  health: ReturnType<typeof import("@/game/economics/diagnostics/economicHealthMetrics").EconomicHealthMetrics.prototype.getLatestSnapshot> | null
  market: ReturnType<typeof import("@/game/economics/diagnostics/marketStabilityAnalyzer").MarketStabilityAnalyzer.prototype.analyze> | null
  industry: ReturnType<typeof import("@/game/economics/diagnostics/industryHealthAnalyzer").IndustryHealthAnalyzer.prototype.analyze> | null
  household: ReturnType<typeof import("@/game/economics/diagnostics/householdHealthAnalyzer").HouseholdHealthAnalyzer.prototype.analyze> | null
  cascade?: ReturnType<typeof import("@/game/economics/diagnostics/economicCascadeAnalyzer").EconomicCascadeAnalyzer.prototype.analyze> | null
}

function getBorderClass(severity: string): string {
  const colorString = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]
  // Extract border color (e.g., "border-blue-500/30" -> "blue-500/30")
  const borderMatch = colorString?.match(/border-([^\s]+)/)
  return borderMatch ? `border-${borderMatch[1]}` : "border-neutral-800"
}

export function OverviewPanel({ health, market, industry, household, cascade }: OverviewCardsProps) {
  const cards = []

  if (health && market) {
    cards.push({
      title: "Economic Health",
      value: market.summary.goodsWithShortage > 0 ? "Stressed" : "Stable",
      details: `${market.summary.goodsWithShortage} shortages, ${market.summary.goodsWithSurplus} surpluses`,
      severity: market.summary.goodsWithShortage > 5 ? "critical" : market.summary.goodsWithShortage > 0 ? "warning" : "info",
    })
  }
  if (industry) {
    cards.push({
      title: "Industry Status",
      value: industry.summary.inactive > 0 ? `${industry.summary.inactive} Stopped` : "Operational",
      details: `${industry.summary.healthy} healthy, ${industry.summary.unprofitable} unprofitable, ${industry.summary.resourceConstrained} constrained`,
      severity: industry.summary.inactive > 3 ? "critical" : industry.summary.unprofitable > 3 ? "warning" : "info",
    })
  }
  if (household) {
    cards.push({
      title: "Households",
      value: household.summary.destitute > 0 ? "Critical" : household.summary.stressed > 0 ? "Stressed" : "Stable",
      details: `${household.summary.prosperous} prosperous, ${household.summary.stable} stable, ${household.summary.stressed} stressed, ${household.summary.destitute} destitute`,
      severity: household.summary.destitute > 0 ? "critical" : household.summary.stressed > 2 ? "warning" : "info",
    })
  }
  if (health) {
    cards.push({
      title: "Treasury",
      value: health.treasury.runway ? `${health.treasury.runway.toFixed(0)} ticks` : "Infinite",
      details: `Balance: ${formatNumber(health.treasury.balance)}, Outflow: ${formatNumber(health.treasury.subsidyOutflowRate + health.treasury.otherOutflowRate)}/tick`,
      severity: health.treasury.runway && health.treasury.runway < 20 ? "critical" : health.treasury.runway && health.treasury.runway < 50 ? "warning" : "info",
    })
  }
  if (cascade) {
    cards.push({
      title: "Active Cascades",
      value: cascade.summary.activeCascades.toString(),
      details: `${cascade.summary.resolvedCascades} resolved, ${cascade.summary.escalatingCascades} escalating`,
      severity: cascade.summary.escalatingCascades > 0 ? "critical" : cascade.summary.activeCascades > 2 ? "warning" : "info",
    })
  }

  if (cards.length === 0) {
    return <div className="text-center text-muted-foreground py-8">No data available yet</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {cards.map((card, i) => (
          <Card key={i} className={getBorderClass(card.severity)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs text-muted-foreground">{card.details}</div>
              <Badge
                variant="outline"
                className={SEVERITY_COLORS[card.severity as keyof typeof SEVERITY_COLORS]}
              >
                {card.severity}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}