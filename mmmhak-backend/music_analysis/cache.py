# mmmhak-backend/music_analysis/cache.py
"""
Abstract Base Cache Interface and concrete Memory Cache implementation 
to support pluggable database/caching engines (Memory, SQLite, Redis).
"""

import time
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple

class BaseCache(ABC):
    """
    Abstract Base Cache Interface outlining required cache interactions.
    """
    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        """Retrieves an item from the cache. Returns None if expired or not found."""
        pass

    @abstractmethod
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Saves an item to the cache with an optional time-to-live in seconds."""
        pass

    @abstractmethod
    def delete(self, key: str) -> None:
        """Removes a specific item from the cache."""
        pass

    @abstractmethod
    def clear(self) -> None:
        """Purges all entries in the cache."""
        pass


class MemoryCache(BaseCache):
    """
    Simple thread-safe memory cache using local dictionaries and TTL tracking.
    """
    def __init__(self):
        self._store: Dict[str, Tuple[Any, Optional[float]]] = {}

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            return None
            
        value, expiry = self._store[key]
        if expiry is not None and time.time() > expiry:
            self.delete(key)
            return None
            
        return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        expiry = time.time() + ttl if ttl is not None else None
        self._store[key] = (value, expiry)

    def delete(self, key: str) -> None:
        if key in self._store:
            del self._store[key]

    def clear(self) -> None:
        self._store.clear()
