import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteBackup,
  downloadBackup,
  getBackupHistory,
  getBackupSettings,
  getBackupStatus,
  triggerManualBackup,
  updateBackupSettings,
} from '@/api/backup'
import type { BackupHistoryEntry, BackupSettingsPayload, ManualBackupRequest } from '@/api/types'

export const useBackupSettings = () =>
  useQuery({
    queryKey: ['backup', 'settings'],
    queryFn: getBackupSettings,
    staleTime: 1000 * 60,
  })

export const useBackupHistory = () =>
  useQuery({
    queryKey: ['backup', 'history'],
    queryFn: getBackupHistory,
    refetchInterval: 1000 * 30,
  })

export const useUpdateBackupSettings = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: BackupSettingsPayload) => updateBackupSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData<BackupSettingsPayload>(['backup', 'settings'], data)
    },
  })
}

export const useTriggerManualBackup = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ManualBackupRequest) => triggerManualBackup(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'history'] })
    },
  })
}

export const useDownloadBackup = () =>
  useMutation({
    mutationFn: async (backup: BackupHistoryEntry) => {
      const blob = await downloadBackup(backup.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = backup.download_url ?? `${backup.id}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      return blob
    },
  })

export const useDeleteBackup = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (backupId: string) => deleteBackup(backupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup', 'history'] })
    },
  })
}

export const useBackupStatus = () =>
  useQuery({
    queryKey: ['backup', 'status'],
    queryFn: getBackupStatus,
    refetchInterval: 1000 * 15,
  })
