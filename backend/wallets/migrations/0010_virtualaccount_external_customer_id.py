from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("wallets", "0009_walletconfig_payment_providers")]
    operations = [
        migrations.AddField(
            model_name="virtualaccount",
            name="external_customer_id",
            field=models.CharField(blank=True, db_index=True, max_length=100, null=True),
        ),
    ]
