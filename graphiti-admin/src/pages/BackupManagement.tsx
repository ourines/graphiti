import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

import type { BackupHistoryEntry, BackupSettingsPayload } from '@/api/types'
import BackupHistory from '@/components/backup/BackupHistory'
import BackupSchedule from '@/components/backup/BackupSchedule'
import BackupStatusCard from '@/components/backup/BackupStatus'
import BackupSettings from '@/components/backup/BackupSettings'
import ManualBackup from '@/components/backup/ManualBackup'
import { useBackupHistory, useBackupSettings, useDeleteBackup, useDownloadBackup, useTriggerManualBackup, useUpdateBackupSettings, useBackupStatus } from '@/hooks/useBackup'
import { formatRelativeTime } from '@/utils/formatters'

const getTriggerErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 409) {
    return 'A backup is already running. Try again after it completes.'
  }
  return 'Failed to trigger backup'
}

const BackupManagement = () => {
  const { data: settings, isLoading: settingsLoading } = useBackupSettings()
  const { data: history, isLoading: historyLoading } = useBackupHistory()
  const { data: status, isLoading: statusLoading } = useBackupStatus()
  const updateSettings = useUpdateBackupSettings()
  const triggerManualBackup = useTriggerManualBackup()
  const downloadBackup = useDownloadBackup()
  const deleteBackup = useDeleteBackup()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success')

  const lastManualRun = useMemo(() => {
    if (!history?.length) return null
    return history.find((entry) => entry.status === 'completed')?.completed_at ?? null
  }, [history])

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 4000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const handleSaveSettings = async (payload: BackupSettingsPayload) => {
    try {
      await updateSettings.mutateAsync(payload)
      setFeedbackType('success')
      setFeedback('Backup settings saved')
    } catch (error) {
      console.error(error)
      setFeedbackType('error')
      setFeedback('Failed to save settings')
    }
  }

  const handleManualTrigger = async (description: string) => {
    try {
      await triggerManualBackup.mutateAsync({ description })
      setFeedbackType('success')
      setFeedback('Backup triggered successfully')
    } catch (error) {
      console.error(error)
      setFeedbackType('error')
      setFeedback(getTriggerErrorMessage(error))
    }
  }

  const handleDownload = (entry: BackupHistoryEntry) => {
    downloadBackup.mutate(entry)
  }

  const handleDelete = async (entry: BackupHistoryEntry) => {
    try {
      await deleteBackup.mutateAsync(entry.id)
      setFeedbackType('success')
      setFeedback('Backup deleted')
    } catch (error) {
      console.error(error)
      setFeedbackType('error')
      setFeedback('Failed to delete backup')
    }
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedbackType === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          {feedback}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <BackupSettings
            settings={settings}
            isLoading={settingsLoading}
            onSave={(payload) => handleSaveSettings(payload)}
            isSaving={updateSettings.isPending}
          />
          <ManualBackup
            onTrigger={handleManualTrigger}
            isTriggering={triggerManualBackup.isPending}
            lastTriggeredAt={lastManualRun ? `${formatRelativeTime(lastManualRun)} (${lastManualRun})` : undefined}
          />
        </div>
        <div className="space-y-6">
          <BackupStatusCard status={status} isLoading={statusLoading} />
          <BackupSchedule settings={settings} />
        </div>
      </div>

      <BackupHistory
        history={history}
        isLoading={historyLoading}
        onDownload={handleDownload}
        onDelete={handleDelete}
        isDeletingId={(deleteBackup.variables as string | undefined) ?? null}
      />
    </div>
  )
}

export default BackupManagement
