from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("wallets", "0005_walletconfig_cashback_rate_by_category"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlatformKYC",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("id_type", models.CharField(blank=True, help_text="bvn or nin", max_length=3, null=True)),
                ("id_number", models.CharField(blank=True, help_text="11-digit BVN or NIN", max_length=11, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "platform_kyc",
                "verbose_name": "Platform KYC Configuration",
            },
        ),
    ]
