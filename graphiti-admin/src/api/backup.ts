import type {
  BackupHistoryEntry,
  BackupServiceStatus,
  BackupSettingsPayload,
  BackupTriggerResponse,
  ManualBackupRequest,
  RestoreStatusPayload,
  RestoreTriggerResponse,
} from './types'
import { backupClient } from './client'

export const getBackupSettings = async (): Promise<BackupSettingsPayload> => {
  const response = await backupClient.get<BackupSettingsPayload>('/api/settings')
  return response.data
}

export const updateBackupSettings = async (
  payload: BackupSettingsPayload,
): Promise<BackupSettingsPayload> => {
  const response = await backupClient.put<BackupSettingsPayload>('/api/settings', payload)
  return response.data
}

export const getBackupHistory = async (): Promise<BackupHistoryEntry[]> => {
  const response = await backupClient.get<BackupHistoryEntry[] | { backups?: BackupHistoryEntry[] }>(
    '/api/backups',
  )

  if (Array.isArray(response.data)) {
    return response.data
  }

  if (response.data?.backups && Array.isArray(response.data.backups)) {
    return response.data.backups
  }

  return []
}

export const triggerManualBackup = async (
  payload: ManualBackupRequest,
): Promise<BackupTriggerResponse> => {
  const response = await backupClient.post<BackupTriggerResponse>('/api/backups', payload)
  return response.data
}

export const downloadBackup = async (backupId: string): Promise<Blob> => {
  const response = await backupClient.get(`/api/backups/${backupId}/download`, {
    responseType: 'blob',
  })
  return response.data
}

export const deleteBackup = async (backupId: string): Promise<void> => {
  const encoded = encodeURIComponent(backupId)
  await backupClient.delete(`/api/backups/${encoded}`)
}

export const getBackupStatus = async (): Promise<BackupServiceStatus> => {
  const response = await backupClient.get<BackupServiceStatus>('/api/status')
  return response.data
}

export const triggerRestore = async (backupId: string): Promise<RestoreTriggerResponse> => {
  const encoded = encodeURIComponent(backupId)
  const response = await backupClient.post<RestoreTriggerResponse>(`/api/backups/${encoded}/restore`)
  return response.data
}

export const getRestoreStatus = async (): Promise<RestoreStatusPayload> => {
  const response = await backupClient.get<RestoreStatusPayload>('/api/restore/status')
  return response.data
}
