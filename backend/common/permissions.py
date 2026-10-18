"""
Custom permission classes for role-based access control.
"""

from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """
    Allows access only to admin users (is_superuser or role=ADMIN).
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or getattr(request.user, "role", None) == "ADMIN"
            )
        )


class IsAgentUser(BasePermission):
    """
    Allows access only to agent users.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "AGENT"
        )


class IsCustomerUser(BasePermission):
    """
    Allows access only to customer users.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "CUSTOMER"
        )


class IsAdminOrReadOnly(BasePermission):
    """
    Admin can do anything, others can only read.
    """

    def has_permission(self, request, view):
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return request.user and request.user.is_authenticated
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or getattr(request.user, "role", None) == "ADMIN"
            )
        )


class IsOwnerOrAdmin(BasePermission):
    """
    Allows access to admin or object owner.
    """

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser or getattr(request.user, "role", None) == "ADMIN":
            return True

        # Check if user owns the object
        if hasattr(obj, "user"):
            return obj.user == request.user
        if hasattr(obj, "owner"):
            return obj.owner == request.user

        return False
