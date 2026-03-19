from pathlib import Path

_cache: dict = {}
MAX_CACHE_SIZE = 100


def cached(key: str, filepath: Path, loader):
    """mtime 기반 캐시: 파일이 변경된 경우에만 재파싱"""
    if not filepath.exists():
        return None
    mtime = filepath.stat().st_mtime
    if key in _cache and _cache[key]["mtime"] == mtime:
        return _cache[key]["data"]
    data = loader(filepath)
    if len(_cache) >= MAX_CACHE_SIZE:
        del _cache[next(iter(_cache))]
    _cache[key] = {"mtime": mtime, "data": data}
    return data
