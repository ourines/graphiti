import json
import os
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Dict

from croniter import croniter

CONFIG_PATH = Path(os.getenv('BACKUP_CONFIG_PATH', '/app/data/backup_settings.json'))
CRONTAB_PATH = Path('/var/spool/cron/crontabs/root')
BACKUP_COMMAND = os.getenv('BACKUP_COMMAND', '/usr/local/bin/python3 /app/backup.py > /proc/1/fd/1 2>&1')

DEFAULT_SETTINGS: Dict[str, Any] = {
    'enabled': os.getenv('BACKUP_ENABLED', 'true').lower() != 'false',
    'cron': os.getenv('BACKUP_SCHEDULE', '0 2 * * *'),
    'retentionDays': int(os.getenv('BACKUP_RETENTION_DAYS', '7')),
    'lastRunAt': None,
    'lastStatus': 'idle',
    'lastBackupId': None,
    'lastError': None,
    'restoreStartedAt': None,
    'restoreCompletedAt': None,
    'lastRestoreStatus': 'idle',
    'lastRestoreId': None,
    'lastRestoreError': None,
    'restoreStatementsApplied': None,
    'restoreTotalStatements': None,
    'restorePhase': 'idle',
    'restoreProgress': 0,
}

PERSISTED_KEYS = set(DEFAULT_SETTINGS.keys())
_lock = Lock()


def _ensure_config_dir() -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CRONTAB_PATH.parent.mkdir(parents=True, exist_ok=True)


def ensure_config() -> Dict[str, Any]:
    _ensure_config_dir()
    if not CONFIG_PATH.exists():
        save_settings(DEFAULT_SETTINGS)
    return load_settings()


def load_settings() -> Dict[str, Any]:
    _ensure_config_dir()
    if not CONFIG_PATH.exists():
        return DEFAULT_SETTINGS.copy()

    with _lock:
        with CONFIG_PATH.open('r', encoding='utf-8') as handle:
            data = json.load(handle)

    merged = DEFAULT_SETTINGS.copy()
    merged.update(data)
    merged['nextRunAt'] = compute_next_run(merged)
    return merged


def save_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_config_dir()
    payload = {key: settings.get(key) for key in PERSISTED_KEYS}
    with _lock:
        with CONFIG_PATH.open('w', encoding='utf-8') as handle:
            json.dump(payload, handle, indent=2)
    sync_runtime_with_settings(payload)
    return load_settings()


def update_settings(partial: Dict[str, Any]) -> Dict[str, Any]:
    current = load_settings()
    current.update(partial)
    return save_settings(current)


def update_runtime_state(**kwargs: Any) -> Dict[str, Any]:
    return update_settings(kwargs)


def compute_next_run(settings: Dict[str, Any]) -> Any:
    if not settings.get('enabled'):
        return None

    cron_expr = settings.get('cron')
    if not cron_expr:
        return None

    try:
        iterator = croniter(cron_expr, datetime.now())
        return iterator.get_next(datetime).isoformat()
    except (ValueError, TypeError):
        return None


def apply_cron_schedule(settings: Dict[str, Any]) -> None:
    _ensure_config_dir()
    if settings.get('enabled') and settings.get('cron'):
        line = f"{settings['cron']} {BACKUP_COMMAND}\n"
    else:
        line = '# Backups disabled\n'

    with CRONTAB_PATH.open('w', encoding='utf-8') as handle:
        handle.write(line)
    os.chmod(CRONTAB_PATH, 0o600)


def sync_runtime_with_settings(settings: Dict[str, Any]) -> None:
    os.environ['BACKUP_SCHEDULE'] = settings.get('cron', DEFAULT_SETTINGS['cron'])
    os.environ['BACKUP_RETENTION_DAYS'] = str(settings.get('retentionDays', DEFAULT_SETTINGS['retentionDays']))
    os.environ['BACKUP_ENABLED'] = 'true' if settings.get('enabled', True) else 'false'

    try:
        import backup as backup_module  # type: ignore

        backup_module.BACKUP_RETENTION_DAYS = int(os.environ['BACKUP_RETENTION_DAYS'])
    except Exception:
        # Avoid circular import issues during bootstrap
        pass
