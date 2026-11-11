"""Read-only connectivity probe; authenticated operations follow separately."""

import asyncio
import httpx

from app.config import Settings


async def probe_api(settings: Settings) -> None:
    async with httpx.AsyncClient(
        timeout=settings.request_timeout, follow_redirects=False
    ) as client:
        response = await client.get(
            str(settings.mayan_api_url), headers={"Accept": "application/json"}
        )
        response.raise_for_status()
        if "application/json" not in response.headers.get("content-type", ""):
            raise ValueError("API returned non-JSON content; check the configured API URL.")
        response.json()


def main() -> None:
    try:
        asyncio.run(probe_api(Settings()))
    except (httpx.HTTPError, ValueError):
        raise SystemExit("API probe failed. Check the API URL, VPN/network, TLS, and server availability.") from None
    print("PASS: API root returned valid JSON. Authentication and document access are not tested.")


if __name__ == "__main__":
    main()
