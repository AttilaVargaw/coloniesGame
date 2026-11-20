"use client"

import { useEffect, useRef, useMemo } from "react"
import cytoscape from "cytoscape"
import dagre from "cytoscape-dagre"

cytoscape.use(dagre)

const MAX_NODES = 80
const MAX_EDGES = 120

const NODE_COLORS = {
  shortage: "#f59e0b",
  sector_stop: "#ef4444",
  surplus: "#22c55e",
  price_spike: "#f97316",
  production_decline: "#8b5cf6",
  wealth_decline: "#ec4899",
  default: "#6b7280",
}

const EDGE_COLORS = {
  confirmed_dependency: "#ef4444",
  observed_association: "#f59e0b",
  possible_consequence: "#3b82f6",
}

const SEVERITY_RING = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
}

interface CascadeGraphProps {
  cascade: {
    id: string
    nodes: Array<{
      id: string
      type: string
      good: string | null
      sector: string | null
      severity: string
      description: string
      firstDetectedTick: number
    }>
    links: Array<{
      fromProblem: string
      toProblem: string
      fromGood: string | null
      toSector: string | null
      evidenceLevel: string
      confidence: number
      description: string
    }>
    rootCause: {
      id: string
      description: string
    }
    status: string
  } | null
}

function getNodeLabel(node: NonNullable<CascadeGraphProps["cascade"]>["nodes"][0]): string {
  let label = node.type
  if (node.good) label += `: ${node.good}`
  if (node.sector) label += ` [${node.sector}]`
  return label
}

function buildElements(cascade: NonNullable<CascadeGraphProps["cascade"]>) {
  const isLarge = cascade.nodes.length > MAX_NODES || cascade.links.length > MAX_EDGES
  
  const nodes = cascade.nodes
    .slice(0, MAX_NODES)
    .map((node) => {
      const color = NODE_COLORS[node.type as keyof typeof NODE_COLORS] ?? NODE_COLORS.default
      const severityColor = SEVERITY_RING[node.severity as keyof typeof SEVERITY_RING] ?? SEVERITY_RING.info
      const label = getNodeLabel(node)
      const isRoot = node.id === cascade.rootCause.id
      
      return {
        data: {
          id: node.id,
          label,
          type: node.type,
          severity: node.severity,
          description: node.description,
          tick: node.firstDetectedTick,
          bgColor: color,
          borderColor: severityColor,
          borderWidth: isRoot ? 3 : 1,
          isRoot,
        },
        classes: isRoot ? "root-cause" : "",
      }
    })

  // Create a set of displayed node IDs for edge filtering
  const displayedNodeIds = new Set(nodes.map(n => n.data.id))
  
  const edges = cascade.links
    .slice(0, MAX_EDGES)
    .map((link, i) => {
      const color = EDGE_COLORS[link.evidenceLevel as keyof typeof EDGE_COLORS] ?? "#6b7280"
      // Only include edges where both source and target nodes exist in displayed nodes
      if (!displayedNodeIds.has(link.fromProblem) || !displayedNodeIds.has(link.toProblem)) {
        return null
      }
      return {
        data: {
          id: `edge_${i}`,
          source: link.fromProblem,
          target: link.toProblem,
          evidenceLevel: link.evidenceLevel,
          confidence: link.confidence,
          description: link.description,
          edgeColor: EDGE_COLORS[link.evidenceLevel as keyof typeof EDGE_COLORS] ?? "#6b7280",
          edgeLabel: `${(link.confidence * 100).toFixed(0)}%`,
        },
      }
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null)

  return { nodes, edges, isLarge }
}

export function CascadeGraph({ cascade }: CascadeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  const { nodes, edges, isLarge } = useMemo(() => {
    if (!cascade) return { nodes: [], edges: [], isLarge: false }
    return buildElements(cascade)
  }, [cascade])

  const elements = useMemo(() => [...nodes, ...edges], [nodes, edges])

  useEffect(() => {
    if (!containerRef.current || elements.length === 0) return

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "label": "data(label)",
            "color": "#fff",
            "font-size": "10px",
            "text-valign": "bottom",
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "background-color": "data(bgColor)",
            "border-width": "data(borderWidth)",
            "border-color": "data(borderColor)",
            "padding": "8px",
            "min-width": "60px",
            "min-height": "30px",
          },
        },
        {
          selector: "edge",
          style: {
            "width": 2,
            "line-color": "data(edgeColor)",
            "target-arrow-color": "data(edgeColor)",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "label": "data(edgeLabel)",
            "font-size": "8px",
            "color": "data(edgeColor)",
            "text-background-color": "#1c1c1c",
            "text-background-opacity": 0.9,
            "text-background-padding": "2px",
          },
        },
        {
          selector: ".root-cause",
          style: {
            "border-width": 3,
            "border-color": "#ef4444",
            "border-style": "solid",
          },
        },
      ],
      layout: {
        name: "dagre",
        rankDir: "LR",
        rankSep: 60,
        nodeSep: 30,
        edgeSep: 10,
        animate: false,
      } as any,
      minZoom: 0.15,
      maxZoom: 3,
      zoomingEnabled: true,
      panningEnabled: true,
      boxSelectionEnabled: false,
      autoungrabify: false,
      autounselectify: false,
    })

    cyRef.current = cy
    cy.fit()

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [elements])

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "600px",
        background: "#0a0a0a",
        borderRadius: "8px",
        border: "1px solid #333",
      }}
    />
  )
}