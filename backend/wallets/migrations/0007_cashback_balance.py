from decimal import Decimal
from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("wallets", "0006_platformkyc"),
    ]

    operations = [
        migrations.AddField(
            model_name="wallet",
            name="cashback_balance",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                help_text="Accumulated cashback. Spendable on airtime purchases only.",
                max_digits=15,
                validators=[MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.AddField(
            model_name="ledger",
            name="source",
            field=models.CharField(
                choices=[("WALLET", "Wallet"), ("CASHBACK", "Cashback")],
                default="WALLET",
                max_length=10,
            ),
        ),
    ]
