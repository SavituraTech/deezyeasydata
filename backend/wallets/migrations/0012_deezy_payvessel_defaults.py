from django.db import migrations, models


def configure_payvessel(apps, schema_editor):
    WalletConfig = apps.get_model("wallets", "WalletConfig")
    WalletConfig.objects.update(
        paymentpoint_enabled=False,
        payvessel_enabled=True,
        default_payment_provider="payvessel",
    )


class Migration(migrations.Migration):
    dependencies = [("wallets", "0011_admin_wallet_adjustment")]

    operations = [
        migrations.AlterField(
            model_name="virtualaccount",
            name="provider",
            field=models.CharField(default="PAYVESSEL", max_length=50),
        ),
        migrations.AlterField(
            model_name="virtualaccount",
            name="bank_name",
            field=models.CharField(default="Deezy Easy Data Partner Bank", max_length=120),
        ),
        migrations.AlterField(
            model_name="walletconfig",
            name="paymentpoint_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="walletconfig",
            name="default_payment_provider",
            field=models.CharField(
                choices=[("paymentpoint", "PaymentPoint"), ("payvessel", "PayVessel")],
                default="payvessel",
                max_length=20,
            ),
        ),
        migrations.RunPython(configure_payvessel, migrations.RunPython.noop),
    ]
