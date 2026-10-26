import { TechResearchComponent } from "@/game/components/TechResearchComponent";
import { techs, getTech, type Age } from "@/game/data/Techs";
import { ResearchCommand, CancelResearchCommand } from "@/game/commands/ResearchCommand";
import { DayPassedEvent } from "@/engine/lib/events";
import { TechResearchedEvent } from "@/game/events/techEvents";
import { Entity } from "@/engine/entities/entity";
import { useGameEngine } from "@/hooks/useGameContext";
import { useGameEvent } from "@/hooks/useGameEvent";
import { Button } from "../ui/button";
import { useMemo, useState } from "react";

const nodeWidth = 230
const nodeHeight = 64
const levelHeight = 120
const levelGap = 26

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

export function Research({ colony }: { colony: Entity }) {
    const research = colony.getComponent(TechResearchComponent)
    const engine = useGameEngine()
    const [, setTick] = useState(0)
    const [hovered, setHovered] = useState<string | null>(null)

    useGameEvent(DayPassedEvent, () => setTick((t) => t + 1))
    useGameEvent(TechResearchedEvent, () => setTick((t) => t + 1))

    const researched = research?.researched ?? new Set<string>()
    const currentTech = research?.currentTech
    const progress = research?.progress ?? 0
    const rpPerDay = research?.researchPointsPerDay ?? 0

    const layout = useMemo(() => {
        const ageOrder: Age[] = ["rediscovery", "imperial", "techRevolution", "unification"]
        const ageIndex = (age: Age) => ageOrder.indexOf(age)

        const parents = new Map<string, Set<string>>()
        const children = new Map<string, Set<string>>()
        for(const id of Object.keys(techs)) {
            parents.set(id, techs[id]?.prerequisites ?? new Set<string>())
            children.set(id, new Set<string>())
        }
        for(const [id, ps] of parents) {
            for(const p of ps) {
                children.get(p)?.add(id)
            }
        }

        // Prerequisite depth: longest path from a root (no-prereq) node.
        const prereqDepth = new Map<string, number>()
        const visiting = new Set<string>()
        const depthOf = (id: string): number => {
            if(prereqDepth.has(id)) return prereqDepth.get(id)!
            if(visiting.has(id)) return 0
            visiting.add(id)
            const ps = parents.get(id)!
            let d = 0
            if(ps.size) {
                d = 1 + Math.max(...[...ps].map(depthOf))
            }
            visiting.delete(id)
            prereqDepth.set(id, d)
            return d
        }
        for(const id of Object.keys(techs)) depthOf(id)
        const maxDepth = Math.max(0, ...[...prereqDepth.values()])

        // Combined level: age band is the coarse row, prerequisite depth refines
        // position within the band so a prerequisite always sits above its dependent.
        const techLevel = new Map<string, number>()
        for(const id of Object.keys(techs)) {
            techLevel.set(id, ageIndex(techs[id].age) * (maxDepth + 1) + prereqDepth.get(id)!)
        }

        const levels = new Map<number, string[]>()
        for(const [id, lvl] of techLevel) {
            if(!levels.has(lvl)) levels.set(lvl, [])
            levels.get(lvl)!.push(id)
        }

        const sortedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0])

        // Initial ordering: alphabetical within level
        const order = new Map<number, string[]>()
        sortedLevels.forEach(([lvl, ids]) => {
            order.set(lvl, [...ids].sort((a, b) => a.localeCompare(b)))
        })

        const indexOf = (id: string): number => {
            const lvl = techLevel.get(id)!
            return order.get(lvl)!.indexOf(id)
        }

        // Barycenter heuristic: order nodes within each level to minimize edge crossings.
        // Alternate top-down and bottom-up passes; each pass reorders a level by the
        // average position of its neighbors in the adjacent level.
        for(let pass = 0; pass < 6; pass++) {
            const forward = pass % 2 === 0
            const iterate = forward ? sortedLevels : [...sortedLevels].reverse()
            for(const [lvl, ids] of iterate) {
                const dir = forward ? -1 : 1 // -1 = look at previous level, +1 = next level
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
                    return { id, bary }
                })
                withBary.sort((a, b) => a.bary - b.bary || a.id.localeCompare(b.id))
                order.set(lvl, withBary.map(({ id }) => id))
            }
        }

        const positions = new Map<string, { x: number; y: number }>()
        sortedLevels.forEach(([, ids], li) => {
            const y = li * levelHeight
            ids.forEach((id, i) => {
                positions.set(id, { x: i * (nodeWidth + levelGap), y })
            })
        })

        const edges: { points: { x: number; y: number }[] }[] = []
        for(const [id] of techLevel) {
            const ps = techs[id]?.prerequisites
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
                // Cubic S-curve: arcs between levels instead of sharp elbows that
                // cut across intermediate nodes.
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

        return { sortedLevels, positions, edges }
    }, [])

    const maxWidth = useMemo(() => {
        let w = 0
        for(const [, ids] of layout.sortedLevels) {
            w = Math.max(w, ids.length * (nodeWidth + levelGap))
        }
        return w
    }, [layout])

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
            </div>

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
                                    onMouseEnter={() => setHovered(id)}
                                    onMouseLeave={() => setHovered(null)}
                                >
                                    <rect x="0" y="0" width={nodeWidth} height={nodeHeight} rx="8" fill={nodeFill(s)} stroke={nodeBorder(s)} strokeWidth={2} />
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

            {hovered && (
                <div className="text-sm text-gray-300 bg-gray-800/80 p-3 rounded border border-gray-700 max-w-md">
                    <div className="font-semibold">{techs[hovered]!.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{techs[hovered]!.description}</div>
                </div>
            )}
        </div>
    )
}
