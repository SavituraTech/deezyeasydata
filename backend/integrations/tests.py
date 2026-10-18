import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction as db_transaction
from django.test import TestCase, override_settings

from transactions.models import Transaction, TransactionType, TransactionStatus
from django.utils import timezone

from integrations import payvessel_processing
from integrations.models import WebhookEvent
from integrations.payments import payvessel_va
from integrations.payments.client import PaymentVerificationResult
from wallets.models import VirtualAccount, Wallet, WalletConfig

User = get_user_model()

WEBHOOK_URL = "/api/integrations/payvessel/webhook/"
ACCOUNT_NUMBER = "9876543210"


def _va_payload(amount: float = 1500, reference: str = "REF-1", event: str = "transaction.success") -> dict:
    return {
        "event": event,
        "transaction": {
            "status": "success",
            "accountNumber": ACCOUNT_NUMBER,
            "reference": reference,
        },
        "order": {"amount": amount},
    }


@override_settings(PAYVESSEL_SKIP_WEBHOOK_VERIFY=True, PAYVESSEL_WEBHOOK_ASYNC=False)  # local-testing flag, not DEBUG
class PayVesselVirtualAccountCreditWebhookTests(TestCase):
    """Reserved-account bank-transfer events must credit the VA owner's wallet."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="vaholder", email="va@example.com", password="pass1234"
        )
        cls.va = VirtualAccount.objects.create(
            user=cls.user,
            provider="PAYVESSEL",
            account_number=ACCOUNT_NUMBER,
            account_name="VA HOLDER",
            bank_name="9PSB",
        )

    def _post(self, payload: dict):
        return self.client.post(
            WEBHOOK_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_success_event_credits_wallet_for_receiver_account(self):
        resp = self._post(_va_payload(amount=1500))

        self.assertEqual(resp.status_code, 200, resp.content)

        txn = Transaction.objects.get(type=TransactionType.DEPOSIT)
        self.assertEqual(txn.user_id, self.user.id)
        self.assertEqual(txn.status, TransactionStatus.SUCCESS)
        self.assertEqual(txn.provider_reference, "REF-1")

        wallet = Wallet.objects.get(user=self.user)
        config = WalletConfig.get_solo()
        expected = Decimal("1500") - Decimal(str(config.funding_charge or 0))
        self.assertEqual(wallet.balance, expected)

    def test_redelivery_is_idempotent(self):
        first = self._post(_va_payload(amount=1500))
        second = self._post(_va_payload(amount=1500))

        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(second.status_code, 200, second.content)
        self.assertEqual(second.json()["message"], "Already processed")

        self.assertEqual(
            Transaction.objects.filter(type=TransactionType.DEPOSIT).count(), 1
        )
        wallet = Wallet.objects.get(user=self.user)
        config = WalletConfig.get_solo()
        expected = Decimal("1500") - Decimal(str(config.funding_charge or 0))
        self.assertEqual(wallet.balance, expected)

    def test_unknown_receiver_account_is_acked_without_credit(self):
        payload = _va_payload(amount=1500)
        payload["transaction"]["accountNumber"] = "0000000000"

        resp = self._post(payload)

        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Wallet.objects.filter(user=self.user).exists())

    def test_account_number_from_another_provider_is_not_credited(self):
        VirtualAccount.objects.filter(pk=self.va.pk).update(provider="PAYMENTPOINT")

        resp = self._post(_va_payload(amount=1500))

        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Transaction.objects.filter(type=TransactionType.DEPOSIT).exists())
        self.assertFalse(Wallet.objects.filter(user=self.user).exists())

    def test_second_payment_to_same_account_is_credited(self):
        self._post(_va_payload(amount=1000, reference="REF-A"))
        self._post(_va_payload(amount=2000, reference="REF-B"))

        self.assertEqual(
            Transaction.objects.filter(
                type=TransactionType.DEPOSIT, status=TransactionStatus.SUCCESS
            ).count(),
            2,
        )

    def test_missing_reference_is_rejected(self):
        payload = _va_payload()
        del payload["transaction"]["reference"]

        resp = self._post(payload)

        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Transaction.objects.filter(type=TransactionType.DEPOSIT).exists())

    def test_failed_event_does_not_create_deposit(self):
        payload = _va_payload(event="transaction.failed")
        payload["transaction"]["status"] = "failed"

        resp = self._post(payload)

        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Transaction.objects.filter(type=TransactionType.DEPOSIT).exists())

    def test_non_deposit_event_is_ignored(self):
        resp = self._post(_va_payload(event="transfer.success"))

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["message"], "Event ignored")
        self.assertFalse(Transaction.objects.filter(type=TransactionType.DEPOSIT).exists())

    def test_failed_deposit_processing_returns_503_and_rolls_back(self):
        with patch(
            "transactions.services.TransactionService.complete_deposit_transaction",
            side_effect=RuntimeError("boom"),
        ):
            resp = self._post(_va_payload())

        self.assertEqual(resp.status_code, 503)
        self.assertFalse(Transaction.objects.filter(type=TransactionType.DEPOSIT).exists())

    @override_settings(PAYVESSEL_VERIFY_VA_CREDITS=True)
    def test_pending_verification_asks_for_retry(self):
        pending = PaymentVerificationResult(success=False, status="pending")
        with patch("integrations.payments.client.PayVesselClient.verify_payment", return_value=pending):
            resp = self._post(_va_payload())

        self.assertEqual(resp.status_code, 503)
        self.assertFalse(Transaction.objects.filter(type=TransactionType.DEPOSIT).exists())


@override_settings(
    PAYVESSEL_SKIP_WEBHOOK_VERIFY=True,
    PAYVESSEL_WEBHOOK_ASYNC=False,
    PAYVESSEL_VERIFY_BEFORE_CREDIT=True,
)
class PayVesselCheckoutReconciliationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="checkout", email="checkout@example.com", password="pass1234"
        )
        self.txn = Transaction.objects.create(
            user=self.user,
            amount=Decimal("1500.00"),
            type=TransactionType.DEPOSIT,
            status=TransactionStatus.PENDING,
            target="deposit",
            internal_reference="DEP-CHECKOUT-1",
            provider="PAYVESSEL",
            provider_reference="CHECKOUT-REF-1",
        )

    def _post(self, status_value="success"):
        payload = {
            "event": f"transaction.{status_value}",
            "transaction": {
                "status": status_value,
                "reference": "CHECKOUT-REF-1",
            },
            "order": {"amount": 1500},
        }
        return self.client.post(
            WEBHOOK_URL, data=json.dumps(payload), content_type="application/json"
        )

    def test_verified_success_reconciles_an_earlier_failure(self):
        failed = self._post("failed")
        self.assertEqual(failed.status_code, 200)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, TransactionStatus.FAILED)

        verified = PaymentVerificationResult(
            success=True,
            status="success",
            amount=1500,
            currency="NGN",
            payment_reference="CHECKOUT-REF-1",
        )
        with patch(
            "integrations.payments.client.PayVesselClient.verify_payment",
            return_value=verified,
        ):
            success = self._post("success")

        self.assertEqual(success.status_code, 200, success.content)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, TransactionStatus.SUCCESS)
        self.assertIsNone(self.txn.error_code)
        self.assertTrue(Wallet.objects.filter(user=self.user).exists())

    def test_success_verification_without_amount_fails_closed(self):
        verified = PaymentVerificationResult(
            success=True,
            status="success",
            amount=None,
            currency="NGN",
            payment_reference="CHECKOUT-REF-1",
        )
        with patch(
            "integrations.payments.client.PayVesselClient.verify_payment",
            return_value=verified,
        ):
            resp = self._post("success")

        self.assertEqual(resp.status_code, 503)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, TransactionStatus.PENDING)
        self.assertFalse(Wallet.objects.filter(user=self.user).exists())

    def test_amount_mismatch_is_persisted_for_manual_review(self):
        verified = PaymentVerificationResult(
            success=True,
            status="success",
            amount=1400,
            currency="NGN",
            payment_reference="CHECKOUT-REF-1",
        )
        with patch(
            "integrations.payments.client.PayVesselClient.verify_payment",
            return_value=verified,
        ):
            resp = self._post("success")

        self.assertEqual(resp.status_code, 409)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, TransactionStatus.PENDING)
        self.assertEqual(self.txn.error_code, "PAYMENT_AMOUNT_MISMATCH")
        self.assertTrue(self.txn.provider_response["review_required"])
        self.assertFalse(Wallet.objects.filter(user=self.user).exists())

    def test_duplicate_deposit_reference_is_rejected_by_database(self):
        with self.assertRaises(IntegrityError):
            with db_transaction.atomic():
                Transaction.objects.create(
                    user=self.user,
                    amount=Decimal("1500.00"),
                    type=TransactionType.DEPOSIT,
                    status=TransactionStatus.PENDING,
                    target="deposit",
                    internal_reference="DEP-CHECKOUT-2",
                    provider="PAYVESSEL",
                    provider_reference="CHECKOUT-REF-1",
                )


SECRET = "PVSECRET-test"


@override_settings(
    PAYVESSEL_SKIP_WEBHOOK_VERIFY=False,
    PAYVESSEL_WEBHOOK_ASYNC=False,
    PAYVESSEL_TRUSTED_IPS=["3.255.23.38"],
    PAYVESSEL_ENFORCE_IP_ALLOWLIST=True,
    PAYVESSEL_TRUSTED_PROXY_COUNT=1,
    DEBUG=True,  # must NOT bypass verification
)
class PayVesselWebhookSecurityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user = User.objects.create_user(username="sec", email="s@example.com", password="pass1234")
        VirtualAccount.objects.create(
            user=user, provider="PAYVESSEL", account_number=ACCOUNT_NUMBER,
            account_name="SEC", bank_name="9PSB",
        )

    def setUp(self):
        # The client is a cached singleton that reads its secret at init.
        from integrations.payments.client import get_client

        patcher = patch.object(get_client("payvessel"), "webhook_secret", SECRET)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _post(self, body: bytes, signature=None, ip="3.255.23.38"):
        extra = {"HTTP_X_FORWARDED_FOR": ip}
        if signature is not None:
            extra["HTTP_PAYVESSEL_HTTP_SIGNATURE"] = signature
        return self.client.post(WEBHOOK_URL, data=body, content_type="application/json", **extra)

    @staticmethod
    def _sign(body: bytes) -> str:
        return hmac.new(SECRET.encode(), body, hashlib.sha512).hexdigest()

    def test_valid_signature_and_ip_accepted(self):
        body = json.dumps(_va_payload()).encode()
        resp = self._post(body, self._sign(body))
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertTrue(Transaction.objects.filter(status=TransactionStatus.SUCCESS).exists())

    def test_missing_or_bad_signature_rejected_even_in_debug(self):
        body = json.dumps(_va_payload()).encode()
        self.assertEqual(self._post(body).status_code, 400)
        self.assertEqual(self._post(body, "deadbeef").status_code, 400)
        self.assertFalse(Transaction.objects.exists())

    def test_untrusted_ip_rejected(self):
        body = json.dumps(_va_payload()).encode()
        resp = self._post(body, self._sign(body), ip="6.6.6.6")
        self.assertEqual(resp.status_code, 400)

    def test_spoofed_leftmost_forwarded_ip_rejected(self):
        body = json.dumps(_va_payload()).encode()
        # Attacker prepends a trusted IP; our proxy appended the real peer last.
        resp = self._post(body, self._sign(body), ip="3.255.23.38, 6.6.6.6")
        self.assertEqual(resp.status_code, 400)


@override_settings(PAYVESSEL_SKIP_WEBHOOK_VERIFY=True, PAYVESSEL_WEBHOOK_ASYNC=True)
class PayVesselAsyncWebhookTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="async", email="a@example.com", password="pass1234")
        VirtualAccount.objects.create(
            user=cls.user, provider="PAYVESSEL", account_number=ACCOUNT_NUMBER,
            account_name="ASYNC", bank_name="9PSB",
        )

    def _post(self, payload):
        return self.client.post(WEBHOOK_URL, data=json.dumps(payload), content_type="application/json")

    def test_event_is_stored_and_acked_without_processing(self):
        with patch.object(payvessel_processing, "dispatch") as dispatch:
            resp = self._post(_va_payload())

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["message"], "Accepted")
        dispatch.assert_called_once()
        self.assertEqual(WebhookEvent.objects.get().status, WebhookEvent.Status.RECEIVED)
        self.assertFalse(Transaction.objects.filter(type=TransactionType.DEPOSIT).exists())

    def test_redelivery_stores_only_one_event(self):
        with patch.object(payvessel_processing, "dispatch") as dispatch:
            self._post(_va_payload())
            resp = self._post(_va_payload())

        self.assertEqual(resp.json()["message"], "Already received")
        self.assertEqual(WebhookEvent.objects.count(), 1)
        dispatch.assert_called_once()

    def test_process_event_credits_wallet(self):
        with patch.object(payvessel_processing, "dispatch"):
            self._post(_va_payload(amount=1500))
        event = WebhookEvent.objects.get()

        payvessel_processing.process_event(event.pk)

        event.refresh_from_db()
        self.assertEqual(event.status, WebhookEvent.Status.PROCESSED)
        self.assertEqual(event.attempts, 1)
        self.assertTrue(
            Transaction.objects.filter(status=TransactionStatus.SUCCESS, provider_reference="REF-1").exists()
        )

    @override_settings(PAYVESSEL_VERIFY_VA_CREDITS=True)
    def test_retry_with_backoff_then_success(self):
        with patch.object(payvessel_processing, "dispatch"):
            self._post(_va_payload())
        event = WebhookEvent.objects.get()

        pending = PaymentVerificationResult(success=False, status="pending")
        with patch("integrations.payments.client.PayVesselClient.verify_payment", return_value=pending):
            payvessel_processing.process_event(event.pk)
        event.refresh_from_db()
        self.assertEqual(event.status, WebhookEvent.Status.RECEIVED)
        self.assertEqual(event.attempts, 1)
        self.assertGreater(event.next_attempt_at, timezone.now())
        # Not due yet: the worker leaves it alone.
        self.assertEqual(payvessel_processing.process_due_events(), 0)

        WebhookEvent.objects.filter(pk=event.pk).update(next_attempt_at=timezone.now())
        ok = PaymentVerificationResult(success=True, status="success", amount=1500.0)
        with patch("integrations.payments.client.PayVesselClient.verify_payment", return_value=ok):
            self.assertEqual(payvessel_processing.process_due_events(), 1)
        event.refresh_from_db()
        self.assertEqual(event.status, WebhookEvent.Status.PROCESSED)

    @override_settings(PAYVESSEL_WEBHOOK_MAX_ATTEMPTS=1)
    def test_event_fails_after_max_attempts(self):
        with patch.object(payvessel_processing, "dispatch"):
            self._post(_va_payload())
        event = WebhookEvent.objects.get()

        with patch(
            "transactions.services.TransactionService.complete_deposit_transaction",
            side_effect=RuntimeError("boom"),
        ):
            payvessel_processing.process_event(event.pk)

        event.refresh_from_db()
        self.assertEqual(event.status, WebhookEvent.Status.FAILED)
        self.assertFalse(Transaction.objects.filter(type=TransactionType.DEPOSIT).exists())

    @override_settings(PAYVESSEL_VERIFY_BEFORE_CREDIT=True)
    def test_amount_mismatch_marks_inbox_failed_with_review_details(self):
        Transaction.objects.create(
            user=self.user,
            amount=Decimal("1500.00"),
            type=TransactionType.DEPOSIT,
            status=TransactionStatus.PENDING,
            target="deposit",
            internal_reference="DEP-ASYNC-MISMATCH",
            provider="PAYVESSEL",
            provider_reference="REF-1",
        )
        with patch.object(payvessel_processing, "dispatch"):
            self._post(_va_payload(amount=1400))
        event = WebhookEvent.objects.get()
        verified = PaymentVerificationResult(
            success=True,
            status="success",
            amount=1400,
            currency="NGN",
            payment_reference="REF-1",
        )

        with patch(
            "integrations.payments.client.PayVesselClient.verify_payment",
            return_value=verified,
        ):
            outcome = payvessel_processing.process_event(event.pk)

        self.assertEqual(outcome.status_code, 409)
        event.refresh_from_db()
        self.assertEqual(event.status, WebhookEvent.Status.FAILED)
        self.assertIn("manual review required", event.last_error)
        txn = Transaction.objects.get(provider_reference="REF-1")
        self.assertEqual(txn.error_code, "PAYMENT_AMOUNT_MISMATCH")

    def test_stale_processing_event_is_recovered(self):
        with patch.object(payvessel_processing, "dispatch"):
            self._post(_va_payload())
        event = WebhookEvent.objects.get()
        WebhookEvent.objects.filter(pk=event.pk).update(status=WebhookEvent.Status.PROCESSING)
        WebhookEvent.objects.filter(pk=event.pk).update(updated_at=timezone.now() - timezone.timedelta(hours=1))

        self.assertEqual(payvessel_processing.process_due_events(), 1)
        event.refresh_from_db()
        self.assertEqual(event.status, WebhookEvent.Status.PROCESSED)


@override_settings(PAYVESSEL_SKIP_WEBHOOK_VERIFY=False, PAYVESSEL_WEBHOOK_ASYNC=False, PAYVESSEL_ENFORCE_IP_ALLOWLIST=False,
                   PAYVESSEL_TRUSTED_IPS=["3.255.23.38"])
class PayVesselUnenforcedIpTests(PayVesselWebhookSecurityTests):
    """Explicit compatibility override accepts an unlisted IP, but still requires HMAC."""

    def test_untrusted_ip_rejected(self):
        body = json.dumps(_va_payload()).encode()
        self.assertEqual(self._post(body, self._sign(body), ip="152.233.29.2").status_code, 200)

    def test_spoofed_leftmost_forwarded_ip_rejected(self):
        body = json.dumps(_va_payload()).encode()
        self.assertEqual(self._post(body, "bad", ip="152.233.29.2").status_code, 400)


@override_settings(PAYVESSEL_SKIP_WEBHOOK_VERIFY=True, PAYVESSEL_WEBHOOK_ASYNC=False)
class PayVesselTrackingReferenceTests(TestCase):
    def test_account_found_by_tracking_reference_and_provider_set(self):
        user = User.objects.create_user(username="trk", email="t@example.com", password="pass1234")
        VirtualAccount.objects.create(
            user=user, provider="PAYVESSEL", account_number="1111111111", account_name="T",
            bank_name="9PSB", metadata={"tracking_reference": "TRK-XYZ"},
        )
        payload = {
            "event": "transaction.success",
            "transaction": {"reference": "REF-T1", "status": "success"},
            "order": {"amount": 700},
            "banks": {"trackingReference": "TRK-XYZ"},
        }
        resp = self.client.post(WEBHOOK_URL, data=json.dumps(payload), content_type="application/json")

        self.assertEqual(resp.status_code, 200, resp.content)
        txn = Transaction.objects.get(provider_reference="REF-T1")
        self.assertEqual(txn.user_id, user.id)
        self.assertEqual(txn.status, TransactionStatus.SUCCESS)
        self.assertEqual(txn.provider, "PAYVESSEL")

    def test_approved_status_and_amount_paid_fallbacks(self):
        user = User.objects.create_user(username="fb", email="f@example.com", password="pass1234")
        VirtualAccount.objects.create(
            user=user, provider="PAYVESSEL", account_number="2222222222", account_name="F", bank_name="9PSB",
        )
        payload = {"accountNumber": "2222222222", "transaction_id": "X", "reference": "REF-F1",
                   "notification_status": "approved", "amount_paid": "900"}
        resp = self.client.post(WEBHOOK_URL, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(Transaction.objects.get(provider_reference="REF-F1").status, TransactionStatus.SUCCESS)


class PayVesselGetVirtualAccountTests(TestCase):
    @override_settings(PAYVESSEL_API_KEY="k", PAYVESSEL_SECRET="s", PAYVESSEL_BUSINESS_ID="BIZ1")
    def test_get_virtual_account_parses_and_syncs(self):
        user = User.objects.create_user(username="g", email="g@example.com", password="pass1234")
        va = VirtualAccount.objects.create(
            user=user, provider="PAYVESSEL", account_number="53663632517",
            account_name="OLD", bank_name="OLD",
        )

        class Resp:
            status_code = 200
            text = ""

            def json(self):
                return {
                    "bankCode": "120001", "bankName": "9Payment Service Bank",
                    "accountNumber": "53663632517", "accountName": "ADE OLA",
                    "account_type": "STATIC", "expire_date": None, "trackingReference": "TRK9",
                }

        with patch("integrations.payments.payvessel_va.requests.get", return_value=Resp()) as get:
            from wallets.services import WalletService

            self.assertTrue(WalletService.sync_payvessel_virtual_account(va))

        self.assertIn("/virtual-account/BIZ1/53663632517/", get.call_args.args[0])
        va.refresh_from_db()
        self.assertEqual(va.account_name, "ADE OLA")
        self.assertEqual(va.metadata["tracking_reference"], "TRK9")

    @override_settings(PAYVESSEL_API_KEY="k", PAYVESSEL_SECRET="s", PAYVESSEL_BUSINESS_ID="BIZ1")
    def test_unknown_account_returns_none(self):
        class Resp:
            status_code = 404
            text = "{}"

        with patch("integrations.payments.payvessel_va.requests.get", return_value=Resp()):
            self.assertIsNone(payvessel_va.get_virtual_account("000"))


class PayVesselVerificationAmountTests(TestCase):
    @override_settings(
        PAYVESSEL_API_KEY="PVKEY-test",
        PAYVESSEL_SECRET="PVSECRET-test",
        PAYVESSEL_VERIFY_AMOUNT_IN_KOBO=True,
    )
    def test_documented_smallest_unit_amount_is_converted_to_naira(self):
        from integrations.payments.client import PayVesselClient

        class Resp:
            status_code = 200

            @staticmethod
            def json():
                return {
                    "status": "success",
                    "message": "Transaction verification successful",
                    "data": {
                        "reference": "TXN-1",
                        "amount": 150000,
                        "currency": "NGN",
                        "status": "success",
                    },
                }

        with patch("integrations.payments.client.requests.get", return_value=Resp()):
            result = PayVesselClient().verify_payment("TXN-1")

        self.assertTrue(result.success)
        self.assertEqual(result.amount, 1500.0)
        self.assertEqual(result.payment_reference, "TXN-1")
