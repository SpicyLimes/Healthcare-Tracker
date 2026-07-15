# backend/app/services/reminder_defaults.py
"""The default Daily Reminders document.

Structure ported from the "One-Page Reminders" editor prototype's `defaultData()`.
The sample content is deliberately generic (over-the-counter meds and vitamins) —
this ships in a public repo, so it must not describe any real person's regimen.
Kept server-side so a fresh install renders a sensible sheet before any edit.
"""
import copy
from typing import Any

_DEFAULT_LAYOUT: dict[str, Any] = {
    "headerEmoji": "💊",
    "title": "MY DAILY MEDICATIONS",
    "subtitle": "A reminder of what to take and when",
    "sidebarHead": "📋 DAILY REMINDERS",
    "showSidebar": True,
    "showAvoid": True,
    "showUpdated": True,
    "updated": "",
    "reminders": [
        {"emoji": "🍽️", "title": "Eat", "desc": "Small meals multiple times per day"},
        {"emoji": "💧", "title": "Hydrate", "desc": "Water or electrolyte drinks"},
        {"emoji": "🚶", "title": "Move", "desc": "A short walk when you can"},
    ],
    "sections": [
        {
            "emoji": "☀️", "name": "MORNING", "when": "Take in the morning",
            "theme": "morning", "customTheme": None, "visible": True,
            "meds": [
                {"emoji": "🌈", "name": "Multivitamin", "desc": "Daily vitamin · 1 tablet · Once a day", "badge": ""},
                {"emoji": "💊", "name": "Aspirin", "desc": "Low dose · 1 tablet · Once a day", "badge": ""},
            ],
        },
        {
            "emoji": "🌤️", "name": "MIDDAY", "when": "Take around lunchtime",
            "theme": "midday", "customTheme": None, "visible": True,
            "meds": [
                {"emoji": "🌼", "name": "Zyrtec", "desc": "Allergy medicine · 1 tablet · Once a day", "badge": ""},
                {"emoji": "🦴", "name": "Calcium + Vitamin D", "desc": "Bone supplement · 1 tablet · Twice a day", "badge": ""},
            ],
        },
        {
            "emoji": "🌙", "name": "EVENING", "when": "Take with dinner or at bedtime",
            "theme": "evening", "customTheme": None, "visible": True,
            "meds": [
                {"emoji": "🦴", "name": "Calcium + Vitamin D", "desc": "Bone supplement · 1 tablet · Twice a day", "badge": ""},
                {"emoji": "🐟", "name": "Fish Oil", "desc": "Omega-3 supplement · 1 capsule · Once a day", "badge": ""},
            ],
        },
        {
            "emoji": "⚠️", "name": "AS NEEDED ONLY", "when": "Do NOT take every day",
            "theme": "asneeded", "customTheme": None, "visible": True,
            "meds": [
                {"emoji": "🛡️", "name": "Tylenol", "desc": "For pain only · Only take when you need it · Ask your doctor if unsure", "badge": "⚠️ AS NEEDED"},
            ],
        },
    ],
    "avoid": [
        {"emoji": "💊", "text": "Any medicine not on this list without asking first"},
        {"emoji": "🚫", "text": "Grapefruit juice · Alcohol"},
    ],
    "notes": "",
}


def default_layout() -> dict[str, Any]:
    """A fresh deep copy — callers may mutate the result freely."""
    return copy.deepcopy(_DEFAULT_LAYOUT)
