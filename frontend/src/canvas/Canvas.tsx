import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  MarkerType,
  OnNodeDrag,
  ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import {
  ListTasks,
  ListSubtasks,
  ListDependencies,
  ListSubtaskDependencies,
  UpdateTaskPosition,
  AddDependency,
  RemoveDependency,
  AddTaskToQueueWithDeps,
  QueueContainerSubtasks,
  AddSubtaskToQueueWithDeps,
  DequeueTask,
  DequeueSubtask,
  DequeueContainerSubtasks,
} from '../api'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import LeafTaskNode from './nodes/LeafTaskNode'
import ContainerTaskNode from './nodes/ContainerTaskNode'
import { applyDagreLayout } from './layout'
import TaskModal from '../components/TaskModal'
import ContainerModal from '../components/ContainerModal'
import NewTaskModal from '../components/NewTaskModal'

const nodeTypes = {
  leaf: LeafTaskNode,
  container: ContainerTaskNode,
}

interface Props {
  projectId: number
}

export default function Canvas({ projectId }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const rfInstance = useRef<ReactFlowInstance | null>(null)
  const initialLoad = useRef(true)

  const load = useCallback(async () => {
    const [tasks, deps] = await Promise.all([
      ListTasks(projectId),
      ListDependencies(projectId),
    ])

    const taskList: any[] = tasks ?? []
    const depList: any[] = deps ?? []

    const subtaskMap: Record<number, any[]> = {}
    const subtaskDepMap: Record<number, any[]> = {}
    await Promise.all(
      taskList
        .filter((t) => t.task_type === 'container')
        .map(async (t) => {
          subtaskMap[t.id] = (await ListSubtasks(t.id)) ?? []
          subtaskDepMap[t.id] = (await ListSubtaskDependencies(t.id)) ?? []
        })
    )

    const rfNodes: Node[] = taskList.map((t) => ({
      id: String(t.id),
      type: t.task_type === 'container' ? 'container' : 'leaf',
      position: { x: t.canvas_x || 0, y: t.canvas_y || 0 },
      data: {
        task: t,
        subtasks: subtaskMap[t.id] ?? [],
        subtaskDeps: subtaskDepMap[t.id] ?? [],
        _subtasks: subtaskMap[t.id] ?? [],
        onQueue: async (e: React.MouseEvent) => {
          e.stopPropagation()
          if (t.task_type === 'container') {
            await QueueContainerSubtasks(t.project_id, t.id)
          } else {
            await AddTaskToQueueWithDeps(t.project_id, t.id)
          }
        },
        onDequeue: async (e: React.MouseEvent) => {
          e.stopPropagation()
          if (t.task_type === 'container') {
            await DequeueContainerSubtasks(t.project_id, t.id)
          } else {
            await DequeueTask(t.project_id, t.id)
          }
        },
        onQueueSubtask: async (e: React.MouseEvent, subtaskId: number) => {
          e.stopPropagation()
          await AddSubtaskToQueueWithDeps(t.project_id, subtaskId)
        },
        onDequeueSubtask: async (e: React.MouseEvent, subtaskId: number) => {
          e.stopPropagation()
          await DequeueSubtask(t.project_id, subtaskId)
        },
      },
    }))

    const edgeStyle = {
      stroke: '#30363d',
      strokeWidth: 1.5,
    }
    const rfEdges: Edge[] = depList.map((d) => ({
      id: `${d.depends_on_id}->${d.task_id}`,
      source: String(d.depends_on_id),
      target: String(d.task_id),
      type: 'smoothstep',
      style: edgeStyle,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#30363d', width: 14, height: 14 },
    }))

    // Preserve current visual positions for nodes that already exist on the canvas.
    // DB positions may lag behind arrange/drag updates, so prefer what's on screen.
    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]))
      const merged = rfNodes.map((n) => {
        const existing = prevMap.get(n.id)
        if (existing) {
          return { ...n, position: existing.position }
        }
        return n
      })

      // Auto-layout any nodes that have never been positioned (new or canvas_x/y both 0
      // with no existing position on screen).
      const unpositioned = merged.filter((n) => {
        const existed = prevMap.has(n.id)
        if (existed) return false
        const t = taskList.find((t) => String(t.id) === n.id)
        return t && t.canvas_x === 0 && t.canvas_y === 0
      })

      if (unpositioned.length > 0) {
        const laidOut = applyDagreLayout(merged, rfEdges)
        const result = merged.map((n) => {
          if (!unpositioned.find((u) => u.id === n.id)) return n
          return laidOut.find((l) => l.id === n.id) ?? n
        })
        unpositioned.forEach((n) => {
          const laid = laidOut.find((l) => l.id === n.id)
          if (laid) UpdateTaskPosition(Number(n.id), laid.position.x, laid.position.y)
        })
        return result
      }

      return merged
    })

    setEdges(rfEdges)

    // Fit view only on first load
    if (initialLoad.current) {
      initialLoad.current = false
      setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
    }
  }, [projectId, setNodes, setEdges])

  useEffect(() => {
    initialLoad.current = true
    load()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload whenever MCP tools mutate the board
  useEffect(() => {
    const unsub = EventsOn('board:changed', () => load())
    return () => unsub()
  }, [load])

  const onNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    if ((e.target as HTMLElement).closest('button')) return
    const task = (node.data as any).task
    const subtasks = (node.data as any).subtasks ?? []
    setSelectedTask({ ...task, _subtasks: subtasks })
  }, [])

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return
      await AddDependency(Number(connection.target), Number(connection.source))
      setEdges((eds) =>
        addEdge({
          ...connection,
          id: `${connection.source}->${connection.target}`,
          type: 'smoothstep',
          style: { stroke: '#30363d', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#30363d', width: 14, height: 14 },
        }, eds)
      )
    },
    [setEdges]
  )

  const onEdgeDoubleClick = useCallback(
    async (_: React.MouseEvent, edge: Edge) => {
      await RemoveDependency(Number(edge.target), Number(edge.source))
      setEdges((eds) => eds.filter((e) => e.id !== edge.id))
    },
    [setEdges]
  )

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node) => {
      UpdateTaskPosition(Number(node.id), node.position.x, node.position.y)
    },
    []
  )

  // Auto-arrange: run dagre on all nodes, persist every position to DB.
  const arrange = useCallback(async () => {
    const laid = applyDagreLayout(nodes, edges)
    setNodes(laid)
    await Promise.all(laid.map((n) => UpdateTaskPosition(Number(n.id), n.position.x, n.position.y)))
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.15, duration: 300 }), 50)
  }, [nodes, edges, setNodes])

  function closeModal() {
    setSelectedTask(null)
  }

  function handleSaved() {
    closeModal()
    load()
  }

  function handleDeleted() {
    closeModal()
    load()
  }

  const toolBtn: React.CSSProperties = {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 4,
    padding: '8px 12px', color: '#8b949e', fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit',
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        onInit={(instance) => { rfInstance.current = instance }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        panOnScroll
        panOnScrollMode={'free' as any}
        zoomOnScroll={false}
        zoomOnPinch
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#21262d" variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls style={{ background: '#161b22', border: '1px solid #30363d' }} />
      </ReactFlow>

      {/* Canvas toolbar */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 6, zIndex: 10 }}>
        <button
          onClick={() => load()}
          style={toolBtn}
        >
          ↺ refresh
        </button>
        <button
          onClick={arrange}
          style={toolBtn}
        >
          ⊞ arrange
        </button>
        <button
          onClick={() => setNewTaskOpen(true)}
          style={{ ...toolBtn, background: '#1f6feb', border: 'none', color: '#fff' }}
        >
          + new task
        </button>
      </div>

      {/* Modals */}
      {selectedTask && selectedTask.task_type === 'leaf' && (
        <TaskModal task={selectedTask} onClose={closeModal} onSaved={handleSaved} onDeleted={handleDeleted} />
      )}
      {selectedTask && selectedTask.task_type === 'container' && (
        <ContainerModal task={selectedTask} onClose={closeModal} onSaved={handleSaved} onDeleted={handleDeleted} />
      )}
      {newTaskOpen && (
        <NewTaskModal
          projectId={projectId}
          onClose={() => setNewTaskOpen(false)}
          onCreated={() => { setNewTaskOpen(false); load() }}
        />
      )}
    </div>
  )
}
