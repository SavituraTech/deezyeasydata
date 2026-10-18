from decimal import Decimal
import random
from datetime import timedelta
import csv
import io

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum, Q, Avg, F, ExpressionWrapper, DecimalField
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdminUser

from products.models import Product
from transactions.models import Transaction, TransactionStatus, TransactionType
from users.serializers import UserSerializer
from wallets.models import Ledger

User = get_user_model()


class UserListView(APIView):
    """
    Admin-only list of users with search, filtering and pagination.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="search", type=str, description="Search by username, email or phone"),
            OpenApiParameter(name="role", type=str, description="Filter by role (ADMIN, AGENT, CUSTOMER)"),
            OpenApiParameter(name="is_active", type=OpenApiTypes.BOOL, description="Filter by active status"),
            OpenApiParameter(name="page", type=int, description="Page number"),
            OpenApiParameter(name="page_size", type=int, description="Results per page"),
        ],
        responses={200: UserSerializer(many=True)},
    )
    def get(self, request):
        users = User.objects.all().order_by("-date_joined")

        search = request.query_params.get("search")
        if search:
            users = users.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search)
            )

        role = request.query_params.get("role")
        if role:
            users = users.filter(role=role)

        is_active = request.query_params.get("is_active")
        if is_active is not None:
            users = users.filter(is_active=is_active.lower() == "true")

        total = users.count()

        page = request.query_params.get("page", 1)
        page_size = request.query_params.get("page_size", 20)
        try:
            page = int(page)
            page_size = int(page_size)
        except (ValueError, TypeError):
            page = 1
            page_size = 20

        start = (page - 1) * page_size
        end = start + page_size
        users = users[start:end]

        return Response({
            "results": UserSerializer(users, many=True).data,
            "count": total,
        })


class UserDetailView(APIView):
    """
    Retrieve, update or soft-delete a user (admin only).
    """

    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = UserSerializer

    @extend_schema(responses=UserSerializer)
    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(UserSerializer(user).data)

    @extend_schema(request=UserSerializer, responses=UserSerializer)
    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = UserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        user.is_active = False
        user.save()
        return Response({"message": "User deactivated"}, status=status.HTTP_200_OK)


class AdminCreateUserView(generics.CreateAPIView):
    """
    Create a new user (admin only).
    """

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def create(self, request, *args, **kwargs):
        from users.serializers import UserCreateSerializer

        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserSuspendView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = UserSerializer

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"success": True, "message": "User suspended."})


class UserUnsuspendView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = UserSerializer

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response({"success": True, "message": "User unsuspended."})


class UserLimitsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = UserSerializer

    @extend_schema(request=UserSerializer, responses=UserSerializer)
    def patch(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if "airtime_limit" in request.data:
            user.airtime_limit = Decimal(str(request.data.get("airtime_limit")))
        if "payment_gateway_limit" in request.data:
            user.payment_gateway_limit = Decimal(
                str(request.data.get("payment_gateway_limit"))
            )

        user.save(update_fields=["airtime_limit", "payment_gateway_limit"])
        return Response(UserSerializer(user).data)


class ResetUserPasswordView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = UserSerializer

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        new_password = request.data.get("new_password") or get_random_string(10)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response(
            {
                "success": True,
                "message": "Password reset successful.",
                "new_password": new_password,
            }
        )


class ResetUserPinView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = UserSerializer

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        new_pin = request.data.get("new_pin") or f"{random.randint(1000, 9999)}"
        user.transaction_pin = str(new_pin)
        user.save(update_fields=["transaction_pin"])
        return Response({"success": True, "new_pin": str(new_pin)})


class ClearFailedLoginsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = UserSerializer

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        user.failed_login_attempts = 0
        user.save(update_fields=["failed_login_attempts"])
        return Response({"success": True})


class AdminStatsView(APIView):
    """Basic admin KPI stats."""

    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = UserSerializer

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        total_transactions = Transaction.objects.count()
        success_transactions = Transaction.objects.filter(status="SUCCESS").count()
        total_volume = (
            Transaction.objects.filter(status="SUCCESS").aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )
        total_products = Product.objects.count()
        return Response(
            {
                "total_users": total_users,
                "active_users": active_users,
                "total_transactions": total_transactions,
                "success_transactions": success_transactions,
                "total_volume": total_volume,
                "total_products": total_products,
            }
        )


class AdminAnalyticsView(APIView):
    """
    Rich analytics data for the admin dashboard.

    Query parameters
    ----------------
    period : int  (default 30)
        Number of days to include in time-series data.
        Accepted values: 7, 30, 90.  Any other value is clamped to 30.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    _VALID_PERIODS = {7, 30, 90}
    _DEFAULT_PERIOD = 30

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="period",
                type=int,
                description="Time window in days for trend data (7, 30 or 90). Defaults to 30.",
            )
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        # ── period ─────────────────────────────────────────────────────────
        try:
            period = int(request.query_params.get("period", self._DEFAULT_PERIOD))
        except (TypeError, ValueError):
            period = self._DEFAULT_PERIOD
        if period not in self._VALID_PERIODS:
            period = self._DEFAULT_PERIOD

        now = timezone.now()
        period_start = now - timedelta(days=period)
        prev_period_start = period_start - timedelta(days=period)

        # ── 1. Transactions by status (all-time) ───────────────────────────
        tx_by_status = list(
            Transaction.objects.values("status")
            .annotate(count=Count("id"))
            .order_by()
        )

        # ── 2. Transactions by service type (all-time) ─────────────────────
        tx_by_type = list(
            Transaction.objects.values("type")
            .annotate(count=Count("id"), revenue=Sum("amount"))
            .order_by()
        )

        # ── 3. Daily transaction volume + revenue (current period) ─────────
        daily_series = list(
            Transaction.objects.filter(
                created_at__gte=period_start,
                status=TransactionStatus.SUCCESS,
            )
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"), revenue=Sum("amount"))
            .order_by("day")
        )
        # Stringify dates so JSON serialisation is clean
        for row in daily_series:
            if row["day"]:
                row["day"] = row["day"].isoformat()

        # ── 4. Daily new user registrations (current period) ───────────────
        User = get_user_model()
        daily_signups = list(
            User.objects.filter(date_joined__gte=period_start)
            .annotate(day=TruncDate("date_joined"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        for row in daily_signups:
            if row["day"]:
                row["day"] = row["day"].isoformat()

        # ── 5. Success rate (current period) ───────────────────────────────
        period_qs = Transaction.objects.filter(created_at__gte=period_start)
        period_total = period_qs.count()
        period_success = period_qs.filter(status=TransactionStatus.SUCCESS).count()
        period_failed = period_qs.filter(status=TransactionStatus.FAILED).count()
        period_pending = period_qs.filter(status=TransactionStatus.PENDING).count()
        success_rate = (
            round(period_success / period_total * 100, 2) if period_total else 0.0
        )

        # ── 6. Period-over-period revenue comparison ────────────────────────
        current_revenue = (
            Transaction.objects.filter(
                created_at__gte=period_start, status=TransactionStatus.SUCCESS
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        prev_revenue = (
            Transaction.objects.filter(
                created_at__gte=prev_period_start,
                created_at__lt=period_start,
                status=TransactionStatus.SUCCESS,
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        revenue_change_pct = (
            round((float(current_revenue) - float(prev_revenue)) / float(prev_revenue) * 100, 2)
            if prev_revenue
            else None
        )

        # ── 7. Top 10 users by revenue (current period) ────────────────────
        top_users = list(
            Transaction.objects.filter(
                created_at__gte=period_start, status=TransactionStatus.SUCCESS
            )
            .values("user__username", "user__email")
            .annotate(transactions=Count("id"), volume=Sum("amount"))
            .order_by("-volume")[:10]
        )

        # ── 8. Refund stats (current period) ───────────────────────────────
        refund_count = period_qs.filter(is_refunded=True).count()
        refund_volume = (
            period_qs.filter(is_refunded=True).aggregate(total=Sum("amount"))["total"] or 0
        )

        # ── 9. Top users by transfer-in (deposits) and transfer-out (spend) ─
        top_transfer_in_users = list(
            period_qs.filter(
                status=TransactionStatus.SUCCESS,
                type=TransactionType.DEPOSIT,
            )
            .values("user__username", "user__email")
            .annotate(transfers=Count("id"), volume=Sum("amount"))
            .order_by("-volume")[:10]
        )
        top_spend_users = list(
            period_qs.filter(status=TransactionStatus.SUCCESS)
            .exclude(type=TransactionType.DEPOSIT)
            .values("user__username", "user__email")
            .annotate(transactions=Count("id"), volume=Sum("amount"))
            .order_by("-volume")[:10]
        )

        margin_expr = ExpressionWrapper(
            F("selling_price") - F("cost_price") - F("commission"),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )
        margin_by_provider = list(
            Product.objects.values("provider")
            .annotate(
                products=Count("id"),
                avg_margin=Avg(margin_expr),
            )
            .order_by("-avg_margin")
        )
        margin_by_category = list(
            Product.objects.values("category")
            .annotate(
                products=Count("id"),
                avg_margin=Avg(margin_expr),
            )
            .order_by("-avg_margin")
        )

        return Response(
            {
                "period_days": period,
                # Breakdown charts (all-time)
                "transactions_by_status": tx_by_status,
                "transactions_by_type": tx_by_type,
                # Time-series (current period)
                "daily_revenue_series": daily_series,
                "daily_signups_series": daily_signups,
                # KPIs (current period)
                "period_kpis": {
                    "total_transactions": period_total,
                    "successful_transactions": period_success,
                    "failed_transactions": period_failed,
                    "pending_transactions": period_pending,
                    "success_rate_pct": success_rate,
                    "total_revenue": current_revenue,
                    "prev_period_revenue": prev_revenue,
                    "revenue_change_pct": revenue_change_pct,
                    "refund_count": refund_count,
                    "refund_volume": refund_volume,
                },
                # Leaderboard
                "top_users": top_users,
                "top_transfer_in_users": top_transfer_in_users,
                "top_spend_users": top_spend_users,
                "margin_by_provider": margin_by_provider,
                "margin_by_category": margin_by_category,
            }
        )


class AdminExportView(APIView):
    """Admin CSV/XLSX exports for core operational datasets."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(responses={200: OpenApiTypes.BINARY})
    def get(self, request, dataset: str):
        dataset = dataset.lower()
        file_format = request.query_params.get("format", "csv").lower()
        start_raw = request.query_params.get("start")
        end_raw = request.query_params.get("end")

        start = None
        end = None
        try:
            if start_raw:
                start = timezone.datetime.fromisoformat(start_raw)
            if end_raw:
                end = timezone.datetime.fromisoformat(end_raw)
        except ValueError:
            return Response({"error": "Invalid date format. Use ISO format."}, status=400)

        rows, headers = self._build_dataset(dataset, start, end)
        if headers is None:
            return Response({"error": "Invalid dataset."}, status=400)

        filename_base = f"{dataset}_{timezone.now().strftime('%Y%m%d_%H%M%S')}"
        if file_format == "csv":
            return self._to_csv(filename_base, headers, rows)
        if file_format == "xlsx":
            return self._to_xlsx(filename_base, headers, rows)
        return Response({"error": "Invalid format. Use csv or xlsx."}, status=400)

    def _build_dataset(self, dataset: str, start, end):
        date_filter = {}
        if start:
            date_filter["created_at__gte"] = start
        if end:
            date_filter["created_at__lte"] = end

        if dataset == "users":
            qs = User.objects.all().order_by("-date_joined")
            headers = ["id", "username", "email", "phone", "role", "is_active", "is_staff", "date_joined"]
            rows = [
                [u.id, u.username, u.email, u.phone or "", u.role, u.is_active, u.is_staff, u.date_joined.isoformat()]
                for u in qs
            ]
            return rows, headers
        if dataset == "transactions":
            qs = Transaction.objects.select_related("user").filter(**date_filter).order_by("-created_at")
            headers = ["id", "user", "email", "type", "status", "amount", "target", "provider_reference", "created_at"]
            rows = [
                [t.id, t.user.username, t.user.email, t.type, t.status, str(t.amount), t.target, t.provider_reference or "", t.created_at.isoformat()]
                for t in qs
            ]
            return rows, headers
        if dataset == "refunds":
            qs = Transaction.objects.select_related("user").filter(is_refunded=True, **date_filter).order_by("-created_at")
            headers = ["id", "user", "type", "amount", "refund_reference", "refunded_at", "created_at"]
            rows = [
                [t.id, t.user.username, t.type, str(t.amount), t.refund_reference or "", t.refunded_at.isoformat() if t.refunded_at else "", t.created_at.isoformat()]
                for t in qs
            ]
            return rows, headers
        if dataset == "wallet-ledger":
            qs = Ledger.objects.select_related("wallet__user").filter(**date_filter).order_by("-created_at")
            headers = ["id", "user", "ledger_type", "amount", "balance_before", "balance_after", "reference", "description", "created_at"]
            rows = [
                [l.id, l.wallet.user.username, l.ledger_type, str(l.amount), str(l.balance_before), str(l.balance_after), l.reference, l.description, l.created_at.isoformat()]
                for l in qs
            ]
            return rows, headers
        return None, None

    def _to_csv(self, filename_base: str, headers, rows):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename_base}.csv"'
        writer = csv.writer(response)
        writer.writerow(headers)
        writer.writerows(rows)
        return response

    def _to_xlsx(self, filename_base: str, headers, rows):
        try:
            from openpyxl import Workbook
        except Exception:
            return Response({"error": "XLSX export requires openpyxl dependency."}, status=500)
        wb = Workbook()
        ws = wb.active
        ws.title = "Export"
        ws.append(headers)
        for row in rows:
            ws.append(row)
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename_base}.xlsx"'
        return response


class AdminTopProductsView(APIView):
    """Top products by transaction count and revenue in a given period."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="days", type=int, description="Number of days to look back (default 30)"),
            OpenApiParameter(name="limit", type=int, description="Max products to return (default 10)"),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        try:
            days = int(request.query_params.get("days", 30))
        except (TypeError, ValueError):
            days = 30
        try:
            limit = int(request.query_params.get("limit", 10))
        except (TypeError, ValueError):
            limit = 10

        period_start = timezone.now() - timedelta(days=days)

        top_products = list(
            Transaction.objects.filter(
                created_at__gte=period_start,
                status=TransactionStatus.SUCCESS,
            )
            .exclude(type=TransactionType.DEPOSIT)
            .values("type")
            .annotate(count=Count("id"), revenue=Sum("amount"))
            .order_by("-revenue")[:limit]
        )

        # Map type codes to human-readable names
        TYPE_NAMES = dict(TransactionType.choices)

        result = [
            {
                "name": TYPE_NAMES.get(p["type"], p["type"]),
                "count": p["count"],
                "revenue": str(p["revenue"] or 0),
            }
            for p in top_products
        ]

        return Response({"top_products": result})

