"""
Logo paths aligned with frontend `service-images.ts`.
All logos are vendored in the Next.js app at `frontend/public/logos/` and
served same-origin, so `Product.image_url` uses root-relative paths.
Used when syncing products to populate `Product.image_url`.
"""

# Networks
NETWORK_LOGO_BY_KEY: dict[str, str] = {
    "MTN": "/logos/mtn.png",
    "GLO": "/logos/glo.png",
    "AIRTEL": "/logos/airtel.png",
    "9MOBILE": "/logos/9mobile.jpg",
}

CABLE_LOGO_BY_KEY: dict[str, str] = {
    "GOTV": "/logos/gotv.jpg",
    "STARTIMES": "/logos/startimes.png",
    "DSTV": "/logos/dstv.png",
}

ELECTRICITY_LOGO_BY_KEY: dict[str, str] = {
    "IKEDC": "/logos/ikedc.png",
    "IBEDC": "/logos/ibedc.png",
    "AEDC": "/logos/aedc.png",
    "KEDC": "/logos/kedc.png",
    "YEDC": "/logos/yedc.png",
    "KNEDC": "/logos/knedc.jpg",
    "PHED": "/logos/phed.png",
    "PHEDC": "/logos/phed.png",
    "EKEDC": "/logos/ekedc.jpg",
    "BEDC": "/logos/bedc.png",
    "EEDC": "/logos/eedc.png",
    "JEDC": "/logos/jedc.png",
    "KEDCO": "/logos/kedc.png",
    "KAEDCO": "/logos/knedc.jpg",
}

BROADBAND_LOGO_BY_KEY: dict[str, str] = {
    "SMILE": "/logos/smile.png",
    "SPECTRANET": "/logos/spectranet.png",
}

EDUCATION_LOGO_BY_KEY: dict[str, str] = {
    "JAMB": "/logos/jamb.png",
    "WAEC": "/logos/waec.png",
    "NECO": "/logos/neco.jpg",
    "NABTEB": "/logos/neco.jpg",
}


def image_url_for_product(
    *,
    category: str,
    network: str | None,
    provider_product_code: str,
) -> str | None:
    """Best-effort logo URL for catalog display."""
    code = (provider_product_code or "").lower()
    if network and network in NETWORK_LOGO_BY_KEY:
        return NETWORK_LOGO_BY_KEY[network]

    if category == "CABLE":
        if "dstv" in code:
            return CABLE_LOGO_BY_KEY.get("DSTV")
        if "gotv" in code:
            return CABLE_LOGO_BY_KEY.get("GOTV")
        if "startimes" in code or "star" in code:
            return CABLE_LOGO_BY_KEY.get("STARTIMES")

    if category == "ELECTRICITY":
        for key, url in ELECTRICITY_LOGO_BY_KEY.items():
            if code.startswith(key.lower()):
                return url

    if category == "BROADBAND":
        if "smile" in code:
            return BROADBAND_LOGO_BY_KEY.get("SMILE")
        if "spectranet" in code:
            return BROADBAND_LOGO_BY_KEY.get("SPECTRANET")

    if category == "EDUCATION":
        if "waec" in code:
            return EDUCATION_LOGO_BY_KEY.get("WAEC")
        if "neco" in code:
            return EDUCATION_LOGO_BY_KEY.get("NECO")
        if "nabteb" in code:
            return EDUCATION_LOGO_BY_KEY.get("NABTEB")
        if "jamb" in code:
            return EDUCATION_LOGO_BY_KEY.get("JAMB")

    return None
