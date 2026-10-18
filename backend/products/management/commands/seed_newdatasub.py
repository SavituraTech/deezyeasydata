import json
import logging
import os
import re
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.conf import settings
from products.models import Product, ProductCategory, Network

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Seeds the database with products from newdatasub data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing products before seeding.",
        )

    def handle(self, *args, **kwargs):
        data_file_path = os.path.join(
            settings.BASE_DIR, "data", "newdatasub_services_full.json"
        )

        if not os.path.exists(data_file_path):
            self.stdout.write(
                self.style.ERROR(f"Data file not found at {data_file_path}")
            )
            return

        with open(data_file_path, "r") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                self.stdout.write(self.style.ERROR(f"Error decoding JSON: {e}"))
                return

        if not data.get("status"):
            self.stdout.write(self.style.ERROR("Data file indicates failure status."))
            return

        if kwargs.get("clear"):
            deleted, _ = Product.objects.all().delete()
            self.stdout.write(
                self.style.WARNING(f"Deleted {deleted} existing products.")
            )

        services = data.get("data", {})
        counts = {
            "airtime": self.process_airtime(services.get("airtime_topup", [])),
            "data": self.process_data_bundles(services.get("data_bundle", {})),
            "cable": self.process_cable(services.get("tv", {})),
            "electricity": self.process_electricity(
                services.get("electricity_bill", {})
            ),
            "broadband": self.process_broadband(services.get("broadband_internet", {})),
            "education": self.process_education(services.get("educational_bill", {})),
        }

        self.stdout.write(self.style.SUCCESS("\n--- Seeding Summary ---"))
        total = 0
        for category, count in counts.items():
            total += count
            self.stdout.write(f"  {category.title()}: {count}")
        self.stdout.write(self.style.SUCCESS(f"  Total: {total}"))
        self.stdout.write(
            self.style.SUCCESS(f"  Products in DB: {Product.objects.count()}")
        )

    # ──────────────────────────────────────────────
    # Airtime
    # ──────────────────────────────────────────────
    def process_airtime(self, items):
        self.stdout.write("Processing Airtime...")
        count = 0
        for item in items:
            name = item.get("name", "")
            # Skip placeholder entries that aren't live
            if not name or "NOT Added" in name or "not added" in name.lower():
                continue

            network_name = name.split()[0].upper()
            network = self._map_network(network_name)
            if not network:
                continue

            product_code = item.get("product_code")
            if not product_code:
                continue

            image_url = item.get("logo", "")
            if image_url and not image_url.startswith("http"):
                image_url = None

            Product.objects.update_or_create(
                provider_product_code=product_code,
                defaults={
                    "network": network,
                    "category": ProductCategory.AIRTIME,
                    "provider": "newdatasub",
                    "name": name.strip(),
                    "image_url": image_url or None,
                    "is_active": True,
                    "cost_price": Decimal("0.00"),
                    "selling_price": Decimal("0.00"),
                    "commission": Decimal("0.00"),
                },
            )
            count += 1
        return count

    # ──────────────────────────────────────────────
    # Data bundles
    # ──────────────────────────────────────────────
    def process_data_bundles(self, data_bundles):
        self.stdout.write("Processing Data Bundles...")
        count = 0

        network_logos = {}
        for op in data_bundles.get("network_operators", []):
            name = op.get("name", "").upper()
            logo = op.get("logo", "")
            if logo and logo.startswith("http"):
                mapped = self._map_network(name)
                if mapped:
                    network_logos[mapped] = logo

        for network_key, groups in data_bundles.items():
            if network_key == "network_operators":
                continue
            network = self._map_network(network_key.upper())
            if not network:
                continue

            logo = network_logos.get(network)
            for group in groups:
                group_name = group.get("sub_service_group_name", "")
                services = group.get("available_services", [])
                for service in services:
                    if self._create_product(
                        service,
                        category=ProductCategory.DATA,
                        network=network,
                        image_url=logo,
                        group_name=group_name,
                    ):
                        count += 1
        return count

    # ──────────────────────────────────────────────
    # Cable TV
    # ──────────────────────────────────────────────
    def process_cable(self, tv_data):
        self.stdout.write("Processing Cable TV...")
        count = 0
        provider_keys = {"gotv": "GOTV", "dstv": "DSTV", "startimes": "STARTIMES"}

        for key, provider_name in provider_keys.items():
            plans = tv_data.get(key, [])
            for plan in plans:
                if self._create_product(
                    plan,
                    category=ProductCategory.CABLE,
                    provider=provider_name,
                ):
                    count += 1
        return count

    # ──────────────────────────────────────────────
    # Electricity
    # ──────────────────────────────────────────────
    def process_electricity(self, elec_data):
        self.stdout.write("Processing Electricity...")
        count = 0
        skip_keys = {"provider"}
        # JSON keys that differ from the UI keys expected by matchesProviderProductCode
        key_map = {
            "KEDC": "KEDCO",
            "PHED": "PHEDC",
            "KNEDC": "KAEDCO",
        }

        for provider_key, plans in elec_data.items():
            if provider_key in skip_keys:
                continue
            if not isinstance(plans, list):
                continue
            ui_key = key_map.get(provider_key, provider_key)
            for plan in plans:
                if self._create_product(
                    plan,
                    category=ProductCategory.ELECTRICITY,
                    provider=ui_key,
                    code_prefix=ui_key.lower(),
                ):
                    count += 1
        return count

    # ──────────────────────────────────────────────
    # Broadband
    # ──────────────────────────────────────────────
    def process_broadband(self, broadband_data):
        self.stdout.write("Processing Broadband...")
        count = 0
        provider_map = {
            "smile_data": "SMILE",
            "smile_recharge": "SMILE",
            "spectranet": "SPECTRANET",
        }
        skip_keys = {"provider"}

        for key, plans in broadband_data.items():
            if key in skip_keys:
                continue
            if not isinstance(plans, list):
                continue
            provider_name = provider_map.get(key, key.upper())
            for plan in plans:
                if self._create_product(
                    plan,
                    category=ProductCategory.BROADBAND,
                    provider=provider_name,
                ):
                    count += 1
        return count

    # ──────────────────────────────────────────────
    # Education
    # ──────────────────────────────────────────────
    def process_education(self, edu_data):
        self.stdout.write("Processing Education...")
        count = 0
        pin_keys = {"jamb_pin": "JAMB", "waec_pin": "WAEC", "neco_pin": "NECO", "nabteb_pin": "NABTEB"}
        # JAMB's section key is jamb_pin but product codes inside are utme_pin / direct_entry_de
        # Prefix them with "jamb" so the frontend matchesProviderProductCode("jamb") works
        code_prefix_map = {"jamb_pin": "jamb"}
        skip_keys = {"types"}

        for key, plans in edu_data.items():
            if key in skip_keys or key not in pin_keys:
                continue
            if not isinstance(plans, list):
                continue
            provider_name = pin_keys[key]
            code_prefix = code_prefix_map.get(key)
            for plan in plans:
                if self._create_product(
                    plan,
                    category=ProductCategory.EDUCATION,
                    provider=provider_name,
                    code_prefix=code_prefix,
                ):
                    count += 1
        return count

    # ──────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────
    def _create_product(
        self, service_data, category, network=None, provider="newdatasub",
        image_url=None, code_prefix=None, group_name=None
    ):
        product_code = service_data.get("product_code") or service_data.get(
            "available_service_system_name"
        )
        if not product_code:
            return False

        if code_prefix:
            original_prefix = product_code.split("_")[0]
            product_code = code_prefix + product_code[len(original_prefix):]

        raw_price = service_data.get(
            "available_service_default_price",
            service_data.get("default_price", "0.00"),
        )
        selling_price = Decimal(str(raw_price))

        raw_cost = service_data.get(
            "available_service_actual_price",
            service_data.get("discounted_price", raw_price),
        )
        cost_price = Decimal(str(raw_cost))

        # For DATA, skip products with zero selling price (discontinued/unavailable plans).
        # Electricity products legitimately have price=0 (custom amount entered at checkout).
        if category == ProductCategory.DATA and selling_price == Decimal("0.00"):
            return False

        name = (
            service_data.get("available_service_name")
            or service_data.get("name")
            or product_code
        )
        name = name.strip()

        # Build description: use API description, fall back to group name
        api_desc = (service_data.get("available_service_description") or "").strip()
        if api_desc and api_desc != name:
            description = api_desc
        elif group_name:
            description = group_name
        else:
            description = ""

        if not image_url:
            image_url = service_data.get("available_service_logo") or service_data.get(
                "logo", ""
            )

        if image_url and not image_url.startswith("http"):
            image_url = ""

        # Extract data_size and data_validity from product name for DATA products
        data_size = None
        data_validity = None
        if category == ProductCategory.DATA:
            size_match = re.search(r"(\d+(?:\.\d+)?)\s*(GB|MB|TB)", name, re.IGNORECASE)
            if size_match:
                data_size = f"{size_match.group(1)}{size_match.group(2).upper()}"
            validity_match = re.search(
                r"(\d+)\s*[-/]?\s*(day|days|month|months|week|weeks|year|years)",
                name, re.IGNORECASE
            )
            if validity_match:
                num = validity_match.group(1)
                unit = validity_match.group(2).capitalize()
                if not unit.endswith("s"):
                    unit += "s"
                data_validity = f"{num} {unit}"

        Product.objects.update_or_create(
            provider_product_code=product_code,
            defaults={
                "network": network,
                "category": category,
                "provider": provider,
                "name": name,
                "description": description,
                "cost_price": cost_price,
                "selling_price": selling_price,
                "commission": Decimal("0.00"),
                "image_url": image_url or None,
                "is_active": True,
                **({"data_size": data_size, "data_validity": data_validity}
                   if category == ProductCategory.DATA else {}),
            },
        )
        return True

    def _map_network(self, name):
        name = name.upper()
        if "MTN" in name:
            return Network.MTN
        elif "GLO" in name:
            return Network.GLO
        elif "AIRTEL" in name:
            return Network.AIRTEL
        elif "9MOBILE" in name or "ETISALAT" in name:
            return Network.N9MOBILE
        return None
