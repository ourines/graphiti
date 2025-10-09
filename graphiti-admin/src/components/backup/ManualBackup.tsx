import { useState } from 'react'
import { History, Play } from 'lucide-react'

import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'

type ManualBackupProps = {
  onTrigger: (description: string) => void
  isTriggering: boolean
  lastTriggeredAt?: string | null
}

const ManualBackup = ({ onTrigger, isTriggering, lastTriggeredAt }: ManualBackupProps) => {
  const [description, setDescription] = useState('')

  return (
    <Card
      title="Manual backup"
      description="Capture a snapshot immediately and store it in R2"
      actions={
        <Button
          onClick={() => onTrigger(description)}
          disabled={isTriggering}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          {isTriggering ? 'Triggering…' : 'Run backup'}
        </Button>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-slate-800 bg-background/60 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last manual run</p>
          <p className="flex items-center gap-2 text-slate-100">
            <History className="h-4 w-4 text-accent" />
            {lastTriggeredAt ?? '—'}
          </p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Description</span>
          <Input
            placeholder="Optional note for this backup"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>
    </Card>
  )
}

export default ManualBackup
