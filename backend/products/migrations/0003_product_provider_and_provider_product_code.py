from django.db import migrations

# No-op: `provider` and `provider_product_code` already exist on `Product` in
# 0001_initial. This migration remains in the chain so 0004 keeps a stable
# dependency; it was previously recreated by hand and duplicated those fields,
# which broke `migrate` on databases that already had 0001 applied.
#
# Trust `makemigrations` for new changes — this file is intentionally not
# auto-generated so we do not reintroduce duplicate AddField operations.


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0002_product_network"),
    ]

    operations = []
