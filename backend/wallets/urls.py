from django.urls import path
from .views import (
    WalletDetailView,
    WalletLedgerView,
    InitiateDepositView,
    VirtualAccountView,
    WalletConfigView,
    PaymentProvidersView,
    AdminWalletConfigView,
    AdminWalletTransactionView,
)

urlpatterns = [
    path("", WalletDetailView.as_view(), name="wallet_detail"),
    path("ledger/", WalletLedgerView.as_view(), name="wallet_ledger"),
    path("virtual-account/", VirtualAccountView.as_view(), name="wallet_virtual_account"),
    path("config/", WalletConfigView.as_view(), name="wallet_config"),
    path("payment-providers/", PaymentProvidersView.as_view(), name="wallet_payment_providers"),
    path("admin/config/", AdminWalletConfigView.as_view(), name="wallet_admin_config"),
    path("admin/wallet-transaction/", AdminWalletTransactionView.as_view(), name="wallet_admin_transaction"),
    path("initiate-deposit/", InitiateDepositView.as_view(), name="initiate_deposit"),
]
