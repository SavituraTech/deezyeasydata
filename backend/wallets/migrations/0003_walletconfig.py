from decimal import Decimal
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("wallets", "0002_virtualaccount"),
    ]

    operations = [
        migrations.CreateModel(
            name="WalletConfig",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "funding_charge",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("25.00"),
                        max_digits=10,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "wallet_config",
            },
        ),
        migrations.RunPython(
            lambda apps, schema_editor: apps.get_model("wallets", "WalletConfig").objects.get_or_create(
                pk=1, defaults={"funding_charge": Decimal("25.00")}
            ),
            migrations.RunPython.noop,
        ),
    ]
