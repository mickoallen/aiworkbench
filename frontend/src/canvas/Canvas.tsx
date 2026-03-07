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
  OnNodeDrag,
  ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import {
  ListTasks,
  ListSubtasks,
  ListDependencies,
  UpdateTaskPosition,
  AddDependency,
  RemoveDependency,
} from '../api'
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
  const layoutApplied = useRef(false)

  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const rfInstance = useRef<ReactFlowInstance | null>(null)

  const load = useCallback(async () => {
    const [tasks, deps] = await Promise.all([
      ListTasks(projectId),
      ListDependencies(projectId),
    ])

    const taskList: any[] = tasks ?? []
    const depList: any[] = deps ?? []

    const subtaskMap: Record<number, any[]> = {}
    await Promise.all(
      taskList
        .filter((t) => t.task_type === 'container')
        .map(async (t) => {
          subtaskMap[t.id] = (await ListSubtasks(t.id)) ?? []
        })
    )

    const rfNodes: Node[] = taskList.map((t) => ({
      id: String(t.id),
      type: t.task_type === 'container' ? 'container' : 'leaf',
      position: { x: t.canvas_x || 0, y: t.canvas_y || 0 },
      data: {
        task: t,
        subtasks: subtaskMap[t.id] ?? [],
        // Attach subtasks to task for modal access
        _subtasks: subtaskMap[t.id] ?? [],
      },
    }))

    const rfEdges: Edge[] = depList.map((d) => ({
      id: `${d.depends_on_id}->${d.task_id}`,
      source: String(d.depends_on_id),
      target: String(d.task_id),
      style: { stroke: '#30363d', strokeWidth: 1.5 },
    }))

    const needsLayout =
      !layoutApplied.current && taskList.every((t) => t.canvas_x === 0 && t.canvas_y === 0)

    if (needsLayout && rfNodes.length > 0) {
      const laidOut = applyDagreLayout(rfNodes, rfEdges)
      setNodes(laidOut)
      laidOut.forEach((n) => UpdateTaskPosition(Number(n.id), n.position.x, n.position.y))
    } else {
      setNodes(rfNodes)
    }

    layoutApplied.current = true
    setEdges(rfEdges)

    // Fit view after nodes are set
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
  }, [projectId, setNodes, setEdges])

  useEffect(() => {
    layoutApplied.current = false
    load()
  }, [load])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const task = (node.data as any).task
    const subtasks = (node.data as any).subtasks ?? []
    setSelectedTask({ ...task, _subtasks: subtasks })
  }, [])

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return
      await AddDependency(Number(connection.target), Number(connection.source))
      setEdges((eds) =>
        addEdge({ ...connection, id: `${connection.source}->${connection.target}`, style: { stroke: '#30363d', strokeWidth: 1.5 } }, eds)
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
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#21262d" variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls style={{ background: '#161b22', border: '1px solid #30363d' }} />
      </ReactFlow>

      {/* New Task button */}
      <button
        onClick={() => setNewTaskOpen(true)}
        style={{
          position: 'absolute', bottom: 16, right: 16,
          background: '#1f6feb', border: 'none', borderRadius: 4,
          padding: '8px 14px', color: '#fff', fontSize: 12,
          cursor: 'pointer', fontFamily: 'inherit', zIndex: 10,
        }}
      >
        + new task
      </button>

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
