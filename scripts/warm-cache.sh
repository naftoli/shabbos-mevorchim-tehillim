#!/bin/sh
# Pre-warm the WWTC API's file cache (logs/wwtc-cache) so the first request of a
# new Shabbos-Mevorchim month — or the first after a cache flush — doesn't pay
# the army/per-school rebuild. Optional: under normal traffic the stale-while-
# revalidate cache keeps these warm on its own. Point WWTC_BASE_URL at the API
# root and run from cron, e.g. every 5 minutes:
#
#   */5 * * * * WWTC_BASE_URL=https://mashpia.com/shabbos-mevorchim-tehillim/api /path/to/warm-cache.sh
#
# Warms the nationwide endpoints and every school's dashboard data. Warming
# /schools/:id also warms /reports/base/:id and /schools/:id/not-completed,
# since all three share the same cached wwtcSchoolData($id) per school.

set -eu

BASE="${WWTC_BASE_URL:-https://mashpia.com/shabbos-mevorchim-tehillim/api}"
MAX_TIME="${WWTC_WARM_MAX_TIME:-120}"

warm() {
    # $1 = path. Discard the body; a cold rebuild can take up to MAX_TIME.
    curl -fsS --max-time "$MAX_TIME" -o /dev/null "$BASE/$1" || echo "warm-cache: $1 failed" >&2
}

# Single-instance guard: if a long cold warm is still running when cron fires
# again, this run exits rather than piling on. (flock is best-effort — skipped
# if unavailable.)
LOCK="${TMPDIR:-/tmp}/wwtc-warm-cache.lock"
if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -n 9 || { echo "warm-cache: another run holds the lock; exiting" >&2; exit 0; }
fi

# Nationwide / home endpoints.
for ep in stats schools running-totals perfect-platoons; do
    warm "$ep"
done

# Every school's dashboard data (getSchool / getBaseReport / notCompleted all
# read the same per-school cache). Pull the id list from the /schools response.
ids=$(curl -fsS --max-time "$MAX_TIME" "$BASE/schools" \
        | tr ',' '\n' \
        | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p') || ids=""

for id in $ids; do
    warm "schools/$id"
done
