"""
Thin Supabase REST + Storage client for the worker.

Uses the SERVICE ROLE key, so it bypasses RLS and can read the locked
gmail_tokens table. Never ship this key to the browser.
"""
import os
import requests

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
REST = f"{URL}/rest/v1"
STORAGE = f"{URL}/storage/v1"

_HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}


def _check(r: requests.Response) -> requests.Response:
    if not r.ok:
        raise RuntimeError(f"{r.status_code} {r.request.method} {r.url}\n{r.text}")
    return r


def select(table: str, params: dict) -> list[dict]:
    r = _check(requests.get(f"{REST}/{table}", headers=_HEADERS, params=params, timeout=30))
    return r.json()


def insert(table: str, row: dict) -> dict:
    headers = {**_HEADERS, "Prefer": "return=representation"}
    r = _check(requests.post(f"{REST}/{table}", headers=headers, json=row, timeout=30))
    data = r.json()
    return data[0] if isinstance(data, list) and data else data


def upsert(table: str, row: dict, on_conflict: str) -> None:
    headers = {**_HEADERS, "Prefer": "resolution=merge-duplicates"}
    _check(requests.post(f"{REST}/{table}", headers=headers,
                        params={"on_conflict": on_conflict}, json=row, timeout=30))


def update(table: str, match: dict, patch: dict) -> None:
    params = {k: f"eq.{v}" for k, v in match.items()}
    _check(requests.patch(f"{REST}/{table}", headers=_HEADERS, params=params,
                          json=patch, timeout=30))


def download(bucket: str, path: str) -> bytes:
    """Fetch a private object's bytes from Supabase Storage."""
    r = _check(requests.get(f"{STORAGE}/object/{bucket}/{path}",
                            headers={"Authorization": f"Bearer {KEY}"}, timeout=60))
    return r.content
