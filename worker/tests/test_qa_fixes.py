"""Regression tests for the QA-pass bug fixes (see git history).

Covers the highest-risk worker fixes:
  * bounce detection must match WHOLE addresses, not substrings (data-loss bug:
    a substring match was suppressing valid, different contacts)
  * reply detection must only count messages that arrived AFTER we emailed
    (false-positive bug: an old/unrelated email from the same address was
    treated as a reply and could trigger an auto-resume)
  * the date/iso parsing helpers behave safely on missing/garbage input

Runnable two ways:
  python3 worker/tests/test_qa_fixes.py      # standalone, no pytest needed
  python3 -m pytest worker/tests/            # CI
"""
import os
import sys
import datetime as dt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), os.pardir))

from transports import (  # noqa: E402
    SmtpTransport, _addr_in_blob, _is_newer, _parse_iso, _msg_date,
)


# ---------------------------------------------------------------- bounce match
def test_bounce_substring_does_not_overmatch_longer_address():
    # the core data-loss regression: 'hr@acme.co' must NOT match in 'hr@acme.com'
    blob = "final-recipient: rfc822; hr@acme.com\nstatus: 5.1.1"
    assert _addr_in_blob("hr@acme.co", blob) is False
    assert _addr_in_blob("hr@acme.com", blob) is True


def test_bounce_prefix_and_empty():
    assert _addr_in_blob("ob@x.io", "to: <bob@x.io>") is False   # prefix leak
    assert _addr_in_blob("bob@x.io", "to: <bob@x.io>, cc: a@y.io") is True
    assert _addr_in_blob("", "anything") is False


def test_find_bounces_uses_whole_address():
    tx = SmtpTransport({"email": "me@x.com"}, "secret")
    tx._primed = True
    tx._bounce_blob = "delivery failed for hr@acme.com permanently".lower()
    # hr@acme.co is a different (valid) contact and must NOT be reported bounced
    assert tx.find_bounces(["hr@acme.com", "hr@acme.co"]) == {"hr@acme.com"}


# ---------------------------------------------------------------- reply timing
def _tx_with_reply(msg_date):
    tx = SmtpTransport({"email": "me@x.com"}, "secret")
    tx._primed = True
    tx._by_sender = {"rec@a.com": ("42", "thanks, send your resume", msg_date)}
    return tx


def test_reply_after_send_counts():
    tx = _tx_with_reply(_parse_iso("2026-06-20T12:00:00Z"))
    out = tx.find_reply({"email": "rec@a.com", "sent_at": "2026-06-20T09:00:00Z"})
    assert out == ("42", "thanks, send your resume")


def test_reply_before_send_is_ignored():
    # message predates our outreach -> NOT a reply (was a false-positive before)
    tx = _tx_with_reply(_parse_iso("2026-06-18T12:00:00Z"))
    out = tx.find_reply({"email": "rec@a.com", "sent_at": "2026-06-20T09:00:00Z"})
    assert out is None


def test_reply_falls_back_when_dates_missing():
    # no reliable date on the message -> don't drop a possible real reply
    tx = _tx_with_reply(None)
    out = tx.find_reply({"email": "rec@a.com", "sent_at": "2026-06-20T09:00:00Z"})
    assert out == ("42", "thanks, send your resume")


def test_no_message_returns_none():
    tx = SmtpTransport({"email": "me@x.com"}, "secret")
    tx._primed = True
    tx._by_sender = {}
    assert tx.find_reply({"email": "rec@a.com", "sent_at": "2026-06-20T09:00:00Z"}) is None


# ---------------------------------------------------------------- helpers
def test_parse_iso_safe():
    assert _parse_iso(None) is None
    assert _parse_iso("garbage") is None
    d = _parse_iso("2026-06-20T10:00:00Z")
    assert d is not None and d.tzinfo is not None


def test_is_newer_defaults_to_true_when_unknown():
    a = _parse_iso("2026-06-20T10:00:00Z")
    b = _parse_iso("2026-06-19T10:00:00Z")
    assert _is_newer(a, b) is True
    assert _is_newer(b, a) is False
    assert _is_newer(None, b) is True   # unknown date -> last-seen wins
    assert _is_newer(a, None) is True


def test_msg_date_parses_header():
    class M:
        def get(self, k):
            return "Sat, 20 Jun 2026 10:00:00 +0000" if k == "Date" else None
    d = _msg_date(M())
    assert d is not None and d.year == 2026


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    passed = 0
    for fn in fns:
        fn()
        print(f"  PASS  {fn.__name__}")
        passed += 1
    print(f"\n{passed}/{len(fns)} tests passed")
