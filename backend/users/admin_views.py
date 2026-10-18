"""
Legacy re-export module for admin views.

The concrete implementations now live in:
    - users.admin_users
    - users.admin_wallets

This module is kept for backwards compatibility with any existing imports.
New code should import directly from the canonical modules above.
"""

from users.admin_users import (  # noqa: F401
    AdminAnalyticsView,
    AdminCreateUserView,
    AdminStatsView,
    AdminTopProductsView,
    ClearFailedLoginsView,
    ResetUserPasswordView,
    ResetUserPinView,
    UserDetailView,
    UserLimitsView,
    UserListView,
    UserSuspendView,
    UserUnsuspendView,
)
from users.admin_wallets import (  # noqa: F401
    CreateUserVirtualAccountView,
    FundUserWalletView,
    PlatformFeesView,
    PlatformKYCView,
    UserVirtualAccountsView,
    UserWalletTransactionView,
)
