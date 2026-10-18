from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_user_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="id_type",
            field=models.CharField(
                blank=True,
                choices=[("bvn", "BVN"), ("nin", "NIN")],
                help_text="Identity type used for PalmPay KYC (bvn or nin).",
                max_length=3,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="id_number",
            field=models.CharField(
                blank=True,
                help_text="11-digit BVN or NIN for PalmPay KYC.",
                max_length=11,
                null=True,
            ),
        ),
    ]
