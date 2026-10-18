from django.db import migrations

from . import _cashback_ddl


def _ensure_only(apps, schema_editor):
    _cashback_ddl.ensure_cashback_columns(schema_editor)


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0004_product_cashback_fields"),
    ]

    operations = [
        migrations.RunPython(_ensure_only, migrations.RunPython.noop),
    ]
