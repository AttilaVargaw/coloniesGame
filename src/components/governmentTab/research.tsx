import { TechResearchComponent } from "@/game/components/TechResearchComponent";
import { techs, getTech, type Age, type TechType, techByAge } from "@/game/data/Techs";
import { ResearchCommand, CancelResearchCommand } from "@/game/commands/ResearchCommand";
import { DayPassedEvent } from "@/engine/lib/events";
import { TechResearchedEvent } from "@/game/events/techEvents";
import { Entity } from "@/engine/entities/entity";
import { useGameEngine } from "@/hooks/useGameContext";
import { useGameEvent } from "@/hooks/useGameEvent";
import { Button } from "../ui/button";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

const nodeWidth = 230
const nodeHeight = 64
const levelHeight = 140
const minLevelGap = 34
const maxLevelGap = 64

const typeColors: Record<TechType, string> = {
    archeological: "#8b5cf6",
    technological: "#3b82f6",
    military: "#ef4444",
    diplomatic: "#f59e0b",
} as const

type NodeState = {
    tech: typeof techs[string]
    isResearched: boolean
    isCurrent: boolean
    isAvailable: boolean
    prereqsMet: boolean
}

function nodeState(id: string, researched: Set<string>, currentTech?: string): NodeState {
    const tech = techs[id]
    const isResearched = researched.has(id)
    const isCurrent = currentTech === id
    const prereqs = tech.prerequisites ?? new Set<string>()
    const prereqsMet = [...prereqs].every((p) => researched.has(p))
    return { tech, isResearched, isCurrent, isAvailable: !isResearched && !isCurrent && prereqsMet, prereqsMet }
}

function nodeFill(s: NodeState) {
    if(s.isResearched) return "#16a34a"
    if(s.isCurrent) return "#2563eb"
    if(s.isAvailable) return "#f8fafc"
    return "#4b5563"
}

function nodeTextFill(s: NodeState) {
    if(s.isResearched || s.isCurrent) return "#ffffff"
    if(s.isAvailable) return "#0f172a"
    return "#9ca3af"
}

function nodeBorder(s: NodeState) {
    if(s.isResearched) return "#16a34a"
    if(s.isCurrent) return "#2563eb"
    if(s.isAvailable) return "#94a3b8"
    return "#6b7280"
}

function typeAccent(tech: typeof techs[string]) {
    return typeColors[tech.type]
}

function prerequisiteDepths(parents: Map<string, Set<string>>, ids: string[]): Map<string, number> {
    const depth = new Map<string, number>()
    const visiting = new Set<string>()

    const depthOf = (id: string): number => {
        if(depth.has(id)) return depth.get(id)!
        if(visiting.has(id)) return 0
        visiting.add(id)
        const ps = parents.get(id)
        let d = 0
        if(ps?.size) {
            d = 1 + Math.max(...[...ps].map(depthOf))
        }
        visiting.delete(id)
        depth.set(id, d)
        return d
    }

    for(const id of ids) depthOf(id)
    return depth
}

function buildGraph(ids: string[]): { parents: Map<string, Set<string>>; children: Map<string, Set<string>> } {
    const parents = new Map<string, Set<string>>()
    const children = new Map<string, Set<string>>()
    for(const id of ids) {
        parents.set(id, techs[id]?.prerequisites ?? new Set<string>())
        children.set(id, new Set<string>())
    }
    for(const [id, ps] of parents) {
        for(const p of ps) {
            children.get(p)?.add(id)
        }
    }
    return { parents, children }
}

function countCrossingsBetween(parents: Map<string, Set<string>>, topIds: string[], bottomIds: string[]): number {
    const topPos = new Map<string, number>()
    topIds.forEach((id, i) => topPos.set(id, i))
    const bottomPos = new Map<string, number>()
    bottomIds.forEach((id, i) => bottomPos.set(id, i))
    const edges: [number, number][] = []
    for(const child of bottomIds) {
        const ps = parents.get(child)!
        for(const p of ps) {
            if(topPos.has(p) && bottomPos.has(child)) {
                edges.push([topPos.get(p)!, bottomPos.get(child)!])
            }
        }
    }
    let crossings = 0
    for(let i = 0; i < edges.length; i++) {
        for(let j = i + 1; j < edges.length; j++) {
            const [a1, b1] = edges[i]
            const [a2, b2] = edges[j]
            if((a1 < a2 && b1 > b2) || (a1 > a2 && b1 < b2)) crossings++
        }
    }
    return crossings
}

function countTotalCrossings(parents: Map<string, Set<string>>, sortedLevels: [number, string[]][], order: Map<number, string[]>): number {
    let total = 0
    for(let i = 1; i < sortedLevels.length; i++) {
        const prev = order.get(sortedLevels[i - 1][0])!
        const curr = order.get(sortedLevels[i][0])!
        total += countCrossingsBetween(parents, prev, curr)
    }
    return total
}

function barycenterOrder(
    parents: Map<string, Set<string>>,
    children: Map<string, Set<string>>,
    techLevel: Map<string, number>,
    sortedLevels: [number, string[]][],
    order: Map<number, string[]>,
): void {
    const indexOf = (id: string): number => {
        const lvl = techLevel.get(id)!
        return order.get(lvl)!.indexOf(id)
    }

    for(let pass = 0; pass < 10; pass++) {
        const forward = pass % 2 === 0
        const iterate = forward ? sortedLevels : [...sortedLevels].reverse()
        for(const [lvl, ids] of iterate) {
            const dir = forward ? -1 : 1
            const withBary = ids.map((id) => {
                let sum = 0
                let count = 0
                const nbrs = dir === -1 ? parents.get(id) : children.get(id)
                for(const n of nbrs!) {
                    const nlvl = techLevel.get(n)!
                    if(nlvl !== lvl + dir) continue
                    const idx = indexOf(n)
                    if(idx >= 0) { sum += idx; count++ }
                }
                const bary = count ? sum / count : indexOf(id)
                return { id, bary, type: techs[id].type }
            })
            withBary.sort((a, b) => {
                if(a.type !== b.type) return a.type.localeCompare(b.type)
                return a.bary - b.bary || a.id.localeCompare(b.id)
            })
            order.set(lvl, withBary.map(({ id }) => id))
        }
    }
}

function siftOrder(
    parents: Map<string, Set<string>>,
    techLevel: Map<string, number>,
    sortedLevels: [number, string[]][],
    order: Map<number, string[]>,
): void {
    let improved = true
    let siftPass = 0
    while(improved && siftPass < 15) {
        improved = false
        siftPass++
        const before = countTotalCrossings(parents, sortedLevels, order)
        for(const [lvl] of sortedLevels) {
            let ids = order.get(lvl)!
            for(let si = 0; si < ids.length; si++) {
                const id = ids[si]
                let bestPos = si
                let bestCross = Infinity
                let bestOrder: string[] | null = null

                const lvlNum = techLevel.get(id)!
                const prevIds = lvlNum > 0 ? order.get(lvlNum - 1) ?? null : null
                const nextIds = order.get(lvlNum + 1) ?? null

                for(let ti = 0; ti < ids.length; ti++) {
                    if(ti === si) continue
                    const reordered = [...ids]
                    reordered.splice(si, 1)
                    reordered.splice(ti, 0, id)
                    let cross = 0
                    if(prevIds) cross += countCrossingsBetween(parents, prevIds, reordered)
                    if(nextIds) cross += countCrossingsBetween(parents, reordered, nextIds)
                    if(cross < bestCross) { bestCross = cross; bestPos = ti; bestOrder = reordered }
                }

                if(bestOrder && bestPos !== si) {
                    order.set(lvl, bestOrder)
                    ids = bestOrder
                    improved = true
                }
            }
        }
        const after = countTotalCrossings(parents, sortedLevels, order)
        if(after >= before) break
    }
}

function computeLayout(techsRecord: Record<string, typeof techs[string]>): {
    sortedLevels: [number, string[]][]
    positions: Map<string, { x: number; y: number }>
    edges: { points: { x: number; y: number }[] }[]
    maxLevelWidth: number
} {
    const ageOrder: Age[] = ["earlySpaceTravel", "rediscovery", "imperial", "techRevolution", "unification", "night"]
    const ageIndex = (age: Age) => ageOrder.indexOf(age)
    const allIds = Object.keys(techsRecord)

    const { parents, children } = buildGraph(allIds)

    // Prerequisite depth: longest path from a root (no-prereq) node.
    const prereqDepth = prerequisiteDepths(parents, allIds)
    const maxDepth = Math.max(0, ...[...prereqDepth.values()])

    // Combined level: age band is the coarse row, prerequisite depth refines
    // position within the band so a prerequisite always sits above its dependent.
    const techLevel = new Map<string, number>()
    for(const id of allIds) {
        techLevel.set(id, ageIndex(techsRecord[id].age) * (maxDepth + 1) + prereqDepth.get(id)!)
    }

    const levels = new Map<number, string[]>()
    for(const [id, lvl] of techLevel) {
        if(!levels.has(lvl)) levels.set(lvl, [])
        levels.get(lvl)!.push(id)
    }

    const sortedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0])

    // Initial ordering: group by type, then alphabetical, within level
    const order = new Map<number, string[]>()
    sortedLevels.forEach(([lvl, ids]) => {
        order.set(lvl, [...ids].sort((a, b) => {
            const ta = techsRecord[a].type
            const tb = techsRecord[b].type
            if(ta !== tb) return ta.localeCompare(tb)
            return a.localeCompare(b)
        }))
    })

    barycenterOrder(parents, children, techLevel, sortedLevels, order)
    siftOrder(parents, techLevel, sortedLevels, order)

    // Per-level dynamic gap: fewer nodes = wider spacing, more nodes = tighter,
    // clamped to [minLevelGap, maxLevelGap]. Each level is centered within the
    // widest level so sparse bands don't look lopsided.
    let maxLevelWidth = 0
    const levelWidths = new Map<number, number>()
    const levelGaps = new Map<number, number>()
    sortedLevels.forEach(([lvl, ids]) => {
        const gap = Math.min(maxLevelGap, Math.max(minLevelGap, ids.length > 1 ? 240 / (ids.length - 1) : minLevelGap))
        levelGaps.set(lvl, gap)
        const width = ids.length * nodeWidth + Math.max(0, ids.length - 1) * gap
        levelWidths.set(lvl, width)
        maxLevelWidth = Math.max(maxLevelWidth, width)
    })

    const positions = new Map<string, { x: number; y: number }>()
    sortedLevels.forEach(([, ids], li) => {
        const y = li * levelHeight
        const lvl = techLevel.get(ids[0])!
        const gap = levelGaps.get(lvl)!
        const offsetX = (maxLevelWidth - levelWidths.get(lvl)!) / 2
        ids.forEach((id, i) => {
            positions.set(id, { x: offsetX + i * (nodeWidth + gap), y })
        })
    })

    const edges: { points: { x: number; y: number }[] }[] = []
    for(const [id] of techLevel) {
        const ps = techsRecord[id]?.prerequisites
        if(!ps) continue
        const pos = positions.get(id)!
        for(const p of ps) {
            const pPos = positions.get(p)
            if(!pPos) continue
            const sx = pPos.x + nodeWidth / 2
            const sy = pPos.y + nodeHeight
            const tx = pos.x + nodeWidth / 2
            const ty = pos.y
            const dy = ty - sy
            edges.push({
                points: [
                    { x: sx, y: sy },
                    { x: sx, y: sy + dy * 0.3 },
                    { x: tx, y: sy + dy * 0.7 },
                    { x: tx, y: ty },
                ],
            })
        }
    }

    return { sortedLevels, positions, edges, maxLevelWidth }
}

export function Research({ colony }: { colony: Entity | null }) {
    if(!colony) {
        return (
            <div className="p-4 text-center text-gray-400">
                No colony selected
            </div>
        )
    }
    const research = colony.getComponent(TechResearchComponent)
    const engine = useGameEngine()
    const [, setTick] = useState(0)

    useGameEvent(DayPassedEvent, () => setTick((t) => t + 1))
    useGameEvent(TechResearchedEvent, () => setTick((t) => t + 1))

    const researched = research?.researched ?? new Set<string>()
    const currentTech = research?.currentTech
    const progress = research?.progress ?? 0
    const rpPerDay = research?.researchPointsPerDay ?? 0

    const [selectedAge, setSelectedAge] = useState<string | null>("rediscovery")

    const filteredTechs = useMemo(() => {
        if(!selectedAge) return techs
        const ids = techByAge.get(selectedAge)
        if(!ids) return techs
        const result: Record<string, typeof techs[string]> = {}
        for(const id of ids) {
            result[id] = techs[id]
        }
        return result
    }, [selectedAge])

    const layout = useMemo(() => computeLayout(filteredTechs), [filteredTechs])

    const maxWidth = useMemo(() => layout?.maxLevelWidth ?? 0, [layout])

    const currentTechDef = currentTech ? techs[currentTech] : null

    const startResearch = (techId: string) => {
        if(!engine || !research || currentTech) return
        const tech = getTech(techId)
        if(!tech) return
        const prereqs = tech.prerequisites
        if(prereqs && ![...prereqs].every((p) => researched.has(p))) return
        engine.addCommand(new ResearchCommand(colony.id, techId))
    }

    const cancelResearch = () => {
        if(!engine || !research || !currentTech) return
        engine.addCommand(new CancelResearchCommand(colony.id))
    }

    return (
        <div className="space-y-4 overflow-x-auto px-2" style={{ height: "70vh" }}>
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold">State sponsored research</h2>
                {currentTechDef ? (
                    <div className="flex flex-col gap-1 text-sm">
                        <div className="font-medium">{currentTechDef.name}</div>
                        <div className="w-48 bg-gray-700 rounded overflow-hidden border border-gray-600">
                            <div className="bg-blue-500 h-2" style={{ width: `${Math.round(progress * 100)}%` }} />
                        </div>
                        <div className="text-xs text-gray-400">
                            {Math.round(progress * 100)}% &middot; {rpPerDay + 1} RP/day
                        </div>
                        <Button size="xs" onClick={cancelResearch} variant="outline">
                            Cancel research
                        </Button>
                    </div>
                ) : (
                    <div className="text-sm text-gray-400">No active research</div>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-2">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: "#8b5cf6" }} />
                        Archeological
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} />
                        Technological
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
                        Military
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} />
                        Diplomatic
                    </span>
                </div>
            </div>

            <Tabs defaultValue="rediscovery" >
                <TabsList style={{
                    height: "2em",
                }} >
                    {[...techByAge].map(([type]) => (
                        <TabsTrigger key={type} value={type} onClick={() => setSelectedAge(type)}>{type}</TabsTrigger>
                    ))}
                </TabsList>
                {
                    [...techByAge].map(([type]) => (
                        <TabsContent style={{ overflowY: "auto", overflowX: "auto" }} value={type}>
                            <div style={{
                                height: "calc(75vh - 2em)",
                                overflowY: "auto",
                                padding: "1em",
                            }}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-max"
                                    style={{
                                        width: Math.max(maxWidth, 400),
                                        height: layout.sortedLevels.length * levelHeight + nodeHeight + 40,
                                    }}
                                >
                                    {/* Edges render first so nodes draw on top and occlude line crossings */}
                                    <g stroke="#4b5563" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" pointerEvents="none" opacity={0.6}>
                                        {layout.edges.map((e, i) => {
                                            const [p0, p1, p2, p3] = e.points
                                            return (
                                                <path
                                                    key={i}
                                                    d={`M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                                                />
                                            )
                                        })}
                                    </g>
                                    {layout.sortedLevels.map(([_lvl, ids]) => (
                                        <g key={_lvl}>
                                            {ids.map((id) => {
                                                const s = nodeState(id, researched, currentTech)
                                                const pos = layout.positions.get(id)!
                                                return (
                                                    <g
                                                        key={id}
                                                        transform={`translate(${pos.x} ${pos.y})`}
                                                        style={{ cursor: s.isAvailable ? "pointer" : "default" }}
                                                        onClick={() => s.isAvailable && startResearch(id)}
                                                    >
                                                        <rect x="0" y="0" width={nodeWidth} height={nodeHeight} rx="8" fill={nodeFill(s)} stroke={nodeBorder(s)} strokeWidth={2} />
                                                        <rect x="0" y="0" width={6} height={nodeHeight} rx="8" fill={typeAccent(s.tech)} opacity={s.isResearched || s.isCurrent || s.isAvailable ? 1 : 0.35} />
                                                        {s.isCurrent && (
                                                            <>
                                                                <rect x="4" y={nodeHeight - 12} width={nodeWidth - 8} height={6} rx="3" fill="#1e293b" />
                                                                <rect x="4" y={nodeHeight - 12} width={(nodeWidth - 8) * progress} height={6} rx="3" fill="#60a5fa" />
                                                            </>
                                                        )}
                                                        <text x={nodeWidth / 2} y={nodeHeight / 2 - 6} textAnchor="middle" fill={nodeTextFill(s)} fontSize="13" fontWeight="600" pointerEvents="none">
                                                            {s.tech.name}
                                                        </text>
                                                        <text x={nodeWidth / 2} y={nodeHeight / 2 + 10} textAnchor="middle" fill={nodeTextFill(s)} fontSize="10" pointerEvents="none" opacity={s.isResearched ? 0.9 : 1}>
                                                            {s.isResearched ? "Researched" : `${s.tech.cost.researchPoints.toLocaleString()} RP &middot; ${s.tech.cost.days}d`}
                                                        </text>
                                                        {!s.prereqsMet && !s.isResearched && !s.isCurrent && (
                                                            <text x={nodeWidth / 2} y={nodeHeight - 14} textAnchor="middle" fill="#ef4444" fontSize="9" pointerEvents="none">
                                                                Locked
                                                            </text>
                                                        )}
                                                        <title>
                                                            {s.tech.name}
                                                            {"\n"}
                                                            {s.tech.description ?? ""}
                                                            {"\n"}
                                                            {s.isResearched ? "Researched" : s.isAvailable ? "Click to start research" : "Prerequisites not met"}
                                                        </title>
                                                    </g>
                                                )
                                            })}
                                        </g>
                                    ))}
                                </svg>

                                {/* {hovered && (
                                    <div className="text-sm text-gray-300 bg-gray-800/80 p-3 rounded border border-gray-700 max-w-md">
                                        <div className="font-semibold">{techs[hovered]!.name}</div>
                                        <div className="text-xs text-gray-400 mt-1">{techs[hovered]!.description}</div>
                                    </div>
                                )} */}
                            </div>
                        </TabsContent>
                    ))
                }
            </Tabs>
        </div>
    )
}
