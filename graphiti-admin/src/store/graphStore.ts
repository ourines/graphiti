import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

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
  setSearchQuery: (value: string) => void
  setMinPriority: (priority: number | null) => void
  setSelectedNode: (node: GraphSelectedNode) => void
  reset: () => void
}

export type GraphViewPreset = {
  id: string
  name: string
  groupId: string | null
  searchQuery: string
  minPriority: number | null
  sampleSize: number
  createdAt: string
}

type GraphStore = GraphFilters &
  GraphActions & {
    presets: GraphViewPreset[]
    addPreset: (preset: Omit<GraphViewPreset, 'id' | 'createdAt'> & { name: string }) => void
    removePreset: (id: string) => void
  }

const generatePresetId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // ignore
  }
  return `preset-${Date.now()}`
}

export const useGraphStore = create<GraphStore>()(
  persist(
    (set) => ({
      selectedGroupId: null,
      searchQuery: '',
      minPriority: null,
      selectedNode: null,
      presets: [],
      setSelectedGroupId: (selectedGroupId) =>
        set(() => ({
          selectedGroupId,
          selectedNode: null,
        })),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setMinPriority: (minPriority) => set({ minPriority }),
      setSelectedNode: (selectedNode) => set({ selectedNode }),
      addPreset: (preset) =>
        set((state) => ({
          presets: [
            ...state.presets,
            {
              ...preset,
              id: generatePresetId(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      removePreset: (id) =>
        set((state) => ({
          presets: state.presets.filter((preset) => preset.id !== id),
        })),
      reset: () =>
        set({
          selectedGroupId: null,
          searchQuery: '',
          minPriority: null,
          selectedNode: null,
        }),
    }),
    {
      name: 'graphiti-graph-store',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined,
      ),
      partialize: (state) => ({ presets: state.presets }),
    },
  ),
)
