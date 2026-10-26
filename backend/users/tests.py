from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from common.exceptions import PaymentGatewayException
from integrations.payments.payvessel_va import PayVesselVAResult, PayVesselVAAccount
from wallets.models import VirtualAccount

User = get_user_model()

CREATE_URL = "/api/users/admin/users/{user_id}/create-account/"
CUSTOMER_CREATE_URL = "/api/wallets/virtual-account/"


def _pv_result(account_number: str = "1234567890") -> PayVesselVAResult:
    return PayVesselVAResult(
        success=True,
        accounts=[
            PayVesselVAAccount(
                bank_code="120001",
                bank_name="9PSB",
                account_number=account_number,
                account_name="JOHN DOE",
                account_type="STATIC",
                tracking_reference="TRK001",
            )
        ],
        business="BV001",
        message="Virtual account(s) created",
        raw={"banks": [{"accountNumber": account_number}]},
    )


class AdminCreateVirtualAccountTests(TestCase):
    """Admin create-account must provision real provider-backed accounts."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(
            username="admintest", email="admin@example.com", password="pass1234"
        )
        cls.customer = User.objects.create_user(
            username="custest", email="cust@example.com", password="pass1234"
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = CREATE_URL.format(user_id=self.customer.id)

    def test_rejects_unknown_provider(self):
        resp = self.client.post(self.url, {"provider": "FLUTTERWAVE"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["error"]["code"], "INVALID_PROVIDER")
        self.assertEqual(VirtualAccount.objects.count(), 0)

    @patch("integrations.payments.payvessel_va.create_virtual_account")
    def test_creates_real_payvessel_account(self, mock_create):
        mock_create.return_value = _pv_result()

        resp = self.client.post(self.url, {"provider": "PAYVESSEL"}, format="json")

        self.assertEqual(resp.status_code, 200, resp.data)
        mock_create.assert_called_once()
        va = VirtualAccount.objects.get(account_number="1234567890")
        self.assertEqual(va.provider, "PAYVESSEL")
        self.assertEqual(va.user_id, self.customer.id)
        self.assertEqual(va.bank_name, "9PSB")
        self.assertEqual(va.metadata.get("tracking_reference"), "TRK001")
        self.assertEqual(resp.data["provider"], "PAYVESSEL")
        self.assertEqual(resp.data["account_number"], "1234567890")

    @patch("integrations.payments.payvessel_va.create_virtual_account")
    def test_normalizes_international_phone_for_payvessel(self, mock_create):
        mock_create.return_value = _pv_result()
        self.customer.phone = "+2348012345678"
        self.customer.save(update_fields=["phone"])

        resp = self.client.post(self.url, {"provider": "PAYVESSEL"}, format="json")

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(mock_create.call_args.kwargs["phone_number"], "08012345678")

    @patch("integrations.payments.payvessel_va.create_virtual_account")
    def test_second_call_reuses_existing_account(self, mock_create):
        mock_create.return_value = _pv_result()

        first = self.client.post(self.url, {"provider": "PAYVESSEL"}, format="json")
        second = self.client.post(self.url, {"provider": "PAYVESSEL"}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["id"], second.data["id"])
        mock_create.assert_called_once()
        self.assertEqual(VirtualAccount.objects.count(), 1)

    @patch(
        "integrations.payments.payvessel_va.create_virtual_account",
        side_effect=PaymentGatewayException("gateway down"),
    )
    def test_gateway_error_returns_502(self, mock_create):
        resp = self.client.post(self.url, {"provider": "PAYVESSEL"}, format="json")

        self.assertEqual(resp.status_code, 502)
        self.assertEqual(resp.data["error"]["code"], "VIRTUAL_ACCOUNT_ERROR")
        self.assertEqual(VirtualAccount.objects.count(), 0)

    def test_paymentpoint_is_rejected_for_payvessel_only_project(self):
        resp = self.client.post(self.url, {"provider": "PAYMENTPOINT"}, format="json")

        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["error"]["code"], "INVALID_PROVIDER")


class CustomerCreateVirtualAccountTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="vacustomer", email="va@example.com", password="pass1234"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.customer)

    @patch("integrations.payments.payvessel_va.create_virtual_account")
    def test_customer_can_force_creation_of_another_account(self, mock_create):
        mock_create.side_effect = [_pv_result("1234567890"), _pv_result("0987654321")]

        first = self.client.post(
            CUSTOMER_CREATE_URL,
            {"provider": "PAYVESSEL", "force_new": True},
            format="json",
        )
        second = self.client.post(
            CUSTOMER_CREATE_URL,
            {"provider": "PAYVESSEL", "force_new": True},
            format="json",
        )
        accounts = self.client.get(f"{CUSTOMER_CREATE_URL}?all=true")

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(mock_create.call_count, 2)
        self.assertEqual(len(accounts.data), 2)
        self.assertEqual(
            set(VirtualAccount.objects.values_list("account_number", flat=True)),
            {"1234567890", "0987654321"},
        )
