"""
IDOT Pay Item Report Scraper

Scrapes the Illinois DOT Transportation Bulletin website to download
"Pay Item Report with Awarded Prices" Excel files for each letting.

Website: https://webapps1.dot.illinois.gov/WCTB/

Scraping flow:
  1. Fetch home page → extract all letting detail links (GUIDs)
  2. For each letting → fetch detail page → find "Pay Item Report with Awarded Prices" link
  3. Download the .xlsx file
  4. Optionally upload to GCS bucket

Usage:
    scraper = IDOTScraper()
    results = await scraper.scrape_all_lettings()
    # or scrape a single letting:
    result = await scraper.scrape_letting("3782471b-35d4-4317-b981-4e70572fcb5e")
"""
from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://webapps1.dot.illinois.gov"
WCTB_BASE = f"{BASE_URL}/WCTB"
HOME_URL = f"{WCTB_BASE}/LbHome"
LETTING_DETAIL_URL = f"{WCTB_BASE}/LbLettingDetail/Index"
DOCUMENT_URL = f"{WCTB_BASE}/LettingDateDocument/ViewDocument"

# Match the letting detail link pattern
RE_LETTING_GUID = re.compile(
    r"/WCTB/LbLettingDetail/Index/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.IGNORECASE,
)

# Match the document download link pattern
RE_DOCUMENT_GUID = re.compile(
    r"/WCTB/LettingDateDocument/ViewDocument/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.IGNORECASE,
)


@dataclass
class LettingInfo:
    """One letting from the IDOT website."""
    letting_id: str  # GUID
    date_text: str = ""
    letting_date: datetime | None = None
    url: str = ""


@dataclass
class DownloadResult:
    """Result of downloading one pay item report."""
    letting_id: str
    letting_date: str = ""
    document_id: str = ""
    filename: str = ""
    file_path: str = ""
    file_size: int = 0
    success: bool = False
    error: str = ""


@dataclass
class ScrapeResult:
    """Overall scrape run results."""
    lettings_found: int = 0
    reports_downloaded: int = 0
    reports_skipped: int = 0
    reports_failed: int = 0
    downloads: list[DownloadResult] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class IDOTScraper:
    """Scrapes IDOT Transportation Bulletin for pay item reports."""

    def __init__(
        self,
        output_dir: str | Path = "./idot_pay_item_reports",
        skip_existing: bool = True,
        concurrency: int = 3,
        delay_seconds: float = 1.0,
    ):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.skip_existing = skip_existing
        self.concurrency = concurrency
        self.delay_seconds = delay_seconds
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(60.0),
                follow_redirects=True,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    ),
                },
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ------------------------------------------------------------------
    # Step 1: Get all letting detail links from the home page
    # ------------------------------------------------------------------

    async def get_all_lettings(self) -> list[LettingInfo]:
        """Fetch the IDOT home page and extract all letting detail links.

        Sources:
          1. Current letting anchor link (e.g., "April 24, 2026 12:00 PM")
          2. Archive dropdown (<select name="PriorLettingDate">) with 58+ past lettings
        """
        client = await self._get_client()
        logger.info(f"Fetching home page: {HOME_URL}")
        resp = await client.get(HOME_URL)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        lettings: list[LettingInfo] = []
        seen_ids: set[str] = set()

        # Source 1: Current letting — anchor links with LbLettingDetail GUIDs
        for link in soup.find_all("a", href=True):
            href = link["href"]
            match = RE_LETTING_GUID.search(href)
            if match:
                letting_id = match.group(1).lower()
                if letting_id in seen_ids:
                    continue
                seen_ids.add(letting_id)

                date_text = link.get_text(strip=True)
                letting_date = self._parse_letting_date(date_text)

                lettings.append(LettingInfo(
                    letting_id=letting_id,
                    date_text=date_text,
                    letting_date=letting_date,
                    url=f"{LETTING_DETAIL_URL}/{letting_id}",
                ))

        # Source 2: Archive dropdown — <select name="PriorLettingDate">
        archive_select = soup.find("select", {"name": "PriorLettingDate"})
        if archive_select:
            for option in archive_select.find_all("option"):
                value = option.get("value", "")
                match = RE_LETTING_GUID.search(value)
                if match:
                    letting_id = match.group(1).lower()
                    if letting_id in seen_ids:
                        continue
                    seen_ids.add(letting_id)

                    date_text = option.get_text(strip=True)
                    letting_date = self._parse_letting_date(date_text)

                    lettings.append(LettingInfo(
                        letting_id=letting_id,
                        date_text=date_text,
                        letting_date=letting_date,
                        url=f"{LETTING_DETAIL_URL}/{letting_id}",
                    ))

        # Sort by date descending (newest first)
        lettings.sort(
            key=lambda x: x.letting_date or datetime.min,
            reverse=True,
        )

        logger.info(f"Found {len(lettings)} lettings on home page")
        return lettings

    # ------------------------------------------------------------------
    # Step 2: Find the "Pay Item Report with Awarded Prices" link
    # ------------------------------------------------------------------

    async def find_pay_item_report_link(self, letting_id: str) -> str | None:
        """
        Fetch a letting detail page and find the download link for
        "Pay Item Report with Awarded Prices".

        Returns the document GUID or None if not found.
        """
        client = await self._get_client()
        url = f"{LETTING_DETAIL_URL}/{letting_id}"
        logger.info(f"Fetching letting detail: {url}")

        resp = await client.get(url)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # Look for links containing "Pay Item Report with Awarded Prices"
        for link in soup.find_all("a", href=True):
            text = link.get_text(strip=True).lower()
            if "pay item" in text and "awarded" in text:
                href = link["href"]
                match = RE_DOCUMENT_GUID.search(href)
                if match:
                    return match.group(1).lower()

        # Fallback: also check for links with just "awarded prices"
        for link in soup.find_all("a", href=True):
            text = link.get_text(strip=True).lower()
            if "awarded price" in text:
                href = link["href"]
                match = RE_DOCUMENT_GUID.search(href)
                if match:
                    return match.group(1).lower()

        logger.warning(f"No 'Pay Item Report with Awarded Prices' found for letting {letting_id}")
        return None

    # ------------------------------------------------------------------
    # Step 3: Download the Excel file
    # ------------------------------------------------------------------

    async def download_report(
        self,
        letting: LettingInfo,
        document_id: str,
    ) -> DownloadResult:
        """Download the pay item report Excel file."""
        result = DownloadResult(
            letting_id=letting.letting_id,
            letting_date=letting.date_text,
            document_id=document_id,
        )

        # Build filename from letting date
        date_str = ""
        if letting.letting_date:
            date_str = letting.letting_date.strftime("%Y_%m_%d")
        else:
            # Clean the date text for use as filename
            date_str = re.sub(r"[^\w]", "_", letting.date_text).strip("_")

        filename = f"IDOT_PayItemAwards_{date_str}.xlsx"
        file_path = self.output_dir / filename

        # Skip if already downloaded
        if self.skip_existing and file_path.exists() and file_path.stat().st_size > 0:
            logger.info(f"Skipping (already exists): {filename}")
            result.filename = filename
            result.file_path = str(file_path)
            result.file_size = file_path.stat().st_size
            result.success = True
            return result

        try:
            client = await self._get_client()
            url = f"{DOCUMENT_URL}/{document_id}"
            logger.info(f"Downloading: {url} -> {filename}")

            resp = await client.get(url)
            resp.raise_for_status()

            file_path.write_bytes(resp.content)

            result.filename = filename
            result.file_path = str(file_path)
            result.file_size = len(resp.content)
            result.success = True
            logger.info(f"Downloaded: {filename} ({result.file_size:,} bytes)")

        except Exception as e:
            result.error = str(e)
            logger.error(f"Download failed for {letting.letting_id}: {e}")

        return result

    # ------------------------------------------------------------------
    # Main orchestrator
    # ------------------------------------------------------------------

    async def scrape_letting(self, letting_id: str) -> DownloadResult:
        """Scrape a single letting by its GUID."""
        letting = LettingInfo(
            letting_id=letting_id,
            url=f"{LETTING_DETAIL_URL}/{letting_id}",
        )

        document_id = await self.find_pay_item_report_link(letting_id)
        if not document_id:
            return DownloadResult(
                letting_id=letting_id,
                error="Pay Item Report with Awarded Prices not found",
            )

        return await self.download_report(letting, document_id)

    async def scrape_all_lettings(self) -> ScrapeResult:
        """
        Scrape all lettings from the IDOT home page and download
        pay item reports for each.
        """
        result = ScrapeResult()

        try:
            lettings = await self.get_all_lettings()
            result.lettings_found = len(lettings)

            # Process lettings with controlled concurrency
            semaphore = asyncio.Semaphore(self.concurrency)

            async def process_letting(letting: LettingInfo) -> DownloadResult:
                async with semaphore:
                    try:
                        doc_id = await self.find_pay_item_report_link(letting.letting_id)
                        if not doc_id:
                            return DownloadResult(
                                letting_id=letting.letting_id,
                                letting_date=letting.date_text,
                                error="Pay Item Report with Awarded Prices not found",
                            )

                        # Polite delay between requests
                        await asyncio.sleep(self.delay_seconds)

                        return await self.download_report(letting, doc_id)
                    except Exception as e:
                        return DownloadResult(
                            letting_id=letting.letting_id,
                            letting_date=letting.date_text,
                            error=str(e),
                        )

            # Run all lettings
            tasks = [process_letting(letting) for letting in lettings]
            downloads = await asyncio.gather(*tasks)

            for dl in downloads:
                result.downloads.append(dl)
                if dl.success:
                    result.reports_downloaded += 1
                elif dl.error and "already exists" not in dl.error:
                    if "not found" in dl.error.lower():
                        result.reports_skipped += 1
                    else:
                        result.reports_failed += 1
                        result.errors.append(f"{dl.letting_date}: {dl.error}")

        except Exception as e:
            result.errors.append(f"Scraper error: {e}")
            logger.error(f"Scraper error: {e}")
        finally:
            await self.close()

        logger.info(
            f"Scrape complete: {result.lettings_found} lettings, "
            f"{result.reports_downloaded} downloaded, "
            f"{result.reports_skipped} skipped (no report), "
            f"{result.reports_failed} failed"
        )
        return result

    # ------------------------------------------------------------------
    # GCS upload
    # ------------------------------------------------------------------

    async def upload_to_gcs(
        self,
        bucket_name: str = "il-idot-awards-new",
        prefix: str = "pay_item_reports/",
    ) -> list[str]:
        """
        Upload all downloaded reports to a GCS bucket.
        Requires google-cloud-storage to be installed.
        """
        from google.cloud import storage

        client = storage.Client()
        bucket = client.bucket(bucket_name)
        uploaded: list[str] = []

        for file_path in sorted(self.output_dir.glob("*.xlsx")):
            blob_name = f"{prefix}{file_path.name}"
            blob = bucket.blob(blob_name)

            if blob.exists():
                logger.info(f"Skipping (already in GCS): {blob_name}")
                continue

            logger.info(f"Uploading: {file_path.name} -> gs://{bucket_name}/{blob_name}")
            blob.upload_from_filename(str(file_path))
            uploaded.append(blob_name)

        logger.info(f"Uploaded {len(uploaded)} files to gs://{bucket_name}/{prefix}")
        return uploaded

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_letting_date(text: str) -> datetime | None:
        """Parse letting date from link text like 'November 07, 2025'."""
        # Try common formats
        for fmt in [
            "%B %d, %Y",           # November 07, 2025
            "%B %d, %Y %I:%M %p",  # November 07, 2025 12:00 PM
            "%m/%d/%Y",            # 11/07/2025
        ]:
            try:
                return datetime.strptime(text.strip(), fmt)
            except ValueError:
                continue

        # Try extracting date from longer strings
        date_match = re.search(
            r"(\w+ \d{1,2},?\s*\d{4})", text
        )
        if date_match:
            for fmt in ["%B %d, %Y", "%B %d %Y"]:
                try:
                    return datetime.strptime(date_match.group(1), fmt)
                except ValueError:
                    continue

        return None


# ---------------------------------------------------------------------------
# CLI entry point for standalone usage
# ---------------------------------------------------------------------------

async def main():
    """Run the scraper from the command line."""
    import argparse

    parser = argparse.ArgumentParser(description="IDOT Pay Item Report Scraper")
    parser.add_argument(
        "--output-dir", default="./idot_pay_item_reports",
        help="Directory to save downloaded reports",
    )
    parser.add_argument(
        "--letting-id", default=None,
        help="Scrape a single letting by GUID (skip home page scan)",
    )
    parser.add_argument(
        "--upload-gcs", action="store_true",
        help="Upload downloaded files to GCS after scraping",
    )
    parser.add_argument(
        "--bucket", default="il-idot-awards-new",
        help="GCS bucket for upload",
    )
    parser.add_argument(
        "--concurrency", type=int, default=3,
        help="Max concurrent requests",
    )
    parser.add_argument(
        "--delay", type=float, default=1.0,
        help="Delay between requests in seconds",
    )
    parser.add_argument(
        "--no-skip", action="store_true",
        help="Re-download even if file exists",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    scraper = IDOTScraper(
        output_dir=args.output_dir,
        skip_existing=not args.no_skip,
        concurrency=args.concurrency,
        delay_seconds=args.delay,
    )

    if args.letting_id:
        result = await scraper.scrape_letting(args.letting_id)
        if result.success:
            print(f"Downloaded: {result.filename} ({result.file_size:,} bytes)")
        else:
            print(f"Failed: {result.error}")
    else:
        result = await scraper.scrape_all_lettings()
        print(f"\nScrape complete:")
        print(f"  Lettings found:     {result.lettings_found}")
        print(f"  Reports downloaded: {result.reports_downloaded}")
        print(f"  Reports skipped:    {result.reports_skipped}")
        print(f"  Reports failed:     {result.reports_failed}")
        if result.errors:
            print(f"\nErrors:")
            for err in result.errors:
                print(f"  - {err}")

    if args.upload_gcs:
        uploaded = await scraper.upload_to_gcs(bucket_name=args.bucket)
        print(f"\nUploaded {len(uploaded)} files to GCS")

    await scraper.close()


if __name__ == "__main__":
    asyncio.run(main())
