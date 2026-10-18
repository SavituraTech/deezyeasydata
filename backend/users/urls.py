from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .admin_users import (
    AdminAnalyticsView,
    AdminCreateUserView,
    AdminStatsView,
    AdminTopProductsView,
    AdminExportView,
    ClearFailedLoginsView,
    ResetUserPasswordView,
    ResetUserPinView,
    UserDetailView,
    UserLimitsView,
    UserListView,
    UserSuspendView,
    UserUnsuspendView,
)
from .admin_wallets import (
    CreateUserVirtualAccountView,
    FundUserWalletView,
    PlatformFeesView,
    PlatformKYCView,
    UserVirtualAccountsView,
    UserWalletTransactionView,
    WalletAdjustmentDecisionView,
    WalletAdjustmentListView,
)
from .views import (
    ChangePasswordView,
    CustomTokenObtainPairView,
    MeView,
    ProfileView,
    RegisterView,
    UpdateProfileView,
)


urlpatterns = [
    # Auth — canonical (no version prefix)
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("profile/", ProfileView.as_view(), name="profile"),
    # Protected user endpoints
    path("me/", MeView.as_view(), name="me"),
    path("me/profile/", UpdateProfileView.as_view(), name="update_profile"),
    path("me/password/", ChangePasswordView.as_view(), name="change_password"),
    # Admin endpoints
    path("admin/users/", UserListView.as_view(), name="user_list"),
    path("admin/users/create/", AdminCreateUserView.as_view(), name="user_create"),
    path("admin/users/<int:pk>/", UserDetailView.as_view(), name="user_detail"),
    path(
        "admin/users/<int:pk>/fund/", FundUserWalletView.as_view(), name="fund_wallet"
    ),
    path("admin/users/<int:pk>/suspend/", UserSuspendView.as_view(), name="user_suspend"),
    path(
        "admin/users/<int:pk>/unsuspend/",
        UserUnsuspendView.as_view(),
        name="user_unsuspend",
    ),
    path("admin/users/<int:pk>/limits/", UserLimitsView.as_view(), name="user_limits"),
    path(
        "admin/users/<int:pk>/reset-password/",
        ResetUserPasswordView.as_view(),
        name="user_reset_password",
    ),
    path("admin/users/<int:pk>/reset-pin/", ResetUserPinView.as_view(), name="user_reset_pin"),
    path(
        "admin/users/<int:pk>/clear-logins/",
        ClearFailedLoginsView.as_view(),
        name="user_clear_logins",
    ),
    path("admin/wallet-adjustments/", WalletAdjustmentListView.as_view(), name="wallet_adjustments"),
    path(
        "admin/wallet-adjustments/<int:pk>/approve/",
        WalletAdjustmentDecisionView.as_view(action="approve"),
        name="wallet_adjustment_approve",
    ),
    path(
        "admin/wallet-adjustments/<int:pk>/reject/",
        WalletAdjustmentDecisionView.as_view(action="reject"),
        name="wallet_adjustment_reject",
    ),
    path(
        "admin/users/<int:pk>/wallet-transaction/",
        UserWalletTransactionView.as_view(),
        name="user_wallet_transaction",
    ),
    path(
        "admin/users/<int:pk>/accounts/",
        UserVirtualAccountsView.as_view(),
        name="user_accounts",
    ),
    path(
        "admin/users/<int:pk>/create-account/",
        CreateUserVirtualAccountView.as_view(),
        name="user_create_account",
    ),
    path("admin/stats/", AdminStatsView.as_view(), name="admin_stats"),
    path("admin/analytics/", AdminAnalyticsView.as_view(), name="admin_analytics"),
    path("admin/top-products/", AdminTopProductsView.as_view(), name="admin_top_products"),
    path("admin/exports/<str:dataset>/", AdminExportView.as_view(), name="admin_export"),
    path("admin/settings/platform-kyc/", PlatformKYCView.as_view(), name="platform_kyc"),
    path("admin/settings/platform-fees/", PlatformFeesView.as_view(), name="platform_fees"),
]
