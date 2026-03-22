"""
Role-based permission checks.

Roles: admin, supervisor, crew_chief
"""

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    CREW_CHIEF = "crew_chief"
