import type {
  BackupHistoryEntry,
  BackupServiceStatus,
  BackupSettingsPayload,
  BackupTriggerResponse,
  ManualBackupRequest,
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
  const response = await backupClient.get<{ backups?: BackupHistoryEntry[] }>('/api/backups')
  return response.data.backups ?? []
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
  await backupClient.delete(`/api/backups/${backupId}`)
}

export const getBackupStatus = async (): Promise<BackupServiceStatus> => {
  const response = await backupClient.get<BackupServiceStatus>('/api/status')
  return response.data
}
