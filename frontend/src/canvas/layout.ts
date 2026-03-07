import dagre from '@dagrejs/dagre'
import { Node, Edge } from '@xyflow/react'

export const LEAF_W = 280
export const LEAF_H = 80
export const CONTAINER_W = 300

export function containerHeight(subtaskCount: number) {
  return 64 + Math.max(subtaskCount, 1) * 48
}

function nodeSize(node: Node): { w: number; h: number } {
  if (node.type === 'container') {
    return {
      w: CONTAINER_W,
      h: containerHeight((node.data as any).subtasks?.length ?? 0),
    }
  }
  return { w: LEAF_W, h: LEAF_H }
}

export function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'LR',   // left → right along dependency chain
    nodesep: 60,     // vertical gap between nodes in the same rank
    ranksep: 120,    // horizontal gap between ranks
    marginx: 40,
    marginy: 40,
  })

  for (const node of nodes) {
    const { w, h } = nodeSize(node)
    g.setNode(node.id, { width: w, height: h })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return node
    const { w, h } = nodeSize(node)
    return { ...node, position: { x: pos.x - w / 2, y: pos.y - h / 2 } }
  })
}
