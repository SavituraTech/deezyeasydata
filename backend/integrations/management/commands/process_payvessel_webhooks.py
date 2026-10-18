import time

from django.core.management.base import BaseCommand

from integrations.payvessel_processing import process_due_events


class Command(BaseCommand):
    help = (
        "Process stored PayVessel webhook events that are due (retries and events "
        "orphaned by a restart). Run on a schedule, or with --loop as a worker."
    )

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)
        parser.add_argument("--include-failed", action="store_true", help="Re-queue FAILED events too.")
        parser.add_argument("--loop", type=int, default=0, metavar="SECONDS", help="Repeat every N seconds.")

    def handle(self, *args, **opts):
        while True:
            n = process_due_events(limit=opts["limit"], include_failed=opts["include_failed"])
            self.stdout.write(f"Processed {n} PayVessel webhook event(s)")
            opts["include_failed"] = False
            if not opts["loop"]:
                break
            time.sleep(opts["loop"])
