"""Shared test setup."""
import os

# Tests use readable session ids ("p-day2"); production requires 32 hex characters (services/session.py).
os.environ["LUMI_LOOSE_SESSION_IDS"] = "1"
