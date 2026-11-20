import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Alert, AlertDescription } from "../ui/alert"
import { Badge } from "../ui/badge"
import { EVIDENCE_COLORS } from "./constants"
import type { CascadeLink } from "@/game/economics/diagnostics/economicCascadeAnalyzer"

interface CascadePanelProps {
  cascade: ReturnType<typeof import("@/game/economics/diagnostics/economicCascadeAnalyzer").EconomicCascadeAnalyzer.prototype.analyze> | null
}

export function CascadePanel({ cascade }: CascadePanelProps) {
  const activeCascades = cascade?.cascades.filter(c => c.status === "active") ?? []
  const allCascades = cascade?.cascades ?? []

  const cascadeLinks: (CascadeLink & { fromCascadeId: string })[] = []
  for (const c of allCascades) {
    for (const link of c.links) {
      cascadeLinks.push({ ...link, fromCascadeId: c.id })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Economic Cascades</h3>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-red-500/20 text-red-400">
            Active: {activeCascades.length}
          </Badge>
          <Badge variant="outline" className="bg-green-500/20 text-green-400">
            Resolved: {cascade?.summary.resolvedCascades ?? 0}
          </Badge>
          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400">
            Escalating: {cascade?.summary.escalatingCascades ?? 0}
          </Badge>
        </div>
      </div>

      {activeCascades.length === 0 && allCascades.length === 0 ? (
        <Alert className="bg-green-500/10 border-green-500/20">
          <AlertDescription>No economic cascades detected.</AlertDescription>
        </Alert>
      ) : (
        <>
          {activeCascades.map((c, i) => (
            <Card key={i} className="border-red-500/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{c.narrative}</CardTitle>
                  <Badge variant="outline" className={c.status === "escalating" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}>
                    {c.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Root cause: {c.rootCause.description} (tick {c.rootCause.firstDetectedTick})
                </div>
                <div className="text-sm">
                  <strong>Nodes:</strong> {c.nodes.map(n => `${n.type}${n.good ? `(${n.good})` : ""}${n.sector ? ` [${n.sector}]` : ""}`).join(" → ")}
                </div>
                <div className="text-sm">
                  <strong>Links:</strong> {c.links.map(l => `${l.fromProblem} → ${l.toProblem} [${l.evidenceLevel}]`).join("; ")}
                </div>
              </CardContent>
            </Card>
          ))}
          {cascadeLinks.length > 0 && (
            <Card>
              <CardHeader><CardTitle>All Cascade Links (Evidence)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cascadeLinks.map((link, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{link.fromProblem}</TableCell>
                        <TableCell className="font-mono">{link.toProblem}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={EVIDENCE_COLORS[link.evidenceLevel as keyof typeof EVIDENCE_COLORS]}>
                            {link.evidenceLevel.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{(link.confidence * 100).toFixed(0)}%</TableCell>
                        <TableCell className="max-w-[300px] truncate">{link.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}