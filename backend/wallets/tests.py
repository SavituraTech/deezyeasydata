from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from wallets.models import AdminWalletAdjustment, Ledger, Wallet

User = get_user_model()
URL = "/api/users/admin/users/{}/wallet-transaction/"


@override_settings(
    ADMIN_MAX_ADJUSTMENT_AMOUNT=1_000_000,
    ADMIN_DAILY_CREDIT_LIMIT=500_000,
    ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD=100_000,
    MAX_TRANSACTION_AMOUNT=50_000,
    MIN_WALLET_BALANCE=100,
)
class AdminWalletAdjustmentTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="adm", email="a@x.com", password="p", is_superuser=True)
        self.admin2 = User.objects.create_user(username="adm2", email="a2@x.com", password="p", is_superuser=True)
        self.user = User.objects.create_user(username="cust", email="c@x.com", password="p")
        self.wallet = Wallet.objects.create(user=self.user, balance=Decimal("1000"), cashback_balance=Decimal("50"))
        self.c = APIClient()
        self.c.force_authenticate(self.admin)

    def post(self, body, user=None, client=None):
        return (client or self.c).post(URL.format((user or self.user).pk), body, format="json")

    def balance(self):
        self.wallet.refresh_from_db()
        return self.wallet.balance

    def test_frontend_style_debit_actually_debits(self):
        r = self.post({"action": "debit", "amount": "300", "description": "Chargeback"})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["type"], "DEBIT")
        self.assertEqual(self.balance(), Decimal("700"))
        self.user.refresh_from_db()
        self.assertEqual(self.user.balance, Decimal("700"))

    def test_missing_type_is_rejected_not_credited(self):
        r = self.post({"amount": "300", "reason": "oops"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.balance(), Decimal("1000"))

    def test_reason_required(self):
        r = self.post({"type": "CREDIT", "amount": "10"})
        self.assertEqual(r.status_code, 400)

    def test_audit_record_and_response(self):
        r = self.post({"type": "CREDIT", "amount": "250.50", "reason": "Goodwill", "idempotency_key": "k1"})
        body = r.json()
        self.assertEqual(body["balance_before"], "1000.00")
        self.assertEqual(body["balance_after"], "1250.50")
        adj = AdminWalletAdjustment.objects.get()
        self.assertEqual(adj.admin, self.admin)
        self.assertEqual(adj.reason, "Goodwill")
        self.assertEqual(adj.status, "APPLIED")
        self.assertEqual(adj.ledger.reference, body["reference"])
        self.assertIn("Goodwill", adj.ledger.description)

    def test_idempotent_replay_credits_once(self):
        body = {"type": "CREDIT", "amount": "100", "reason": "Promo", "idempotency_key": "same"}
        first = self.post(body)
        second = self.post(body)
        self.assertFalse(first.json()["replayed"])
        self.assertTrue(second.json()["replayed"])
        self.assertEqual(self.balance(), Decimal("1100"))
        self.assertEqual(AdminWalletAdjustment.objects.count(), 1)

    def test_idempotency_key_reuse_with_different_payload_conflicts(self):
        self.post({"type": "CREDIT", "amount": "100", "reason": "Promo", "idempotency_key": "k"})
        r = self.post({"type": "CREDIT", "amount": "200", "reason": "Promo", "idempotency_key": "k"})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self.balance(), Decimal("1100"))

    def test_header_idempotency_key(self):
        for _ in range(2):
            self.c.post(URL.format(self.user.pk), {"type": "CREDIT", "amount": "10", "reason": "hdr"},
                        format="json", HTTP_IDEMPOTENCY_KEY="hk")
        self.assertEqual(self.balance(), Decimal("1010"))

    def test_admin_debit_bypasses_user_limits_but_not_zero(self):
        Wallet.objects.filter(pk=self.wallet.pk).update(balance=Decimal("80000"))
        ok = self.post({"type": "DEBIT", "amount": "60000", "reason": "Fraud reversal"})
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertEqual(self.balance(), Decimal("20000"))
        # Can drain below MIN_WALLET_BALANCE but not below zero.
        self.assertEqual(self.post({"type": "DEBIT", "amount": "20000", "reason": "Drain"}).status_code, 200)
        self.assertEqual(self.balance(), Decimal("0"))
        self.assertEqual(self.post({"type": "DEBIT", "amount": "1", "reason": "Too much"}).status_code, 400)

    def test_cannot_adjust_own_wallet(self):
        Wallet.objects.create(user=self.admin, balance=Decimal("0"))
        r = self.post({"type": "CREDIT", "amount": "10", "reason": "self"}, user=self.admin)
        self.assertEqual(r.status_code, 403)

    def test_per_operation_cap(self):
        r = self.post({"type": "CREDIT", "amount": "1000001", "reason": "too big"})
        self.assertEqual(r.status_code, 400)

    def test_daily_credit_limit(self):
        with override_settings(ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD=0):
            self.assertEqual(self.post({"type": "CREDIT", "amount": "400000", "reason": "aaa"}).status_code, 200)
            self.assertEqual(self.post({"type": "CREDIT", "amount": "200000", "reason": "bbb"}).status_code, 400)
            # Debits are not counted against the credit limit.
            self.assertEqual(self.post({"type": "DEBIT", "amount": "200000", "reason": "ccc"}).status_code, 200)

    def test_large_adjustment_needs_second_admin(self):
        r = self.post({"type": "CREDIT", "amount": "150000", "reason": "Big correction"})
        self.assertEqual(r.status_code, 202)
        adj_id = r.json()["id"]
        self.assertEqual(self.balance(), Decimal("1000"))

        approve = f"/api/users/admin/wallet-adjustments/{adj_id}/approve/"
        self.assertEqual(self.c.post(approve).status_code, 403)  # requester can't self-approve
        self.assertEqual(self.balance(), Decimal("1000"))

        other = APIClient()
        other.force_authenticate(self.admin2)
        done = other.post(approve)
        self.assertEqual(done.status_code, 200, done.content)
        self.assertEqual(self.balance(), Decimal("151000"))
        self.assertEqual(other.post(approve).status_code, 400)  # already applied
        self.assertEqual(AdminWalletAdjustment.objects.get().approved_by, self.admin2)

    def test_reject_pending(self):
        adj_id = self.post({"type": "CREDIT", "amount": "150000", "reason": "xyz"}).json()["id"]
        r = self.c.post(f"/api/users/admin/wallet-adjustments/{adj_id}/reject/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "REJECTED")
        self.assertEqual(self.balance(), Decimal("1000"))

    def test_cashback_source(self):
        r = self.post({"type": "CREDIT", "amount": "25", "reason": "Promo", "source": "CASHBACK"})
        self.assertEqual(r.status_code, 200, r.content)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.cashback_balance, Decimal("75"))
        self.assertEqual(self.wallet.balance, Decimal("1000"))
        self.assertEqual(Ledger.objects.get(reference=r.json()["reference"]).source, "CASHBACK")

    def test_fund_endpoint_always_credits(self):
        r = self.c.post(f"/api/users/admin/users/{self.user.pk}/fund/",
                        {"type": "DEBIT", "amount": "50", "reason": "fund"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["type"], "CREDIT")
        self.assertEqual(self.balance(), Decimal("1050"))

    def test_non_admin_forbidden(self):
        c = APIClient()
        c.force_authenticate(self.user)
        self.assertEqual(self.post({"type": "CREDIT", "amount": "1", "reason": "abc"}, user=self.user, client=c).status_code, 403)

    def test_list_endpoint(self):
        self.post({"type": "CREDIT", "amount": "10", "reason": "listed"})
        r = self.c.get("/api/users/admin/wallet-adjustments/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["results"][0]["admin_username"], "adm")
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["pending_count"], 0)

    def test_list_flags_can_approve_and_pending_count(self):
        self.post({"type": "CREDIT", "amount": "150000", "reason": "Big one"})
        mine = self.c.get("/api/users/admin/wallet-adjustments/?status=PENDING_APPROVAL").json()
        self.assertEqual(mine["pending_count"], 1)
        self.assertFalse(mine["results"][0]["can_approve"])
        other = APIClient()
        other.force_authenticate(self.admin2)
        theirs = other.get("/api/users/admin/wallet-adjustments/?status=PENDING_APPROVAL").json()
        self.assertTrue(theirs["results"][0]["can_approve"])

    def test_decisions_are_written_to_audit_log(self):
        from transactions.models import AdminAuditLog

        self.post({"type": "CREDIT", "amount": "10", "reason": "small"})
        self.assertTrue(AdminAuditLog.objects.filter(action="WALLET_CREDIT", target_user=self.user).exists())
        adj_id = self.post({"type": "CREDIT", "amount": "150000", "reason": "rejectme"}).json()["id"]
        self.c.post(f"/api/users/admin/wallet-adjustments/{adj_id}/reject/")
        self.assertTrue(AdminAuditLog.objects.filter(action="ADJUSTMENT_REJECTED").exists())

