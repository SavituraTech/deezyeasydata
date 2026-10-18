"""
Fetch Newdatasub catalog via ``get_available_services`` and map rows to ``Product`` fields.
Response shape varies; parsing is defensive and logs skips.
"""

from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from django.conf import settings

from products.models import Network, ProductCategory
from products.newdatasub_image_urls import image_url_for_product
from providers.client import NewdatasubClient

logger = logging.getLogger(__name__)

PROVIDER_SLUG = "newdatasub"

# Data plan sub-categories (dbn-frontend parity: CORPORATE tab for MTN "CG"/corporate gifting).
PLAN_GROUPS = ("CORPORATE", "SME", "GIFTING", "AWOOF")


def _normalize_plan_group(row: dict[str, Any]) -> str | None:
    """
    Canonical plan sub-category (CORPORATE/SME/GIFTING/AWOOF) for a parsed
    catalog row. Prefers the group bucket captured by _structured_service_rows,
    falls back to the row's own sub-service marker, and returns None when the
    row carries no recognizable plan-group marker.
    """
    raw = row.get("__plan_group") or row.get("sub_service_group_name") or ""
    text = str(raw).strip().upper()
    if not text:
        return None
    for group in PLAN_GROUPS:
        if group in text:
            return group
    return None


DEFAULT_ACTIONS = (
    "get_available_services",
    "get_available_service",
    "list_available_services",
    "available_services",
    # Aliases seen on some autobiz-style resellers (safe no-op to try after the above fail)
    "get_services",
    "list_services",
    "fetch_services",
)


def _truthy_status(raw: Any) -> bool:
    if raw is True:
        return True
    if raw is False or raw is None:
        return False
    if isinstance(raw, (int, float)):
        return raw != 0
    s = str(raw).strip().lower()
    return s in {"true", "1", "yes", "success", "ok"}


def _collect_product_like_dicts(obj: Any, out: list[dict[str, Any]]) -> None:
    """Depth-first collect dicts that look like a product/service row."""
    if isinstance(obj, dict):
        code = (
            obj.get("product_code")
            or obj.get("code")
            or obj.get("service_code")
            or obj.get("plan_code")
            or obj.get("sku")
            or obj.get("available_service_system_name")
        )
        name = (
            obj.get("name")
            or obj.get("title")
            or obj.get("product_name")
            or obj.get("service_name")
            or obj.get("available_service_name")
            or obj.get("description")
        )
        if code is not None and str(code).strip():
            out.append(obj)
        elif name and any(
            k in obj for k in ("amount", "price", "cost_price", "category", "network")
        ):
            out.append(obj)
        for v in obj.values():
            _collect_product_like_dicts(v, out)
    elif isinstance(obj, list):
        for item in obj:
            _collect_product_like_dicts(item, out)


def extract_service_rows(response: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten nested API JSON into a list of dict rows."""
    rows: list[dict[str, Any]] = []
    _collect_product_like_dicts(response, rows)
    # De-duplicate by normalized product code
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        code = _normalize_product_code(row)
        if not code:
            continue
        key = code.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def _normalize_product_code(row: dict[str, Any]) -> str:
    code = (
        row.get("product_code")
        or row.get("code")
        or row.get("service_code")
        or row.get("plan_code")
        or row.get("sku")
        or row.get("available_service_system_name")
    )
    if code is None:
        return ""
    return str(code).strip()


def _decimal_or_zero(val: Any) -> Decimal:
    if val is None or val == "":
        return Decimal("0")
    try:
        return Decimal(str(val).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _parse_prices(row: dict[str, Any]) -> tuple[Decimal, Decimal]:
    cost = (
        row.get("cost_price")
        or row.get("agent_price")
        or row.get("price")
        or row.get("amount")
        or row.get("cost")
        or row.get("available_service_default_price")
    )
    sell = (
        row.get("selling_price")
        or row.get("user_price")
        or row.get("retail_price")
        or row.get("sale_price")
        or row.get("available_service_default_price")
    )
    c = _decimal_or_zero(cost)
    s = _decimal_or_zero(sell)
    if c == 0 and s == 0:
        return Decimal("0"), Decimal("0")
    if c == 0:
        c = s
    if s == 0:
        s = c
    return c, s


def _infer_network(code: str, row: dict[str, Any]) -> str | None:
    raw = (
        row.get("network")
        or row.get("network_name")
        or row.get("telco")
        or row.get("operator")
    )
    if raw:
        s = str(raw).strip().upper().replace(" ", "")
        aliases = {
            "9MOBILE": "9MOBILE",
            "9MOB": "9MOBILE",
            "ETISALAT": "9MOBILE",
        }
        s = aliases.get(s, s)
        if s in {n.value for n in Network}:
            return s
    lower = code.lower()
    for prefix, net in (
        ("mtn_", "MTN"),
        ("mtn-", "MTN"),
        ("glo_", "GLO"),
        ("glo-", "GLO"),
        ("airtel_", "AIRTEL"),
        ("airtel-", "AIRTEL"),
        ("9mobile_", "9MOBILE"),
        ("9mobile-", "9MOBILE"),
    ):
        if lower.startswith(prefix):
            return net
    if lower.startswith("mtn"):
        return "MTN"
    if lower.startswith("glo"):
        return "GLO"
    if lower.startswith("airtel"):
        return "AIRTEL"
    if lower.startswith("9mobile"):
        return "9MOBILE"
    return None


def _infer_category(code: str, row: dict[str, Any]) -> str | None:
    raw = (
        row.get("category")
        or row.get("type")
        or row.get("service_type")
        or row.get("service")
        or row.get("group")
    )
    if raw:
        u = str(raw).strip().upper().replace(" ", "_")
        fixes = {
            "CABLE_TV": "CABLE",
            "CABLETV": "CABLE",
            "TELCO": "DATA",
            "DATABUNDLE": "DATA",
            "DATA_BUNDLE": "DATA",
        }
        u = fixes.get(u, u)
        if u in {c.value for c in ProductCategory}:
            return u
        # e.g. "Airtime" -> AIRTIME
        for c in ProductCategory:
            if c.label.upper() == u or c.value == u:
                return c.value

    text = f"{code} {row.get('name', '')} {row.get('title', '')}".lower()
    if "airtime" in text or "vtu" in text and not any(
        x in text for x in ("data", "gb", "mb", "bundle")
    ):
        if any(x in text for x in ("data", "gb", "mb", "bundle", "plan")):
            pass
        else:
            return ProductCategory.AIRTIME.value
    if "airtime" in text and "data" not in text and "gb" not in text:
        return ProductCategory.AIRTIME.value
    if any(x in text for x in ("data", "gb", "mb", "bundle", "plan")):
        return ProductCategory.DATA.value
    if any(
        x in text
        for x in (
            "electric",
            "disco",
            "meter",
            "kedc",
            "ikedc",
            "aedc",
            "ekedc",
            "prepaid",
            "postpaid",
        )
    ):
        return ProductCategory.ELECTRICITY.value
    if any(x in text for x in ("dstv", "gotv", "startimes", "cable", "smartcard")):
        return ProductCategory.CABLE.value
    if any(x in text for x in ("smile", "spectranet", "broadband")):
        return ProductCategory.BROADBAND.value
    if any(x in text for x in ("waec", "neco", "nabteb", "jamb", "education", "pin")):
        return ProductCategory.EDUCATION.value

    return None


def _fallback_category(code: str, row: dict[str, Any]) -> str:
    """
    Best-effort category fallback used when heuristics cannot classify a row.
    We never skip provider rows solely because category parsing is ambiguous.
    """
    text = f"{code} {row.get('name', '')} {row.get('title', '')}".lower()
    if code.lower().endswith("_custom") and any(
        n in text for n in ("mtn", "glo", "airtel", "9mobile", "etisalat")
    ):
        return ProductCategory.AIRTIME.value
    return ProductCategory.DATA.value


def _infer_data_meta(category: str, row: dict[str, Any]) -> tuple[str | None, str | None]:
    if category != ProductCategory.DATA.value:
        return None, None
    size = row.get("data_size") or row.get("size") or row.get("volume") or row.get("bundle")
    validity = row.get("data_validity") or row.get("validity") or row.get("duration")
    if size:
        size = str(size).strip()[:50]
    if validity:
        validity = str(validity).strip()[:50]
    return size, validity


def _structured_service_rows(response: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Parse Newdatasub `get_available_services` structured payload in the same spirit as
    dbn-backend's seeding command: walk known service buckets and emit normalized rows.
    """
    services = response.get("data")
    if not isinstance(services, dict):
        return []

    rows: list[dict[str, Any]] = []

    def add_row(
        raw: dict[str, Any],
        *,
        category: str,
        network: str | None = None,
        provider_label: str | None = None,
        plan_group: str | None = None,
    ) -> None:
        row = dict(raw)
        row["__category"] = category
        row["__network"] = network
        row["__provider_label"] = provider_label
        row["__plan_group"] = plan_group
        rows.append(row)

    def add_plan_rows(
        raw: dict[str, Any],
        *,
        category: str,
        provider_label: str | None = None,
    ) -> None:
        """
        Add a service row to the output, expanding Newdatasub's nested
        ``sub_services`` -> ``available_services`` shape.

        A sub_service row (e.g. {"sub_service_code": "gotv", ...}) is a
        biller/provider grouping, not a vendable plan, so it is only used to
        carry context down to its child ``available_services`` rows.
        """
        children = raw.get("available_services")
        if isinstance(children, list):
            parent_label = str(
                raw.get("sub_service_code") or raw.get("sub_service_name") or ""
            ).upper()
            merged_label = (
                f"{provider_label}_{parent_label}" if provider_label else parent_label
            )
            for child in children:
                if isinstance(child, dict):
                    child = dict(child)
                    if merged_label:
                        child["__sub_service"] = merged_label
                    add_row(
                        child,
                        category=category,
                        provider_label=merged_label or provider_label,
                    )
            return
        add_row(raw, category=category, provider_label=provider_label)

    # Airtime
    for item in services.get("airtime_topup", []):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "")
        network = _infer_network(str(item.get("product_code") or ""), {"network": name})
        add_row(item, category=ProductCategory.AIRTIME.value, network=network)

    # Data bundles
    data_bundle = services.get("data_bundle", {})
    if isinstance(data_bundle, dict):
        for network_key, groups in data_bundle.items():
            if network_key == "network_operators":
                continue
            network = _infer_network(str(network_key), {"network": network_key})
            if not isinstance(groups, list):
                continue
            for group in groups:
                if not isinstance(group, dict):
                    continue
                # Authoritative plan sub-category (SME / GIFTING / AWOOF / CORPORATE).
                # Prefer the group bucket name; fall back to the plan row's own marker.
                plan_group = str(
                    group.get("group_name")
                    or group.get("sub_service_group_name")
                    or ""
                ).strip().upper() or None
                for service in group.get("available_services", []):
                    if isinstance(service, dict):
                        pg = plan_group or str(
                            service.get("sub_service_group_name") or ""
                        ).strip().upper() or None
                        add_row(service, category=ProductCategory.DATA.value, network=network, plan_group=pg)

    # Cable
    tv = services.get("tv", {})
    if isinstance(tv, dict):
        for key, plans in tv.items():
            if not isinstance(plans, list):
                continue
            provider_label = str(key).upper()
            for plan in plans:
                if isinstance(plan, dict):
                    add_plan_rows(
                        plan,
                        category=ProductCategory.CABLE.value,
                        provider_label=provider_label,
                    )

    # Electricity
    electricity = services.get("electricity_bill", {})
    if isinstance(electricity, dict):
        for key, plans in electricity.items():
            if key == "provider" or not isinstance(plans, list):
                continue
            provider_label = str(key).upper()
            for plan in plans:
                if isinstance(plan, dict):
                    add_plan_rows(
                        plan,
                        category=ProductCategory.ELECTRICITY.value,
                        provider_label=provider_label,
                    )

    # Broadband
    broadband = services.get("broadband_internet", {})
    if isinstance(broadband, dict):
        for key, plans in broadband.items():
            if key == "provider" or not isinstance(plans, list):
                continue
            provider_label = str(key).upper()
            for plan in plans:
                if isinstance(plan, dict):
                    add_plan_rows(
                        plan,
                        category=ProductCategory.BROADBAND.value,
                        provider_label=provider_label,
                    )

    # Education
    education = services.get("educational_bill", {})
    if isinstance(education, dict):
        for key, plans in education.items():
            if key == "types" or not isinstance(plans, list):
                continue
            provider_label = str(key).upper()
            for plan in plans:
                if isinstance(plan, dict):
                    add_plan_rows(
                        plan,
                        category=ProductCategory.EDUCATION.value,
                        provider_label=provider_label,
                    )

    return rows


def row_to_product_defaults(
    row: dict[str, Any],
    *,
    apply_images: bool,
) -> dict[str, Any] | None:
    code = _normalize_product_code(row)
    if not code:
        return None

    name = (
        row.get("name")
        or row.get("title")
        or row.get("product_name")
        or row.get("available_service_name")
        or code
    )
    name = str(name).strip()[:200]
    if not name:
        name = code

    category = row.get("__category") or _infer_category(code, row)
    if not category:
        category = _fallback_category(code, row)
        logger.warning(
            "Category inference fallback for %s: using %s",
            code,
            category,
        )

    network = row.get("__network")
    if category in (
        ProductCategory.AIRTIME.value,
        ProductCategory.DATA.value,
    ) and not network:
        network = _infer_network(code, row)
    if category in (ProductCategory.AIRTIME.value, ProductCategory.DATA.value) and not network:
        logger.warning(
            "Network inference fallback for %s (%s): keeping network as null",
            code,
            category,
        )

    cost, sell = _parse_prices(row)
    data_size, data_validity = _infer_data_meta(category, row)

    defaults: dict[str, Any] = {
        "name": name,
        "category": category,
        "network": network,
        # ``provider`` must stay the provider slug (e.g. "newdatasub") because
        # run_sync upserts on (provider, provider_product_code) and
        # --deactivate-missing filters on provider=PROVIDER_SLUG. The biller
        # label (e.g. GOTV/DSTV) stays on the row as ``__provider_label``.
        "provider": PROVIDER_SLUG,
        "cost_price": cost,
        "selling_price": sell,
        "commission": _decimal_or_zero(row.get("commission")),
        "is_active": True,
        "data_size": data_size,
        "data_validity": data_validity,
        # Authoritative sub-category (CORPORATE/SME/GIFTING/AWOOF) captured by
        # _structured_service_rows; None for rows without a group marker.
        "plan_group": _normalize_plan_group(row),
        "description": (
            str(row.get("description")).strip()[:500]
            if row.get("description")
            else (
                str(row.get("available_service_description")).strip()[:500]
                if row.get("available_service_description")
                else None
            )
        ),
    }
    if apply_images:
        defaults["image_url"] = image_url_for_product(
            category=category,
            network=network,
            provider_product_code=code,
        )

    return defaults


def fetch_available_services(
    client: NewdatasubClient | None = None,
) -> tuple[dict[str, Any], str]:
    """
    POST ``action=get_available_services`` (or configured fallbacks).
    Returns (raw_json, action_used).
    """
    client = client or NewdatasubClient()
    actions = getattr(settings, "NEWDATASUB_SYNC_ACTIONS", None) or list(DEFAULT_ACTIONS)
    if isinstance(actions, str):
        actions = [a.strip() for a in actions.split(",") if a.strip()]
    last_resp: dict[str, Any] | None = None
    for action in actions:
        resp = client.make_request({"action": action})
        last_resp = resp
        if _truthy_status(resp.get("status")):
            return resp, action
    msg = "no response"
    if last_resp is not None:
        msg = str(
            last_resp.get("message")
            or last_resp.get("server_message")
            or last_resp.get("raw_response")
            or last_resp
        )
    raise RuntimeError(f"Newdatasub catalog request failed after trying {list(actions)}: {msg}")


def run_sync(
    *,
    dry_run: bool,
    apply_images: bool,
    deactivate_missing: bool,
) -> dict[str, Any]:
    """
    Upsert ``Product`` rows for provider ``newdatasub`` from API catalog.
    Returns stats dict: created, updated, skipped, deactivated, action, row_count.
    """
    from products.models import Product

    raw, action_used = fetch_available_services()
    rows = _structured_service_rows(raw)
    if not rows:
        rows = extract_service_rows(raw)
    seen_codes: set[str] = set()
    created = 0
    updated = 0
    skipped = 0

    for row in rows:
        defaults = row_to_product_defaults(row, apply_images=apply_images)
        if not defaults:
            skipped += 1
            continue
        code = _normalize_product_code(row)
        if not code:
            skipped += 1
            continue
        seen_codes.add(code)

        if dry_run:
            exists = Product.objects.filter(
                provider=PROVIDER_SLUG, provider_product_code=code
            ).exists()
            if exists:
                updated += 1
            else:
                created += 1
            continue

        _obj, was_created = Product.objects.update_or_create(
            provider=PROVIDER_SLUG,
            provider_product_code=code,
            defaults=defaults,
        )
        if was_created:
            created += 1
        else:
            updated += 1

    deactivated = 0
    if deactivate_missing and not dry_run and seen_codes:
        qs = Product.objects.filter(provider=PROVIDER_SLUG).exclude(
            provider_product_code__in=seen_codes
        )
        deactivated = qs.update(is_active=False)

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "deactivated": deactivated,
        "action": action_used,
        "row_count": len(rows),
        "parsed_codes": len(seen_codes),
    }
