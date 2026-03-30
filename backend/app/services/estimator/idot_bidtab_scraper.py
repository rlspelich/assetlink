"""
IDOT Bid Tab Scraper

Scrapes the Illinois DOT WCTB (Letting and Bidding) portal to download
"Unit Price Tabulation of Bids" ZIP files for each letting. Each ZIP
contains one fixed-width .txt file per contract — the same format the
existing parser (idot_bidtabs.py) handles.

Website: https://webapps.dot.illinois.gov/WCTB/LbHome

Scraping flow:
  1. Fetch home page → extract all letting detail links (GUIDs)
  2. For each letting → fetch detail page → find "Unit Price Tabulation" link
  3. Download the .zip file
  4. Extract .txt files, rename to standardized filenames
  5. Optionally upload to GCS bucket

The rename convention (from BidParser ilutility.py) produces:
  {TYPE}{YYYYMMDD}ILTABS{CONTRACT}.txt
  e.g. SCH20200515ILTABS12345.txt

Usage:
    # Download all available lettings:
    python -m app.services.estimator.idot_bidtab_scraper --output-dir ./bidtab_downloads

    # Download a single letting:
    python -m app.services.estimator.idot_bidtab_scraper --letting-id <GUID>

    # Download and upload to GCS:
    python -m app.services.estimator.idot_bidtab_scraper --upload-gcs --bucket il-idot-bidtabs
"""
from __future__ import annotations

import asyncio
import io
import logging
import re
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# WCTB portal (note: may use webapps.dot or webapps1.dot — try both)
WCTB_HOSTS = [
    "https://webapps.dot.illinois.gov",
    "https://webapps1.dot.illinois.gov",
]
WCTB_PATH = "/WCTB"
HOME_PATH = f"{WCTB_PATH}/LbHome"
LETTING_DETAIL_PATH = f"{WCTB_PATH}/LbLettingDetail/Index"
DOCUMENT_PATH = f"{WCTB_PATH}/LettingDateDocument/ViewDocument"

# Regex for extracting GUIDs from links
RE_LETTING_GUID = re.compile(
    r"/WCTB/LbLettingDetail/Index/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.IGNORECASE,
)
RE_DOCUMENT_GUID = re.compile(
    r"/WCTB/LettingDateDocument/ViewDocument/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.IGNORECASE,
)


@dataclass
class LettingInfo:
    """One letting from the IDOT WCTB portal."""
    letting_id: str  # GUID
    date_text: str = ""
    letting_date: datetime | None = None
    url: str = ""


@dataclass
class BidTabDownloadResult:
    """Result of downloading one letting's bid tab ZIP."""
    letting_id: str
    letting_date: str = ""
    document_id: str = ""
    zip_filename: str = ""
    txt_files_extracted: int = 0
    txt_files_renamed: int = 0
    txt_filenames: list[str] = field(default_factory=list)
    success: bool = False
    error: str = ""


@dataclass
class BidTabScrapeResult:
    """Overall scrape run results."""
    lettings_found: int = 0
    lettings_downloaded: int = 0
    lettings_skipped: int = 0
    lettings_failed: int = 0
    total_txt_files: int = 0
    downloads: list[BidTabDownloadResult] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def rename_bid_tab_file(content: str) -> str | None:
    """
    Generate a standardized filename from bid tab file content.

    Reads the letting date, type, and contract number from the fixed-width
    header and produces: {TYPE}{YYYYMMDD}ILTABS{CONTRACT}.txt

    Ported from BidParser ilutility.py.
    """
    lines = content.split("\n")
    if len(lines) < 3:
        return None

    # Fix bid tab documents that start with one blank space at the beginning of each line
    if len(lines[2]) > 0 and lines[2].startswith(" "):
        lines = [line[1:] if line.startswith(" ") else line for line in lines]

    try:
        # Extract from fixed-width positions in line 3 (index 2)
        header_line = lines[2]
        letting_date_str = header_line[14:24].strip()  # MM/DD/YYYY
        letting_type = header_line[40:43].strip()  # SCH, SPE, AER, etc.
        contract = header_line[99:105].strip()

        if not letting_date_str or not contract:
            return None

        parts = letting_date_str.split("/")
        if len(parts) != 3:
            return None

        month, day, year = parts
        return f"{letting_type}{year}{month}{day}ILTABS{contract}.txt"
    except (IndexError, ValueError):
        return None


class IDOTBidTabScraper:
    """Scrapes IDOT WCTB portal for bid tab ZIP files."""

    def __init__(
        self,
        output_dir: str | Path = "./idot_bidtab_downloads",
        skip_existing: bool = True,
        concurrency: int = 2,
        delay_seconds: float = 1.5,
    ):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.skip_existing = skip_existing
        self.concurrency = concurrency
        self.delay_seconds = delay_seconds
        self._client: httpx.AsyncClient | None = None
        self._base_url: str = WCTB_HOSTS[0]

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(120.0),
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
        """Fetch the WCTB home page and extract all letting detail links."""
        client = await self._get_client()

        # Try both host variants
        resp = None
        for host in WCTB_HOSTS:
            url = f"{host}{HOME_PATH}"
            try:
                logger.info(f"Fetching home page: {url}")
                resp = await client.get(url)
                resp.raise_for_status()
                self._base_url = host
                break
            except Exception as e:
                logger.warning(f"Failed to reach {url}: {e}")
                continue

        if resp is None:
            raise RuntimeError("Could not reach IDOT WCTB portal on any host")

        soup = BeautifulSoup(resp.text, "html.parser")
        lettings: list[LettingInfo] = []
        seen_ids: set[str] = set()

        # Source 1: Anchor links with LbLettingDetail GUIDs
        for link in soup.find_all("a", href=True):
            href = link["href"]
            match = RE_LETTING_GUID.search(href)
            if match:
                letting_id = match.group(1).lower()
                if letting_id in seen_ids:
                    continue
                seen_ids.add(letting_id)
                date_text = link.get_text(strip=True)
                lettings.append(LettingInfo(
                    letting_id=letting_id,
                    date_text=date_text,
                    letting_date=self._parse_letting_date(date_text),
                    url=f"{self._base_url}{LETTING_DETAIL_PATH}/{letting_id}",
                ))

        # Source 2: Archive dropdown
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
                    lettings.append(LettingInfo(
                        letting_id=letting_id,
                        date_text=date_text,
                        letting_date=self._parse_letting_date(date_text),
                        url=f"{self._base_url}{LETTING_DETAIL_PATH}/{letting_id}",
                    ))

        # Sort by date descending
        lettings.sort(
            key=lambda x: x.letting_date or datetime.min,
            reverse=True,
        )

        logger.info(f"Found {len(lettings)} lettings on WCTB portal")
        return lettings

    # ------------------------------------------------------------------
    # Step 2: Find the "Unit Price Tabulation of Bids" link
    # ------------------------------------------------------------------

    async def find_bid_tab_link(self, letting_id: str) -> str | None:
        """
        Fetch a letting detail page and find the download link for
        "Unit Price Tabulation of Bids".

        Returns the document GUID or None if not found.
        """
        client = await self._get_client()
        url = f"{self._base_url}{LETTING_DETAIL_PATH}/{letting_id}"
        logger.debug(f"Fetching letting detail: {url}")

        resp = await client.get(url)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # Look for links matching "Unit Price Tabulation of Bids" exactly
        # Also capture "Aeronautics Unit Price Tabulation of Bids" as secondary
        doc_ids: list[tuple[str, str]] = []  # (guid, link_text)

        for link in soup.find_all("a", href=True):
            text = link.get_text(strip=True)
            text_lower = text.lower()

            # Must contain "unit price" AND "tabulation" — excludes "As Accepted Tabulation"
            if "unit price" in text_lower and "tabulation" in text_lower:
                href = link["href"]
                match = RE_DOCUMENT_GUID.search(href)
                if match:
                    doc_ids.append((match.group(1).lower(), text))

        if not doc_ids:
            logger.warning(f"No 'Unit Price Tabulation of Bids' found for letting {letting_id}")
            return None

        # Prefer the main "Unit Price Tabulation of Bids" over "Aeronautics" variant
        for guid, text in doc_ids:
            if "aeronautics" not in text.lower():
                return guid

        # Fall back to first match (aeronautics)
        return doc_ids[0][0]

    # ------------------------------------------------------------------
    # Step 3: Download ZIP and extract .txt files
    # ------------------------------------------------------------------

    async def download_and_extract(
        self,
        letting: LettingInfo,
        document_id: str,
    ) -> BidTabDownloadResult:
        """Download the bid tab ZIP and extract/rename .txt files."""
        result = BidTabDownloadResult(
            letting_id=letting.letting_id,
            letting_date=letting.date_text,
            document_id=document_id,
        )

        try:
            client = await self._get_client()
            url = f"{self._base_url}{DOCUMENT_PATH}/{document_id}"
            logger.info(f"Downloading bid tab ZIP: {letting.date_text}")

            resp = await client.get(url)
            resp.raise_for_status()

            content = resp.content
            result.zip_filename = f"bidtabs_{letting.letting_id[:8]}.zip"

            # Check if response is a ZIP
            if not content[:4] == b"PK\x03\x04":
                # Might be a single text file or an error page
                if b"TABULATION" in content[:500].upper():
                    # It's a raw text file, not a zip
                    text = content.decode("utf-8", errors="replace")
                    new_name = rename_bid_tab_file(text)
                    if new_name:
                        self._check_and_write(new_name, text, result)
                    else:
                        # Use a fallback name
                        fallback = f"BIDTAB_{letting.letting_id[:8]}.txt"
                        self._check_and_write(fallback, text, result)
                else:
                    result.error = f"Response is not a ZIP file ({len(content)} bytes)"
                    logger.warning(result.error)
                    return result

            else:
                # Extract ZIP
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    for name in zf.namelist():
                        if not name.lower().endswith(".txt"):
                            continue

                        txt_content = zf.read(name).decode("utf-8", errors="replace")
                        result.txt_files_extracted += 1

                        # Try to rename using content-based naming
                        new_name = rename_bid_tab_file(txt_content)
                        if new_name:
                            result.txt_files_renamed += 1
                        else:
                            # Keep original name from ZIP
                            new_name = name.replace("/", "_")

                        self._check_and_write(new_name, txt_content, result)

            result.success = True
            logger.info(
                f"  Extracted {result.txt_files_extracted} files "
                f"({result.txt_files_renamed} renamed) from {letting.date_text}"
            )

        except Exception as e:
            result.error = str(e)
            logger.error(f"Download failed for {letting.date_text}: {e}")

        return result

    def _check_and_write(self, filename: str, content: str, result: BidTabDownloadResult):
        """Write a text file to the output directory if it doesn't already exist."""
        file_path = self.output_dir / filename

        if self.skip_existing and file_path.exists() and file_path.stat().st_size > 0:
            logger.debug(f"  Skipping (exists): {filename}")
        else:
            file_path.write_text(content, encoding="utf-8")

        result.txt_filenames.append(filename)

    # ------------------------------------------------------------------
    # Main orchestrator
    # ------------------------------------------------------------------

    async def scrape_all_lettings(
        self,
        min_date: datetime | None = None,
    ) -> BidTabScrapeResult:
        """
        Scrape all lettings from the WCTB portal and download bid tab ZIPs.

        Args:
            min_date: Only download lettings on or after this date.
                      Useful for incremental updates (e.g., min_date=datetime(2020, 1, 1)).
        """
        result = BidTabScrapeResult()

        try:
            lettings = await self.get_all_lettings()
            result.lettings_found = len(lettings)

            # Filter by min_date if specified
            if min_date:
                lettings = [
                    l for l in lettings
                    if l.letting_date and l.letting_date >= min_date
                ]
                logger.info(f"Filtered to {len(lettings)} lettings after {min_date.date()}")

            semaphore = asyncio.Semaphore(self.concurrency)

            async def process_letting(letting: LettingInfo) -> BidTabDownloadResult:
                async with semaphore:
                    try:
                        doc_id = await self.find_bid_tab_link(letting.letting_id)
                        if not doc_id:
                            return BidTabDownloadResult(
                                letting_id=letting.letting_id,
                                letting_date=letting.date_text,
                                error="Unit Price Tabulation not found",
                            )

                        await asyncio.sleep(self.delay_seconds)
                        return await self.download_and_extract(letting, doc_id)

                    except Exception as e:
                        return BidTabDownloadResult(
                            letting_id=letting.letting_id,
                            letting_date=letting.date_text,
                            error=str(e),
                        )

            tasks = [process_letting(letting) for letting in lettings]
            downloads = await asyncio.gather(*tasks)

            for dl in downloads:
                result.downloads.append(dl)
                if dl.success:
                    result.lettings_downloaded += 1
                    result.total_txt_files += dl.txt_files_extracted
                elif "not found" in dl.error.lower():
                    result.lettings_skipped += 1
                else:
                    result.lettings_failed += 1
                    result.errors.append(f"{dl.letting_date}: {dl.error}")

        except Exception as e:
            result.errors.append(f"Scraper error: {e}")
            logger.error(f"Scraper error: {e}")
        finally:
            await self.close()

        logger.info(
            f"Scrape complete: {result.lettings_found} lettings found, "
            f"{result.lettings_downloaded} downloaded ({result.total_txt_files} txt files), "
            f"{result.lettings_skipped} skipped, {result.lettings_failed} failed"
        )
        return result

    async def scrape_letting(self, letting_id: str) -> BidTabDownloadResult:
        """Scrape a single letting by its GUID."""
        letting = LettingInfo(
            letting_id=letting_id,
            url=f"{self._base_url}{LETTING_DETAIL_PATH}/{letting_id}",
        )

        document_id = await self.find_bid_tab_link(letting_id)
        if not document_id:
            return BidTabDownloadResult(
                letting_id=letting_id,
                error="Unit Price Tabulation not found",
            )

        return await self.download_and_extract(letting, document_id)

    # ------------------------------------------------------------------
    # GCS upload
    # ------------------------------------------------------------------

    async def upload_to_gcs(
        self,
        bucket_name: str = "il-idot-bidtabs",
    ) -> int:
        """Upload extracted .txt files to GCS. Returns count of files uploaded."""
        from google.cloud import storage

        client = storage.Client()
        bucket = client.bucket(bucket_name)
        uploaded = 0

        for file_path in sorted(self.output_dir.glob("*.txt")):
            blob = bucket.blob(file_path.name)
            if blob.exists():
                continue
            logger.info(f"Uploading: {file_path.name}")
            blob.upload_from_filename(str(file_path))
            uploaded += 1

        logger.info(f"Uploaded {uploaded} files to gs://{bucket_name}/")
        return uploaded

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_letting_date(text: str) -> datetime | None:
        """Parse letting date from link text like 'November 07, 2025'."""
        for fmt in [
            "%B %d, %Y",
            "%B %d, %Y %I:%M %p",
            "%m/%d/%Y",
        ]:
            try:
                return datetime.strptime(text.strip(), fmt)
            except ValueError:
                continue

        date_match = re.search(r"(\w+ \d{1,2},?\s*\d{4})", text)
        if date_match:
            for fmt in ["%B %d, %Y", "%B %d %Y"]:
                try:
                    return datetime.strptime(date_match.group(1), fmt)
                except ValueError:
                    continue

        return None


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

async def main():
    """Run the bid tab scraper from the command line."""
    import argparse

    parser = argparse.ArgumentParser(description="IDOT Bid Tab Scraper (WCTB Portal)")
    parser.add_argument(
        "--output-dir", default="./idot_bidtab_downloads",
        help="Directory to save extracted .txt bid tab files",
    )
    parser.add_argument(
        "--letting-id", default=None,
        help="Scrape a single letting by GUID",
    )
    parser.add_argument(
        "--min-date", default=None,
        help="Only download lettings on or after this date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--upload-gcs", action="store_true",
        help="Upload extracted files to GCS after scraping",
    )
    parser.add_argument(
        "--bucket", default="il-idot-bidtabs",
        help="GCS bucket for upload",
    )
    parser.add_argument(
        "--concurrency", type=int, default=2,
        help="Max concurrent requests (be polite)",
    )
    parser.add_argument(
        "--delay", type=float, default=1.5,
        help="Delay between requests in seconds",
    )
    parser.add_argument(
        "--no-skip", action="store_true",
        help="Re-download even if files exist",
    )
    parser.add_argument(
        "--list-only", action="store_true",
        help="List available lettings without downloading",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    scraper = IDOTBidTabScraper(
        output_dir=args.output_dir,
        skip_existing=not args.no_skip,
        concurrency=args.concurrency,
        delay_seconds=args.delay,
    )

    if args.list_only:
        lettings = await scraper.get_all_lettings()
        print(f"\n{'Date':<30} {'GUID':<40}")
        print("-" * 70)
        for l in lettings:
            print(f"{l.date_text:<30} {l.letting_id}")
        print(f"\nTotal: {len(lettings)} lettings")
        await scraper.close()
        return

    if args.letting_id:
        result = await scraper.scrape_letting(args.letting_id)
        if result.success:
            print(f"Downloaded {result.txt_files_extracted} files from letting {args.letting_id}")
            for f in result.txt_filenames:
                print(f"  {f}")
        else:
            print(f"Failed: {result.error}")
    else:
        min_date = None
        if args.min_date:
            min_date = datetime.strptime(args.min_date, "%Y-%m-%d")

        result = await scraper.scrape_all_lettings(min_date=min_date)

        print(f"\n{'=' * 60}")
        print(f"IDOT Bid Tab Scrape Results")
        print(f"{'=' * 60}")
        print(f"  Lettings found:      {result.lettings_found}")
        print(f"  Lettings downloaded: {result.lettings_downloaded}")
        print(f"  Lettings skipped:    {result.lettings_skipped}")
        print(f"  Lettings failed:     {result.lettings_failed}")
        print(f"  Total .txt files:    {result.total_txt_files}")
        print(f"{'=' * 60}")

        if result.errors:
            print(f"\nErrors ({len(result.errors)}):")
            for err in result.errors[:20]:
                print(f"  - {err}")

    if args.upload_gcs:
        uploaded = await scraper.upload_to_gcs(bucket_name=args.bucket)
        print(f"\nUploaded {uploaded} files to gs://{args.bucket}/")

    await scraper.close()


if __name__ == "__main__":
    asyncio.run(main())
