# Generated manually - add network field for airtime/data product resolution

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="network",
            field=models.CharField(
                blank=True,
                choices=[
                    ("MTN", "MTN"),
                    ("GLO", "GLO"),
                    ("AIRTEL", "Airtel"),
                    ("9MOBILE", "9mobile"),
                ],
                db_index=True,
                help_text="Mobile network for airtime/data. Null for other categories.",
                max_length=20,
                null=True,
            ),
        ),
    ]
