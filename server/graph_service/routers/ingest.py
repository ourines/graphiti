import asyncio
import uuid
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime
from functools import partial
from typing import Deque, Dict, Any

from fastapi import APIRouter, FastAPI, status
from graphiti_core.nodes import EpisodeType  # type: ignore
from graphiti_core.utils.maintenance.graph_data_operations import clear_data  # type: ignore

from graph_service.dto import AddEntityNodeRequest, AddMessagesRequest, Message, Result
from graph_service.zep_graphiti import ZepGraphitiDep, create_llm_client, create_embedder, ZepGraphiti
from graph_service.config import get_settings


class JobStatus:
    """Track job execution status"""
    def __init__(self, job_id: str, job_type: str):
        self.job_id = job_id
        self.job_type = job_type
        self.started_at = datetime.utcnow().isoformat()
        self.completed_at: str | None = None
        self.status: str = 'pending'  # pending, processing, completed, failed
        self.error: str | None = None
        self.retry_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            'job_id': self.job_id,
            'job_type': self.job_type,
            'started_at': self.started_at,
            'completed_at': self.completed_at,
            'status': self.status,
            'error': self.error,
            'retry_count': self.retry_count,
        }


class AsyncWorker:
    MAX_RETRIES = 3
    INITIAL_RETRY_DELAY = 10  # seconds
    MAX_HISTORY = 100  # Keep last 100 jobs

    def __init__(self):
        self.queue = asyncio.Queue()
        self.task = None
        self.job_history: Deque[JobStatus] = deque(maxlen=self.MAX_HISTORY)
        self.current_job: JobStatus | None = None

    def get_status(self) -> Dict[str, Any]:
        """Get current worker status"""
        return {
            'queue_size': self.queue.qsize(),
            'current_job': self.current_job.to_dict() if self.current_job else None,
            'recent_jobs': [job.to_dict() for job in list(self.job_history)[-20:]],
        }

    async def worker(self):
        while True:
            job_status = None
            try:
                queue_size = self.queue.qsize()
                print(f'Got a job: (size of remaining queue: {queue_size})')

                job, job_id, job_type = await self.queue.get()

                # Create job status
                job_status = JobStatus(job_id, job_type)
                self.current_job = job_status
                job_status.status = 'processing'

                # Retry logic with exponential backoff
                retry_delay = self.INITIAL_RETRY_DELAY
                last_error = None

                for attempt in range(self.MAX_RETRIES):
                    try:
                        await job()
                        job_status.status = 'completed'
                        job_status.completed_at = datetime.utcnow().isoformat()
                        print(f'✅ Job {job_id} completed successfully')
                        break
                    except Exception as e:
                        last_error = e
                        error_type = type(e).__name__

                        # Check if it's a rate limit error
                        is_rate_limit = 'RateLimitError' in error_type or 'rate limit' in str(e).lower()

                        if is_rate_limit and attempt < self.MAX_RETRIES - 1:
                            job_status.retry_count = attempt + 1
                            print(f'⚠️  Rate limit hit, retrying in {retry_delay}s (attempt {attempt + 1}/{self.MAX_RETRIES})')
                            await asyncio.sleep(retry_delay)
                            retry_delay *= 2  # Exponential backoff
                        else:
                            raise

                # If all retries exhausted
                if job_status.status != 'completed':
                    raise last_error or Exception('Job failed after retries')

            except asyncio.CancelledError:
                if job_status:
                    job_status.status = 'cancelled'
                    job_status.completed_at = datetime.utcnow().isoformat()
                break
            except Exception as e:
                error_msg = f'{type(e).__name__}: {e}'
                print(f'❌ Job failed with error: {error_msg}')
                import traceback
                traceback.print_exc()

                if job_status:
                    job_status.status = 'failed'
                    job_status.error = error_msg
                    job_status.completed_at = datetime.utcnow().isoformat()
            finally:
                if job_status:
                    self.job_history.append(job_status)
                    self.current_job = None

    async def start(self):
        self.task = asyncio.create_task(self.worker())

    async def stop(self):
        if self.task:
            self.task.cancel()
            await self.task
        while not self.queue.empty():
            self.queue.get_nowait()


async_worker = AsyncWorker()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await async_worker.start()
    yield
    await async_worker.stop()


router = APIRouter(lifespan=lifespan)


@router.post('/messages', status_code=status.HTTP_202_ACCEPTED)
async def add_messages(
    request: AddMessagesRequest,
    graphiti: ZepGraphitiDep,
):
    async def add_messages_task(m: Message, group_id: str):
        # ✅ 创建独立的 graphiti 实例避免连接被关闭
        settings = get_settings()
        llm_client = create_llm_client(settings)
        embedder = create_embedder(settings)

        task_graphiti = ZepGraphiti(
            uri=settings.neo4j_uri,
            user=settings.neo4j_user,
            password=settings.neo4j_password,
            llm_client=llm_client,
            embedder=embedder,
        )

        try:
            # Don't pass uuid to add_episode - let GraphiTi generate it
            # The uuid from message is only used for job tracking
            await task_graphiti.add_episode(
                group_id=group_id,
                name=m.name,
                episode_body=f'{m.role or ""}({m.role_type}): {m.content}',
                reference_time=m.timestamp,
                source=EpisodeType.message,
                source_description=m.source_description,
            )
        finally:
            await task_graphiti.close()

    for m in request.messages:
        # Generate job_id from message uuid or create new one if not provided
        msg_id = m.uuid[:8] if m.uuid else uuid.uuid4().hex[:8]
        job_id = f'msg_{msg_id}'
        job_type = f'add_episode:{m.name}'
        await async_worker.queue.put((partial(add_messages_task, m, request.group_id), job_id, job_type))

    return Result(message='Messages added to processing queue', success=True)


@router.get('/queue/status', status_code=status.HTTP_200_OK)
async def get_queue_status():
    """Get current queue processing status"""
    return async_worker.get_status()


@router.post('/entity-node', status_code=status.HTTP_201_CREATED)
async def add_entity_node(
    request: AddEntityNodeRequest,
    graphiti: ZepGraphitiDep,
):
    node = await graphiti.save_entity_node(
        uuid=request.uuid,
        group_id=request.group_id,
        name=request.name,
        summary=request.summary,
    )
    return node


@router.delete('/entity-edge/{uuid}', status_code=status.HTTP_200_OK)
async def delete_entity_edge(uuid: str, graphiti: ZepGraphitiDep):
    await graphiti.delete_entity_edge(uuid)
    return Result(message='Entity Edge deleted', success=True)


@router.delete('/group/{group_id}', status_code=status.HTTP_200_OK)
async def delete_group(group_id: str, graphiti: ZepGraphitiDep):
    await graphiti.delete_group(group_id)
    return Result(message='Group deleted', success=True)


@router.delete('/episode/{uuid}', status_code=status.HTTP_200_OK)
async def delete_episode(uuid: str, graphiti: ZepGraphitiDep):
    await graphiti.delete_episodic_node(uuid)
    return Result(message='Episode deleted', success=True)


@router.post('/clear', status_code=status.HTTP_200_OK)
async def clear(
    graphiti: ZepGraphitiDep,
):
    await clear_data(graphiti.driver)
    await graphiti.build_indices_and_constraints()
    return Result(message='Graph cleared', success=True)
