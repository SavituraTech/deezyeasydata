"""
Provider Router — central registry for mapping product.provider slugs
to the correct VendingStrategy (client + adapter pair) and for building
provider-specific vend payloads.

Usage in any vending view:
    strategy = ProviderRouter.get_strategy(product.provider)
    payload  = ProviderRouter.build_data_payload(product, phone, user_ref)
    txn = strategy.process_vend(...)

Adding a new provider:
  1. Add a client class in providers/client.py
  2. Add an adapter class in providers/adapter.py (if response format differs)
  3. Register it in ProviderRouter.get_strategy() and add a build_*_payload branch
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class ProviderRouter:
    """
    Maps a provider slug to a VendingStrategy and builds vend payloads.
    All vending views should use this instead of instantiating clients directly.
    """

    @staticmethod
    def get_strategy(provider_slug: str):
        """
        Return a fully-configured VendingStrategy for the given provider slug.
        Falls back to Newdatasub for unknown / None slugs.
        """
        from providers.client import NewdatasubClient
        from providers.adapter import ProviderAdapter
        from transactions.strategy import VendingStrategy

        return VendingStrategy(ProviderAdapter(NewdatasubClient()))

    # ------------------------------------------------------------------ payloads

    @staticmethod
    def build_data_payload(product, phone: str, user_reference: str) -> Dict[str, Any]:
        """
        Build a NewDataSub data purchase payload.
        """
        return {
            "action": "vend",
            "product_code": product.provider_product_code,
            "phone_number": phone,
            "user_reference": user_reference,
        }

    @staticmethod
    def build_airtime_payload(
        product, phone: str, amount: float, user_reference: str,
        bypass_network: bool = False,
    ) -> Dict[str, Any]:
        """Build an airtime purchase payload."""
        payload = {
            "action": "vend",
            "product_code": product.provider_product_code,
            "phone_number": phone,
            "amount": amount,
            "user_reference": user_reference,
        }
        if bypass_network:
            payload["bypass_network"] = "yes"
        return payload

    @staticmethod
    def build_electricity_payload(
        product, meter_number: str, meter_type: str, amount: float, user_reference: str
    ) -> Dict[str, Any]:
        return {
            "action": "vend",
            "product_code": product.provider_product_code,
            "meter_number": meter_number,
            "meter_type": meter_type,
            "amount": amount,
            "user_reference": user_reference,
        }

    @staticmethod
    def build_cable_payload(
        product, smartcard_number: str, user_reference: str,
        phone_number: str = "",
    ) -> Dict[str, Any]:
        payload = {
            "action": "vend",
            "product_code": product.provider_product_code,
            "smartcard_number": smartcard_number,
            "user_reference": user_reference,
        }
        if phone_number:
            payload["phone_number"] = phone_number
        return payload

    @staticmethod
    def build_broadband_payload(
        product, account_number: str, user_reference: str,
        phone_number: str = "",
    ) -> Dict[str, Any]:
        payload = {
            "action": "vend",
            "product_code": product.provider_product_code,
            "phone_number": phone_number or account_number,
            "user_reference": user_reference,
        }
        return payload

    @staticmethod
    def build_education_payload(
        product, quantity: int, user_reference: str
    ) -> Dict[str, Any]:
        return {
            "action": "vend",
            "product_code": product.provider_product_code,
            "quantity": quantity,
            "user_reference": user_reference,
        }
