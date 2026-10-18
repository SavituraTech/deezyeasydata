from django.core.management.base import BaseCommand
from products.models import Product, ProductCategory, Network


SEED_DATA = [
    # AIRTIME
    {"name": "MTN VTU Airtime", "category": "AIRTIME", "network": "MTN", "provider": "newdatasub", "provider_product_code": "mtn_airtime", "cost_price": 97, "selling_price": 100, "commission": 0},
    {"name": "Glo VTU Airtime", "category": "AIRTIME", "network": "GLO", "provider": "newdatasub", "provider_product_code": "glo_airtime", "cost_price": 97, "selling_price": 100, "commission": 0},
    {"name": "Airtel VTU Airtime", "category": "AIRTIME", "network": "AIRTEL", "provider": "newdatasub", "provider_product_code": "airtel_airtime", "cost_price": 97, "selling_price": 100, "commission": 0},
    {"name": "9Mobile VTU Airtime", "category": "AIRTIME", "network": "9MOBILE", "provider": "newdatasub", "provider_product_code": "9mobile_airtime", "cost_price": 97, "selling_price": 100, "commission": 0},
    # DATA - MTN
    {"name": "MTN 500MB - 30 Days", "category": "DATA", "network": "MTN", "provider": "newdatasub", "provider_product_code": "mtn_500mb", "cost_price": 130, "selling_price": 150, "commission": 0, "data_size": "500MB", "data_validity": "30 Days"},
    {"name": "MTN 1GB - 30 Days", "category": "DATA", "network": "MTN", "provider": "newdatasub", "provider_product_code": "mtn_1gb", "cost_price": 250, "selling_price": 300, "commission": 0, "data_size": "1GB", "data_validity": "30 Days"},
    {"name": "MTN 2GB - 30 Days", "category": "DATA", "network": "MTN", "provider": "newdatasub", "provider_product_code": "mtn_2gb", "cost_price": 490, "selling_price": 550, "commission": 0, "data_size": "2GB", "data_validity": "30 Days"},
    {"name": "MTN 5GB - 30 Days", "category": "DATA", "network": "MTN", "provider": "newdatasub", "provider_product_code": "mtn_5gb", "cost_price": 1400, "selling_price": 1500, "commission": 0, "data_size": "5GB", "data_validity": "30 Days"},
    {"name": "MTN 10GB - 30 Days", "category": "DATA", "network": "MTN", "provider": "newdatasub", "provider_product_code": "mtn_10gb", "cost_price": 2800, "selling_price": 3000, "commission": 0, "data_size": "10GB", "data_validity": "30 Days"},
    # DATA - GLO
    {"name": "Glo 1GB - 30 Days", "category": "DATA", "network": "GLO", "provider": "newdatasub", "provider_product_code": "glo_1gb", "cost_price": 230, "selling_price": 300, "commission": 0, "data_size": "1GB", "data_validity": "30 Days"},
    {"name": "Glo 2GB - 30 Days", "category": "DATA", "network": "GLO", "provider": "newdatasub", "provider_product_code": "glo_2gb", "cost_price": 460, "selling_price": 550, "commission": 0, "data_size": "2GB", "data_validity": "30 Days"},
    {"name": "Glo 5GB - 30 Days", "category": "DATA", "network": "GLO", "provider": "newdatasub", "provider_product_code": "glo_5gb", "cost_price": 1350, "selling_price": 1500, "commission": 0, "data_size": "5GB", "data_validity": "30 Days"},
    # DATA - AIRTEL
    {"name": "Airtel 1GB - 30 Days", "category": "DATA", "network": "AIRTEL", "provider": "newdatasub", "provider_product_code": "airtel_1gb", "cost_price": 240, "selling_price": 300, "commission": 0, "data_size": "1GB", "data_validity": "30 Days"},
    {"name": "Airtel 2GB - 30 Days", "category": "DATA", "network": "AIRTEL", "provider": "newdatasub", "provider_product_code": "airtel_2gb", "cost_price": 470, "selling_price": 550, "commission": 0, "data_size": "2GB", "data_validity": "30 Days"},
    {"name": "Airtel 5GB - 30 Days", "category": "DATA", "network": "AIRTEL", "provider": "newdatasub", "provider_product_code": "airtel_5gb", "cost_price": 1380, "selling_price": 1500, "commission": 0, "data_size": "5GB", "data_validity": "30 Days"},
    # DATA - 9MOBILE
    {"name": "9Mobile 1GB - 30 Days", "category": "DATA", "network": "9MOBILE", "provider": "newdatasub", "provider_product_code": "9mobile_1gb", "cost_price": 220, "selling_price": 300, "commission": 0, "data_size": "1GB", "data_validity": "30 Days"},
    {"name": "9Mobile 2GB - 30 Days", "category": "DATA", "network": "9MOBILE", "provider": "newdatasub", "provider_product_code": "9mobile_2gb", "cost_price": 440, "selling_price": 550, "commission": 0, "data_size": "2GB", "data_validity": "30 Days"},
    # ELECTRICITY
    {"name": "EKEDC Prepaid", "category": "ELECTRICITY", "network": None, "provider": "newdatasub", "provider_product_code": "ekedc_prepaid", "cost_price": 0, "selling_price": 0, "commission": 0},
    {"name": "IKEDC Prepaid", "category": "ELECTRICITY", "network": None, "provider": "newdatasub", "provider_product_code": "ikedc_prepaid", "cost_price": 0, "selling_price": 0, "commission": 0},
    {"name": "AEDC Prepaid", "category": "ELECTRICITY", "network": None, "provider": "newdatasub", "provider_product_code": "aedc_prepaid", "cost_price": 0, "selling_price": 0, "commission": 0},
    {"name": "KEDCO Prepaid", "category": "ELECTRICITY", "network": None, "provider": "newdatasub", "provider_product_code": "kedco_prepaid", "cost_price": 0, "selling_price": 0, "commission": 0},
    {"name": "PHEDC Prepaid", "category": "ELECTRICITY", "network": None, "provider": "newdatasub", "provider_product_code": "phedc_prepaid", "cost_price": 0, "selling_price": 0, "commission": 0},
    {"name": "EEDC Prepaid", "category": "ELECTRICITY", "network": None, "provider": "newdatasub", "provider_product_code": "eedc_prepaid", "cost_price": 0, "selling_price": 0, "commission": 0},
    {"name": "BEDC Prepaid", "category": "ELECTRICITY", "network": None, "provider": "newdatasub", "provider_product_code": "bedc_prepaid", "cost_price": 0, "selling_price": 0, "commission": 0},
    {"name": "JEDC Prepaid", "category": "ELECTRICITY", "network": None, "provider": "newdatasub", "provider_product_code": "jedc_prepaid", "cost_price": 0, "selling_price": 0, "commission": 0},
    {"name": "KAEDCO Prepaid", "category": "ELECTRICITY", "network": None, "provider": "newdatasub", "provider_product_code": "kaedco_prepaid", "cost_price": 0, "selling_price": 0, "commission": 0},
    # CABLE
    {"name": "DSTV Compact", "category": "CABLE", "network": None, "provider": "newdatasub", "provider_product_code": "dstv_compact", "cost_price": 9000, "selling_price": 9500, "commission": 0},
    {"name": "DSTV Premium", "category": "CABLE", "network": None, "provider": "newdatasub", "provider_product_code": "dstv_premium", "cost_price": 21000, "selling_price": 22000, "commission": 0},
    {"name": "GOTV Max", "category": "CABLE", "network": None, "provider": "newdatasub", "provider_product_code": "gotv_max", "cost_price": 4600, "selling_price": 4850, "commission": 0},
    {"name": "GOTV Jolli", "category": "CABLE", "network": None, "provider": "newdatasub", "provider_product_code": "gotv_jolli", "cost_price": 2800, "selling_price": 3000, "commission": 0},
    {"name": "Startimes Nova", "category": "CABLE", "network": None, "provider": "newdatasub", "provider_product_code": "startimes_nova", "cost_price": 900, "selling_price": 1000, "commission": 0},
    {"name": "Startimes Basic", "category": "CABLE", "network": None, "provider": "newdatasub", "provider_product_code": "startimes_basic", "cost_price": 1700, "selling_price": 1850, "commission": 0},
    # BROADBAND
    {"name": "Smile 1GB", "category": "BROADBAND", "network": None, "provider": "newdatasub", "provider_product_code": "smile_1gb", "cost_price": 1000, "selling_price": 1100, "commission": 0, "data_size": "1GB", "data_validity": "30 Days"},
    {"name": "Smile 2GB", "category": "BROADBAND", "network": None, "provider": "newdatasub", "provider_product_code": "smile_2gb", "cost_price": 1900, "selling_price": 2100, "commission": 0, "data_size": "2GB", "data_validity": "30 Days"},
    {"name": "Spectranet 3GB", "category": "BROADBAND", "network": None, "provider": "newdatasub", "provider_product_code": "spectranet_3gb", "cost_price": 2800, "selling_price": 3000, "commission": 0, "data_size": "3GB", "data_validity": "30 Days"},
    # EDUCATION
    {"name": "WAEC Result Checker", "category": "EDUCATION", "network": None, "provider": "newdatasub", "provider_product_code": "waec_result", "cost_price": 3400, "selling_price": 3600, "commission": 0},
    {"name": "NECO Result Checker", "category": "EDUCATION", "network": None, "provider": "newdatasub", "provider_product_code": "neco_result", "cost_price": 800, "selling_price": 1000, "commission": 0},
    {"name": "NABTEB Result Checker", "category": "EDUCATION", "network": None, "provider": "newdatasub", "provider_product_code": "nabteb_result", "cost_price": 800, "selling_price": 1000, "commission": 0},
    {"name": "JAMB UTME PIN", "category": "EDUCATION", "network": None, "provider": "newdatasub", "provider_product_code": "jamb_utme", "cost_price": 4700, "selling_price": 5000, "commission": 0},
]


class Command(BaseCommand):
    help = "Seed the database with initial products for all categories."

    def add_arguments(self, parser):
        parser.add_argument(
            "--category",
            type=str,
            default=None,
            help="Only seed products for a specific category (AIRTIME, DATA, ELECTRICITY, CABLE, BROADBAND, EDUCATION)",
        )

    def handle(self, *args, **options):
        category_filter = options.get("category")
        created_count = 0
        updated_count = 0

        for item in SEED_DATA:
            if category_filter and item["category"] != category_filter.upper():
                continue

            defaults = {
                "name": item["name"],
                "category": item["category"],
                "network": item.get("network"),
                "provider": item["provider"],
                "cost_price": item["cost_price"],
                "selling_price": item["selling_price"],
                "commission": item["commission"],
                "is_active": True,
            }
            if item.get("data_size"):
                defaults["data_size"] = item["data_size"]
            if item.get("data_validity"):
                defaults["data_validity"] = item["data_validity"]

            _, created = Product.objects.update_or_create(
                provider=item["provider"],
                provider_product_code=item["provider_product_code"],
                defaults=defaults,
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding complete: {created_count} created, {updated_count} updated."
            )
        )
