# Generated manually for deposit flow (target can be empty for DEPOSIT type)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("transactions", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="transaction",
            name="target",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Phone, Meter, or Smartcard number",
                max_length=50,
            ),
        ),
    ]
