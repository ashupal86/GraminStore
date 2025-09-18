"""
Caching utilities for load balancing and performance optimization
"""
import json
import time
from typing import Any, Optional, Dict
from functools import wraps
from app.config import settings

# Redis client for caching (if available)
try:
    import redis
    redis_client = redis.Redis(
        host=getattr(settings, 'REDIS_HOST', 'localhost'),
        port=getattr(settings, 'REDIS_PORT', 6379),
        db=getattr(settings, 'REDIS_DB', 0),
        decode_responses=True
    )
    redis_client.ping()  # Test connection
    REDIS_AVAILABLE = True
except:
    REDIS_AVAILABLE = False
    redis_client = None

# In-memory cache as fallback
memory_cache: Dict[str, Dict[str, Any]] = {}

def get_cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate a cache key from prefix and arguments"""
    key_parts = [prefix]
    for arg in args:
        key_parts.append(str(arg))
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}:{v}")
    return ":".join(key_parts)

def cache_result(expiry_seconds: int = 300, prefix: str = "default"):
    """
    Decorator to cache function results
    
    Args:
        expiry_seconds: How long to cache the result (default 5 minutes)
        prefix: Prefix for cache keys
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = get_cache_key(prefix, func.__name__, *args, **kwargs)
            
            # Try to get from cache
            cached_result = get_from_cache(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            set_cache(cache_key, result, expiry_seconds)
            return result
        
        return wrapper
    return decorator

def get_from_cache(key: str) -> Optional[Any]:
    """Get value from cache (Redis or memory)"""
    if REDIS_AVAILABLE and redis_client:
        try:
            cached = redis_client.get(key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"Redis cache error: {e}")
    
    # Fallback to memory cache
    if key in memory_cache:
        cache_entry = memory_cache[key]
        if time.time() < cache_entry['expires_at']:
            return cache_entry['value']
        else:
            del memory_cache[key]
    
    return None

def set_cache(key: str, value: Any, expiry_seconds: int = 300):
    """Set value in cache (Redis or memory)"""
    if REDIS_AVAILABLE and redis_client:
        try:
            redis_client.setex(key, expiry_seconds, json.dumps(value, default=str))
            return
        except Exception as e:
            print(f"Redis cache error: {e}")
    
    # Fallback to memory cache
    memory_cache[key] = {
        'value': value,
        'expires_at': time.time() + expiry_seconds
    }
    
    # Clean up expired entries periodically
    if len(memory_cache) > 1000:  # Arbitrary limit
        current_time = time.time()
        expired_keys = [
            k for k, v in memory_cache.items() 
            if current_time >= v['expires_at']
        ]
        for k in expired_keys:
            del memory_cache[k]

def invalidate_cache(pattern: str = None):
    """Invalidate cache entries matching pattern"""
    if REDIS_AVAILABLE and redis_client:
        try:
            if pattern:
                keys = redis_client.keys(pattern)
                if keys:
                    redis_client.delete(*keys)
            else:
                redis_client.flushdb()
        except Exception as e:
            print(f"Redis cache invalidation error: {e}")
    
    # Clear memory cache
    if pattern:
        keys_to_remove = [k for k in memory_cache.keys() if pattern in k]
        for k in keys_to_remove:
            del memory_cache[k]
    else:
        memory_cache.clear()

def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    stats = {
        'redis_available': REDIS_AVAILABLE,
        'memory_cache_size': len(memory_cache),
        'memory_cache_keys': list(memory_cache.keys())[:10]  # First 10 keys
    }
    
    if REDIS_AVAILABLE and redis_client:
        try:
            stats['redis_info'] = redis_client.info()
        except Exception as e:
            stats['redis_error'] = str(e)
    
    return stats
