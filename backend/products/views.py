from django.db.models import Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from common.permissions import IsAdminUser
from drf_spectacular.utils import OpenApiParameter, extend_schema

from .models import Product
from .serializers import ProductSerializer, ProductListSerializer
from .cache import get_active_products


class ProductListView(APIView):
    """
    List active products with optional network/category filtering.

    Returns a plain array (matching frontend useFetch<ApiProduct[]>).
    """
    permission_classes = [AllowAny]
    serializer_class = ProductListSerializer

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="network",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Filter by network (MTN, GLO, AIRTEL, 9MOBILE)",
                required=False,
            ),
            OpenApiParameter(
                name="category",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Filter by category (AIRTIME, DATA, ELECTRICITY, CABLE, BROADBAND, EDUCATION)",
                required=False,
            ),
        ],
        responses={200: ProductListSerializer(many=True)},
    )
    def get(self, request):
        products = get_active_products()

        network = request.query_params.get("network")
        if network:
            products = [p for p in products if p.network == network.upper()]

        category = request.query_params.get("category")
        if category:
            products = [p for p in products if p.category == category.upper()]

        serializer = ProductListSerializer(products, many=True)
        # Return plain array — frontend useFetch<ApiProduct[]> expects this
        return Response(serializer.data)


class ProductCategoryView(APIView):
    """
    Get products by category.

    Returns a plain array.
    """

    permission_classes = [AllowAny]
    serializer_class = ProductListSerializer

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="category",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Filter by category (AIRTIME, DATA, ELECTRICITY, CABLE, BROADBAND, EDUCATION)",
                required=True,
            )
        ],
        responses={200: ProductListSerializer(many=True)},
    )
    def get(self, request):
        category = request.query_params.get("category")
        if not category:
            return Response(
                {"error": "Category is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        all_products = get_active_products()
        products = [p for p in all_products if p.category == category.upper()]
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)


class ProductDetailView(generics.RetrieveAPIView):
    """
    Get product details.
    """

    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class AdminProductListView(generics.ListCreateAPIView):
    """
    Admin: List all products or create new product.
    Supports filtering via query params: category, provider, network, is_active, search.
    """

    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        qs = Product.objects.all()
        params = self.request.query_params

        category = params.get("category")
        if category:
            qs = qs.filter(category=category.upper())

        provider = params.get("provider")
        if provider:
            qs = qs.filter(provider=provider)

        network = params.get("network")
        if network:
            qs = qs.filter(network=network.upper())

        is_active = params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("true", "1"))

        search = params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(provider_product_code__icontains=search))

        return qs


class AdminProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Admin: Retrieve, update or delete a product.

    DELETE performs a soft delete (is_active=False, is_deleted=True) so
    historical transactions keep their product reference. The post_save
    signal still fires and invalidates the active-catalog cache.
    """

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def perform_destroy(self, instance):
        instance.soft_delete()
