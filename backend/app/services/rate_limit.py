"""A small in-process sliding-window rate limiter.

Wrench had no rate limiting. This is the smallest thing that stops OTP spam and
brute-force guessing without adding Redis or a middleware framework — the same
trade-off (and the same limitation) as `services/realtime.py`: state lives in
this process, so with more than one worker each worker enforces its own share of
the limit. A shared backplane is the fix when Wrench scales past one process.
"""

import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, status as http_status


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        """Record an attempt. False when `key` is over `limit` in the window."""
        now = time.monotonic()
        bucket = self._hits[key]
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)

    def clear(self) -> None:
        self._hits.clear()


#: One shared limiter for the auth surface.
limiter = SlidingWindowLimiter()


def enforce(key: str, limit: int, window_seconds: int, detail: str) -> None:
    """Raise 429 when `key` has exceeded its allowance."""
    if not limiter.hit(key, limit, window_seconds):
        raise HTTPException(
            status_code=http_status.HTTP_429_TOO_MANY_REQUESTS, detail=detail,
        )
