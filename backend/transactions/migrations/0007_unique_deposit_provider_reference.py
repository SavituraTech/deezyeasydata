from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [("transactions", "0006_transaction_cashback_amount_and_more")]

    operations = [
        migrations.AddConstraint(
            model_name="transaction",
            constraint=models.UniqueConstraint(
                fields=("provider_reference",),
                condition=(
                    Q(type="DEPOSIT")
                    & Q(provider_reference__isnull=False)
                    & ~Q(provider_reference="")
                ),
                name="uniq_deposit_provider_reference",
            ),
        ),
    ]
