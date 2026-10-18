"""
Sync Product catalog from Newdatasub ``get_available_services`` (and fallbacks).

Requires ``NEWDATASUB_API_KEY`` and working ``NEWDATASUB_BASE_URL``.

If every action returns "Invalid Request", confirm the key is set in the same environment as
this command (e.g. Docker secrets), try ``NEWDATASUB_INCLUDE_API_KEY_IN_JSON=true``, and set
``NEWDATASUB_SYNC_ACTIONS`` to the catalog action name from your Newdatasub/reseller API doc.

Usage::

    python manage.py sync_newdatasub_products
    python manage.py sync_newdatasub_products --dry-run
    python manage.py sync_newdatasub_products --no-images
    python manage.py sync_newdatasub_products --deactivate-missing
"""

from django.core.management.base import BaseCommand, CommandError

from products.newdatasub_sync import run_sync


class Command(BaseCommand):
    help = (
        "Fetch Newdatasub available services and upsert Product rows "
        "(provider=newdatasub, key=provider_product_code)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Do not write to the database; still calls the API.",
        )
        parser.add_argument(
            "--no-images",
            action="store_true",
            help="Do not set image_url from built-in logo maps.",
        )
        parser.add_argument(
            "--deactivate-missing",
            action="store_true",
            help=(
                "Set is_active=False for newdatasub products whose "
                "provider_product_code was not in the last API response."
            ),
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        apply_images = not options["no_images"]
        deactivate_missing = options["deactivate_missing"]

        try:
            stats = run_sync(
                dry_run=dry_run,
                apply_images=apply_images,
                deactivate_missing=deactivate_missing,
            )
        except RuntimeError as exc:
            raise CommandError(f"Failed to sync Newdatasub catalog: {exc}") from exc

        verbosity = int(options.get("verbosity", 1))
        if verbosity >= 2:
            self.stdout.write(f"API action that succeeded: {stats.get('action')}")

        self.stdout.write(
            self.style.SUCCESS(
                f"action={stats['action']} rows={stats['row_count']} "
                f"parsed_codes={stats['parsed_codes']} "
                f"created={stats['created']} updated={stats['updated']} "
                f"skipped={stats['skipped']} deactivated={stats['deactivated']}"
                + (" (dry-run)" if dry_run else "")
            )
        )
        if stats["row_count"] == 0:
            self.stdout.write(
                self.style.WARNING(
                    "No rows extracted from the API response. "
                    "If the catalog exists, set NEWDATASUB_SYNC_ACTIONS or inspect the raw JSON."
                )
            )
