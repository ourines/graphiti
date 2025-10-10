from __future__ import annotations

import threading
import time
from datetime import datetime
from typing import List, Optional

from botocore.exceptions import ClientError
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backup import (
    BACKUP_PREFIX,
    R2_BUCKET_NAME,
    get_s3_client,
    perform_backup,
    perform_restore,
)
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
    restoreStartedAt: Optional[str] = None
    restoreCompletedAt: Optional[str] = None
    lastRestoreStatus: str
    lastRestoreId: Optional[str] = None
    lastRestoreError: Optional[str] = None
    restoreStatementsApplied: Optional[int] = None
    restoreTotalStatements: Optional[int] = None
    restorePhase: str
    restoreProgress: int


class BackupSettingsUpdate(BaseModel):
    enabled: bool
    cron: str
    retentionDays: int = Field(..., ge=1)


class ManualBackupRequest(BaseModel):
    description: Optional[str] = None


class BackupTriggerResponse(BaseModel):
    backup_id: str
    status: str


class RestoreTriggerResponse(BaseModel):
    backup_id: str
    job_id: str
    status: str


class RestoreStatusModel(BaseModel):
    running: bool
    job_id: Optional[str]
    lastRestoreStatus: str
    restoreStartedAt: Optional[str] = None
    restoreCompletedAt: Optional[str] = None
    lastRestoreId: Optional[str] = None
    lastRestoreError: Optional[str] = None
    restoreStatementsApplied: Optional[int] = None
    restoreTotalStatements: Optional[int] = None
    restorePhase: str
    restoreProgress: int


class BackupHistoryEntry(BaseModel):
    id: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    size_bytes: Optional[int] = None
    download_url: Optional[str] = None
    details: Optional[str] = None
    node_count: Optional[int] = None
    relationship_count: Optional[int] = None
    labels: Optional[List[str]] = None
    relationship_types: Optional[List[str]] = None


def _coalesce_bucket() -> str:
    if not R2_BUCKET_NAME:
        raise HTTPException(status_code=400, detail='R2 bucket is not configured')
    return R2_BUCKET_NAME


def _safe_int(value: Optional[str]) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _parse_pipe_separated(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item for item in value.split('|') if item]


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
class RestoreTaskController:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._job_id: Optional[str] = None

    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def current_job_id(self) -> Optional[str]:
        return self._job_id if self.is_running() else None

    def trigger(self, backup_key: str) -> str:
        with self._lock:
            if self.is_running():
                raise RuntimeError('Restore already in progress')

            job_id = f'restore-{int(time.time())}'
            thread = threading.Thread(
                target=self._run_restore,
                args=(job_id, backup_key),
                daemon=True,
            )
            self._thread = thread
            self._job_id = job_id
            thread.start()
            return job_id

    def _run_restore(self, job_id: str, backup_key: str) -> None:
        update_runtime_state(
            lastRestoreStatus='running',
            restoreStartedAt=datetime.now().isoformat(),
            restoreCompletedAt=None,
            lastRestoreId=backup_key,
            lastRestoreError=None,
            restoreStatementsApplied=None,
            restoreTotalStatements=None,
            restorePhase='downloading',
            restoreProgress=0,
        )

        result = perform_restore(backup_key)
        completed_at = (result.completed_at or datetime.now()).isoformat()

        if result.success:
            update_runtime_state(
                lastRestoreStatus='completed',
                restoreCompletedAt=completed_at,
                restoreStatementsApplied=result.statements_applied,
                restorePhase='completed',
                restoreProgress=result.statements_applied or 0,
            )
        else:
            update_runtime_state(
                lastRestoreStatus='failed',
                restoreCompletedAt=completed_at,
                lastRestoreError=result.error,
                restoreStatementsApplied=result.statements_applied,
                restorePhase='failed',
                restoreProgress=result.statements_applied or 0,
            )

        with self._lock:
            self._thread = None
            self._job_id = None


restore_controller = RestoreTaskController()
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


@app.post('/api/backups/{backup_id:path}/restore', response_model=RestoreTriggerResponse)
async def trigger_restore(backup_id: str) -> RestoreTriggerResponse:
    if controller.is_running():
        raise HTTPException(status_code=409, detail='Backup in progress, cannot restore simultaneously')

    try:
        job_id = restore_controller.trigger(backup_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return RestoreTriggerResponse(backup_id=backup_id, job_id=job_id, status='running')


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

        metadata: dict[str, str] = {}
        try:
            head = s3.head_object(Bucket=bucket, Key=key)
            metadata = head.get('Metadata', {}) or {}
        except ClientError as exc:  # pragma: no cover - best effort metadata fetch
            error_code = exc.response.get('Error', {}).get('Code') if hasattr(exc, 'response') else None
            log(f"Failed to fetch metadata for {key}: {error_code or exc}", 'WARN')

        node_count = _safe_int(metadata.get('meta-nodes'))
        relationship_count = _safe_int(metadata.get('meta-relationships'))
        labels = _parse_pipe_separated(metadata.get('meta-labels'))
        relationship_types = _parse_pipe_separated(metadata.get('meta-rel-types'))

        history.append(
            BackupHistoryEntry(
                id=key,
                status='completed',
                started_at=timestamp,
                completed_at=timestamp,
                size_bytes=obj.get('Size'),
                download_url=key.split('/')[-1],
                node_count=node_count,
                relationship_count=relationship_count,
                labels=labels or None,
                relationship_types=relationship_types or None,
            )
        )

    history.sort(key=lambda entry: entry.started_at, reverse=True)
    return history


@app.get('/api/restore/status', response_model=RestoreStatusModel)
async def restore_status() -> RestoreStatusModel:
    settings = load_settings()
    return RestoreStatusModel(
        running=restore_controller.is_running(),
        job_id=restore_controller.current_job_id(),
        lastRestoreStatus=settings.get('lastRestoreStatus', 'idle'),
        restoreStartedAt=settings.get('restoreStartedAt'),
        restoreCompletedAt=settings.get('restoreCompletedAt'),
        lastRestoreId=settings.get('lastRestoreId'),
        lastRestoreError=settings.get('lastRestoreError'),
        restoreStatementsApplied=settings.get('restoreStatementsApplied'),
        restoreTotalStatements=settings.get('restoreTotalStatements'),
        restorePhase=settings.get('restorePhase', 'idle'),
        restoreProgress=settings.get('restoreProgress', 0),
    )


@app.get('/api/backups/{backup_id:path}/download')
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


@app.delete('/api/backups/{backup_id:path}', status_code=204)
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
        'restore_running': restore_controller.is_running(),
        'restore_job_id': restore_controller.current_job_id(),
        'settings': settings,
    }
