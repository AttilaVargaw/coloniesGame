import { TechResearchComponent } from "@/game/components/TechResearchComponent";
import { techs, getTech } from "@/game/data/Techs";
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
    if (s.isResearched) return "#16a34a"
    if (s.isCurrent) return "#2563eb"
    if (s.isAvailable) return "#f8fafc"
    return "#4b5563"
}

function nodeTextFill(s: NodeState) {
    if (s.isResearched || s.isCurrent) return "#ffffff"
    if (s.isAvailable) return "#0f172a"
    return "#9ca3af"
}

function nodeBorder(s: NodeState) {
    if (s.isResearched) return "#16a34a"
    if (s.isCurrent) return "#2563eb"
    if (s.isAvailable) return "#94a3b8"
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
        const techLevel = new Map<string, number>()
        const visiting = new Set<string>()

        const levelOf = (id: string): number => {
            if (techLevel.has(id)) return techLevel.get(id)!
            if (visiting.has(id)) return 0
            visiting.add(id)
            const prereqs = techs[id]?.prerequisites
            let lvl = 0
            if (prereqs?.size) {
                lvl = 1 + Math.max(...[...prereqs].map(levelOf))
            }
            visiting.delete(id)
            techLevel.set(id, lvl)
            return lvl
        }

        for (const id of Object.keys(techs)) levelOf(id)

        const levels = new Map<number, string[]>()
        const positions = new Map<string, { x: number; y: number }>()
        for (const [id, lvl] of techLevel) {
            if (!levels.has(lvl)) levels.set(lvl, [])
            levels.get(lvl)!.push(id)
        }

        const sortedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0])
        sortedLevels.forEach(([_lvl, ids], li) => {
            ids.forEach((id, i) => {
                positions.set(id, { x: i * (nodeWidth + levelGap), y: li * levelHeight })
            })
        })

        const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
        for (const [id] of techLevel) {
            const prereqs = techs[id]?.prerequisites
            if (!prereqs) continue
            const pos = positions.get(id)!
            for (const p of prereqs) {
                const pPos = positions.get(p)
                if (!pPos) continue
                edges.push({
                    x1: pPos.x + nodeWidth / 2,
                    y1: pPos.y + nodeHeight,
                    x2: pos.x + nodeWidth / 2,
                    y2: pos.y,
                })
            }
        }

        return { sortedLevels, positions, edges }
    }, [])

    const maxWidth = useMemo(() => {
        let w = 0
        for (const [, ids] of layout.sortedLevels) {
            w = Math.max(w, ids.length * (nodeWidth + levelGap))
        }
        return w
    }, [layout])

    const currentTechDef = currentTech ? techs[currentTech] : null

    const startResearch = (techId: string) => {
        if (!engine || !research || currentTech) return
        const tech = getTech(techId)
        if (!tech) return
        const prereqs = tech.prerequisites
        if (prereqs && ![...prereqs].every((p) => researched.has(p))) return
        engine.addCommand(new ResearchCommand(colony.id, techId))
    }

    const cancelResearch = () => {
        if (!engine || !research || !currentTech) return
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
                {layout.edges.map((e, i) => (
                    <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#4b5563" strokeWidth={2} />
                ))}
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
