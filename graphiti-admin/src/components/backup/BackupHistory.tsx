import { Download, Trash2 } from 'lucide-react'

import type { BackupHistoryEntry } from '@/api/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { formatDateTime, formatFileSize } from '@/utils/formatters'

type BackupHistoryProps = {
  history: BackupHistoryEntry[] | undefined
  isLoading: boolean
  onDownload: (entry: BackupHistoryEntry) => void
  onDelete: (entry: BackupHistoryEntry) => void
  isDeletingId?: string | null
}

const statusStyles: Record<BackupHistoryEntry['status'], string> = {
  completed: 'bg-emerald-500/10 text-emerald-400',
  running: 'bg-amber-500/10 text-amber-400',
  failed: 'bg-rose-500/10 text-rose-400',
  deleted: 'bg-slate-700 text-muted-foreground',
}

const BackupHistory = ({ history, isLoading, onDownload, onDelete, isDeletingId }: BackupHistoryProps) => {
  return (
    <Card title="Backup history" description="Recent backup runs with status and size">
      {isLoading && <p className="text-sm text-muted-foreground">Loading history…</p>}

      {!isLoading && (!history || history.length === 0) && (
        <p className="text-sm text-muted-foreground">No backups recorded yet.</p>
      )}

      {!isLoading && history?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Completed</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2" aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-800">
                  <td className="px-3 py-3 font-mono text-xs text-slate-400">{entry.id.slice(0, 10)}…</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[entry.status]}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{formatDateTime(entry.started_at)}</td>
                  <td className="px-3 py-3 text-slate-300">{formatDateTime(entry.completed_at)}</td>
                  <td className="px-3 py-3 text-slate-300">{formatFileSize(entry.size_bytes)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownload(entry)}
                        disabled={!entry.download_url}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(entry)}
                        disabled={isDeletingId === entry.id}
                        className="gap-2 text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isDeletingId === entry.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  )
}

export default BackupHistory
