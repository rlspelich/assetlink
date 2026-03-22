"""
Role-based permission checks.

Roles: admin, supervisor, field_worker, viewer
"""

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    FIELD_WORKER = "field_worker"
    VIEWER = "viewer"
