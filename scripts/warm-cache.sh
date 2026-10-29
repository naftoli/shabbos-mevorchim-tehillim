#!/bin/sh
# Pre-warm the WWTC API's file cache (logs/wwtc-cache) so the first request of a
# new Shabbos-Mevorchim month — or the first after a cache flush — doesn't pay
# the ~60s army rebuild. Optional: under normal traffic the stale-while-
# revalidate cache keeps these warm on its own. Point WWTC_BASE_URL at the API
# root and run from cron, e.g. every 5 minutes.
#
#   */5 * * * * WWTC_BASE_URL=https://mashpia.com/shabbos-mevorchim-tehillim/api /path/to/warm-cache.sh

set -eu

BASE="${WWTC_BASE_URL:-https://mashpia.com/shabbos-mevorchim-tehillim/api}"

for ep in stats schools running-totals perfect-platoons; do
    # --max-time generously above a cold rebuild; discard the body.
    curl -fsS --max-time 120 -o /dev/null "$BASE/$ep" || echo "warm-cache: $ep failed" >&2
done
