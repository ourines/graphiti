from __future__ import annotations

import threading
import time
from datetime import datetime
from typing import List, Optional

from botocore.exceptions import ClientError
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backup import BACKUP_PREFIX, R2_BUCKET_NAME, perform_backup, get_s3_client
from config_manager import (
    apply_cron_schedule,
    ensure_config,
    load_settings,
    save_settings,
    update_runtime_state,
)


class BackupSettingsModel(BaseModel):
    enabled: bool
    cron: str
    retentionDays: int = Field(..., ge=1)
    lastRunAt: Optional[str] = None
    nextRunAt: Optional[str] = None
    lastStatus: str
    lastBackupId: Optional[str] = None
    lastError: Optional[str] = None


class BackupSettingsUpdate(BaseModel):
    enabled: bool
    cron: str
    retentionDays: int = Field(..., ge=1)


class ManualBackupRequest(BaseModel):
    description: Optional[str] = None


class BackupTriggerResponse(BaseModel):
    backup_id: str
    status: str


class BackupHistoryEntry(BaseModel):
    id: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    size_bytes: Optional[int] = None
    download_url: Optional[str] = None
    details: Optional[str] = None


def _coalesce_bucket() -> str:
    if not R2_BUCKET_NAME:
        raise HTTPException(status_code=400, detail='R2 bucket is not configured')
    return R2_BUCKET_NAME


class BackupTaskController:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._job_id: Optional[str] = None

    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def current_job_id(self) -> Optional[str]:
        return self._job_id if self.is_running() else None

    def trigger(self, description: Optional[str]) -> str:
        with self._lock:
            if self.is_running():
                raise RuntimeError('Backup already in progress')

            job_id = f"manual-{int(time.time())}"
            thread = threading.Thread(
                target=self._run_backup,
                args=(job_id, description),
                daemon=True,
            )
            self._thread = thread
            self._job_id = job_id
            thread.start()
            return job_id

    def _run_backup(self, job_id: str, description: Optional[str]) -> None:
        started_at = datetime.now().isoformat()
        update_runtime_state(lastStatus='running', lastRunAt=started_at, lastBackupId=None, lastError=None)

        result = perform_backup()

        completed_at = result.completed_at.isoformat() if result.completed_at else datetime.now().isoformat()
        if result.success:
            update_runtime_state(
                lastStatus='completed',
                lastRunAt=completed_at,
                lastBackupId=result.remote_key,
                lastError=None,
            )
        else:
            update_runtime_state(
                lastStatus='failed',
                lastRunAt=completed_at,
                lastError=result.error,
            )

        with self._lock:
            self._thread = None
            self._job_id = None


controller = BackupTaskController()
app = FastAPI(title='Neo4j Backup Service')


@app.on_event('startup')
async def startup_event() -> None:
    settings = ensure_config()
    apply_cron_schedule(settings)


@app.get('/api/settings', response_model=BackupSettingsModel)
async def get_settings() -> BackupSettingsModel:
    settings = load_settings()
    return BackupSettingsModel(**settings)


@app.put('/api/settings', response_model=BackupSettingsModel)
async def update_settings(payload: BackupSettingsUpdate) -> BackupSettingsModel:
    updated = save_settings({
        'enabled': payload.enabled,
        'cron': payload.cron,
        'retentionDays': payload.retentionDays,
    })
    apply_cron_schedule(updated)
    return BackupSettingsModel(**updated)


@app.post('/api/backups', response_model=BackupTriggerResponse)
async def trigger_backup(request: ManualBackupRequest) -> BackupTriggerResponse:
    try:
        job_id = controller.trigger(request.description)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return BackupTriggerResponse(backup_id=job_id, status='running')


@app.get('/api/backups', response_model=List[BackupHistoryEntry])
async def list_backups() -> List[BackupHistoryEntry]:
    bucket = _coalesce_bucket()
    s3 = get_s3_client()
    response = s3.list_objects_v2(Bucket=bucket, Prefix=f'{BACKUP_PREFIX}/')

    history: List[BackupHistoryEntry] = []
    settings = load_settings()

    if settings.get('lastStatus') == 'running':
        history.append(
            BackupHistoryEntry(
                id=settings.get('lastBackupId') or controller.current_job_id() or 'in-progress',
                status='running',
                started_at=settings.get('lastRunAt') or datetime.now().isoformat(),
                details='Backup currently running',
            )
        )

    for obj in response.get('Contents', []):
        key = obj['Key']
        if key.endswith('/'):
            continue
        last_modified = obj['LastModified']
        timestamp = last_modified.astimezone().isoformat() if last_modified else datetime.now().isoformat()
        history.append(
            BackupHistoryEntry(
                id=key,
                status='completed',
                started_at=timestamp,
                completed_at=timestamp,
                size_bytes=obj.get('Size'),
                download_url=key.split('/')[-1],
            )
        )

    history.sort(key=lambda entry: entry.started_at, reverse=True)
    return history


@app.get('/api/backups/{backup_id}/download')
async def download_backup(backup_id: str) -> StreamingResponse:
    bucket = _coalesce_bucket()
    s3 = get_s3_client()
    try:
        obj = s3.get_object(Bucket=bucket, Key=backup_id)
    except ClientError as exc:
        error_code = exc.response.get('Error', {}).get('Code')
        if error_code in {'NoSuchKey', '404'}:
            raise HTTPException(status_code=404, detail='Backup not found') from exc
        raise HTTPException(status_code=500, detail='Failed to download backup') from exc

    body = obj['Body']
    filename = backup_id.split('/')[-1]
    return StreamingResponse(
        body.iter_chunks(),
        media_type='application/octet-stream',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@app.delete('/api/backups/{backup_id}', status_code=204)
async def delete_backup(backup_id: str) -> Response:
    bucket = _coalesce_bucket()
    s3 = get_s3_client()
    try:
        s3.delete_object(Bucket=bucket, Key=backup_id)
    except ClientError as exc:
        error_code = exc.response.get('Error', {}).get('Code')
        if error_code in {'NoSuchKey', '404'}:
            raise HTTPException(status_code=404, detail='Backup not found') from exc
        raise HTTPException(status_code=500, detail='Failed to delete backup') from exc

    return Response(status_code=204)


@app.get('/api/status')
async def service_status() -> dict:
    settings = load_settings()
    return {
        'running': controller.is_running(),
        'job_id': controller.current_job_id(),
        'settings': settings,
    }
