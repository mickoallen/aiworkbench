import dagre from '@dagrejs/dagre'
import { Node, Edge } from '@xyflow/react'

export const LEAF_W = 280
export const LEAF_H = 90
export const CONTAINER_W = 300

export function containerHeight(subtaskCount: number) {
  return 56 + subtaskCount * 52 + 16
}

export function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 80 })

  for (const node of nodes) {
    const w = node.type === 'container' ? CONTAINER_W : LEAF_W
    const h = node.type === 'container'
      ? containerHeight((node.data as any).subtasks?.length ?? 0)
      : LEAF_H
    g.setNode(node.id, { width: w, height: h })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map((node) => {
    const { x, y } = g.node(node.id)
    const w = node.type === 'container' ? CONTAINER_W : LEAF_W
    const h = node.type === 'container'
      ? containerHeight((node.data as any).subtasks?.length ?? 0)
      : LEAF_H
    return {
      ...node,
      position: { x: x - w / 2, y: y - h / 2 },
    }
  })
}
