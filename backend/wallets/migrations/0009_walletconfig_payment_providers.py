from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("wallets", "0008_platformsettings_alter_virtualaccount_bank_name")]

    operations = [
        migrations.AddField(model_name="walletconfig", name="paymentpoint_enabled", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="walletconfig", name="payvessel_enabled", field=models.BooleanField(default=True)),
        migrations.AddField(
            model_name="walletconfig",
            name="default_payment_provider",
            field=models.CharField(choices=[("paymentpoint", "PaymentPoint"), ("payvessel", "PayVessel")], default="paymentpoint", max_length=20),
        ),
    ]
