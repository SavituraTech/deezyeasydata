from decimal import Decimal
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("wallets", "0003_walletconfig"),
    ]

    operations = [
        migrations.AddField(
            model_name="walletconfig",
            name="cashback_rate_percent",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                max_digits=5,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
    ]
