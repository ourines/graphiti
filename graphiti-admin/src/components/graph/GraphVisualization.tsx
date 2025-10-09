import { useEffect, useMemo } from 'react'
import {
  ControlsContainer,
  FullScreenControl,
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
  ZoomControl,
} from '@react-sigma/core'
import '@react-sigma/core/lib/react-sigma.min.css'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import randomLayout from 'graphology-layout/random'

import type { GraphPayload } from '@/api/types'
import { graphPayloadToGraphology } from '@/utils/graphUtils'

type GraphVisualizationProps = {
  payload: GraphPayload | null
  isLoading?: boolean
  onNodeSelect?: (nodeId: string, attributes: Record<string, unknown>) => void
  selectedNodeId?: string | null
}

const GraphInternal = ({
  payload,
  onNodeSelect,
  selectedNodeId,
}: Pick<GraphVisualizationProps, 'payload' | 'onNodeSelect' | 'selectedNodeId'>) => {
  const loadGraph = useLoadGraph()
  const sigma = useSigma()
  const registerEvents = useRegisterEvents()

  const graphologyGraph = useMemo(() => {
    if (!payload || payload.nodes.length === 0) return null
    const graph = graphPayloadToGraphology(payload)
    randomLayout.assign(graph)
    forceAtlas2.assign(graph, {
      iterations: 200,
      settings: {
        gravity: 0.2,
        scalingRatio: 12,
        slowDown: 2,
      },
    })
    return graph
  }, [payload])

  useEffect(() => {
    if (graphologyGraph) {
      loadGraph(graphologyGraph)
    } else {
      sigma.getGraph().clear()
    }
  }, [graphologyGraph, loadGraph, sigma])

  useEffect(() => {
    if (!sigma) return
    sigma.setSetting('nodeReducer', (node, data) => {
      const isSelected = node === selectedNodeId
      return {
        ...data,
        zIndex: isSelected ? 2 : 0,
        color: isSelected ? '#facc15' : data.color,
        borderColor: isSelected ? '#fef08a' : data.borderColor,
        label: data.label,
        size: isSelected ? Math.max(14, (data.size as number) + 4) : data.size,
      }
    })
    sigma.refresh()
  }, [selectedNodeId, sigma])

  useEffect(() => {
    if (!sigma) return
    const unregister = registerEvents({
      clickNode: ({ node }) => {
        const attributes = sigma.getGraph().getNodeAttributes(node)
        onNodeSelect?.(node, attributes)
      },
    })

    return () => {
      unregister?.()
    }
  }, [registerEvents, sigma, onNodeSelect])

  useEffect(() => {
    if (!sigma || !selectedNodeId) return
    const camera = sigma.getCamera()
    const position = sigma.getNodeDisplayData(selectedNodeId)
    if (position) {
      camera.animate({
        x: position.x,
        y: position.y,
        ratio: 0.85,
      })
    }
  }, [sigma, selectedNodeId])

  return null
}

const GraphVisualization = ({ payload, isLoading, onNodeSelect, selectedNodeId }: GraphVisualizationProps) => {
  const hasData = !!payload && payload.nodes.length > 0

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-xl border border-slate-800 bg-surface">
      {!hasData && !isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-muted-foreground">
          No graph data available. Adjust filters or run a search.
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-muted-foreground">
          Loading graph…
        </div>
      )}

      <SigmaContainer
        style={{ height: '100%', width: '100%', opacity: hasData ? 1 : 0.15 }}
        settings={{
          allowInvalidContainer: true,
          labelDensity: 0.07,
          labelGridCellSize: 60,
          renderLabels: true,
          defaultEdgeType: 'line',
          enableEdgeHoverEvents: true,
          zIndex: true,
        }}
      >
        <GraphInternal payload={payload} onNodeSelect={onNodeSelect} selectedNodeId={selectedNodeId} />
        <ControlsContainer position="bottom-right">
          <ZoomControl />
          <FullScreenControl />
        </ControlsContainer>
      </SigmaContainer>
    </div>
  )
}

export default GraphVisualization
