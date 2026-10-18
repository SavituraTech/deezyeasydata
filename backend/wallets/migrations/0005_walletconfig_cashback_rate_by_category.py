from django.db import migrations, models


DEFAULT_RATES = {
    "AIRTIME": "0.00",
    "DATA": "0.00",
    "ELECTRICITY": "0.00",
    "CABLE": "0.00",
    "BROADBAND": "0.00",
    "EDUCATION": "0.00",
}


def seed_rates(apps, schema_editor):
    WalletConfig = apps.get_model("wallets", "WalletConfig")
    obj, _ = WalletConfig.objects.get_or_create(pk=1)
    if not obj.cashback_rate_by_category:
        obj.cashback_rate_by_category = DEFAULT_RATES
        obj.save(update_fields=["cashback_rate_by_category", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("wallets", "0004_walletconfig_cashback_rate_percent"),
    ]

    operations = [
        migrations.AddField(
            model_name="walletconfig",
            name="cashback_rate_by_category",
            field=models.JSONField(blank=True, default=dict, help_text="Map of product category to cashback rate percent."),
        ),
        migrations.RunPython(seed_rates, migrations.RunPython.noop),
    ]
