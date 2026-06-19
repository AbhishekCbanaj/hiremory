"""
Decision logic for follow-ups and reply handling.
Pure functions, no Gmail calls, so they are easy to reason about and test.
"""
import datetime as dt
import config


def classify_reply(text: str) -> str:
    """Classify a reply body as 'positive' (wants resume), 'negative'
    (no openings / stop), or 'neutral' (needs a human)."""
    t = (text or "").lower()
    if any(cue in t for cue in config.NEGATIVE_CUES):
        return "negative"
    if any(cue in t for cue in config.POSITIVE_CUES):
        return "positive"
    return "neutral"


def _days_since(iso_ts: str) -> float:
    try:
        sent = dt.datetime.fromisoformat(iso_ts)
    except (ValueError, TypeError):
        return 0.0
    return (dt.datetime.now() - sent).total_seconds() / 86400.0


def due_for_followup(log_df) -> list[dict]:
    """Rows that should get a follow-up now: no reply, no bounce, enough days
    elapsed since the last contact, and under the follow-up cap."""
    if log_df is None or log_df.empty:
        return []
    due = []
    for _, r in log_df.iterrows():
        status = str(r.get("status", "sent")).lower()
        if status not in ("sent", "awaiting"):
            continue  # replied / bounced / resume_sent / not_now -> leave alone
        fu = int(r.get("followup_count", 0) or 0)
        if fu >= config.MAX_FOLLOWUPS:
            continue
        last_ts = r.get("last_action_at") or r.get("sent_at")
        if _days_since(str(last_ts)) >= config.FOLLOWUP_DAYS:
            due.append(r.to_dict())
    return due
