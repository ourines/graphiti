import { create } from 'zustand'

export type GraphSelectedNode = {
  id: string
  label: string
  category: 'entity' | 'fact'
  priority?: number
  attributes?: Record<string, unknown>
} | null

type GraphFilters = {
  selectedGroupId: string | null
  searchQuery: string
  minPriority: number | null
  selectedNode: GraphSelectedNode
}

type GraphActions = {
  setSelectedGroupId: (groupId: string | null) => void
  setSearchQuery: (search: string) => void
  setMinPriority: (priority: number | null) => void
  setSelectedNode: (node: GraphSelectedNode) => void
  reset: () => void
}

type GraphStore = GraphFilters & GraphActions

export const useGraphStore = create<GraphStore>((set) => ({
  selectedGroupId: null,
  searchQuery: '',
  minPriority: null,
  selectedNode: null,
  setSelectedGroupId: (selectedGroupId) =>
    set(() => ({
      selectedGroupId,
      selectedNode: null,
    })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setMinPriority: (minPriority) => set({ minPriority }),
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  reset: () =>
    set({
      selectedGroupId: null,
      searchQuery: '',
      minPriority: null,
      selectedNode: null,
    }),
}))
