"""
Caching helpers for the read-heavy, rarely-changing product catalog.

The catalog is only mutated through the Django admin or the admin product
update endpoint, both of which go through Product.save, so a simple
post-save/post-delete invalidation keeps the cache correct.

Parity with dbn-backend: 5-minute TTL, list-of-instances pattern.
"""

from django.core.cache import cache

ACTIVE_PRODUCTS_CACHE_KEY = "products:active_catalog"
ACTIVE_PRODUCTS_CACHE_TIMEOUT = 5 * 60  # 5 minutes


def invalidate_active_products_cache():
    """Drop the cached active catalog so the next request re-fetches from DB."""
    cache.delete(ACTIVE_PRODUCTS_CACHE_KEY)


def get_active_products():
    """
    Return the cached list of active Product instances, fetching from the DB
    once per timeout window.  Filters (network/category) are applied by the
    caller on the cached list, since the catalog is small.
    """
    products = cache.get(ACTIVE_PRODUCTS_CACHE_KEY)
    if products is None:
        from products.models import Product

        products = list(Product.objects.filter(is_active=True))
        cache.set(ACTIVE_PRODUCTS_CACHE_KEY, products, ACTIVE_PRODUCTS_CACHE_TIMEOUT)
    return products
