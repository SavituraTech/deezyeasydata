from django.db import migrations, models

from . import _cashback_ddl


def _forwards_cashback_ddl(apps, schema_editor):
    _cashback_ddl.ensure_cashback_columns(schema_editor)


def _backwards_cashback_ddl(apps, schema_editor):
    _cashback_ddl.drop_cashback_columns_if_exist(schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0003_product_provider_and_provider_product_code"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="product",
                    name="cashback_enabled",
                    field=models.BooleanField(default=True),
                ),
                migrations.AddField(
                    model_name="product",
                    name="cashback_rate_percent",
                    field=models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        help_text="Optional per-product cashback rate override.",
                        max_digits=5,
                        null=True,
                    ),
                ),
            ],
            database_operations=[
                migrations.RunPython(_forwards_cashback_ddl, _backwards_cashback_ddl),
            ],
        ),
    ]
