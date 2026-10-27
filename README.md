# spinal-organ-bacnet

BACnet connector for the SpinalCom ecosystem (BOS). This organ provides:

-   BACnet device discovery,
-   property and value reading,
-   supervision and monitoring,
-   control through BACnet-related services.

This project relies on the local BACnet library [lib/bacstack](lib/bacstack/README.md).

## Prerequisites

-   Node.js 18+ recommended
-   npm
-   access to a SpinalCom Hub
-   BACnet-compatible viewer plugin (e.g. `spinal-env-viewer-plugin-bacnet-manager`)

## Installation

```bash
npm install
```

## Configuration

Configuration is done through environment variables (not via `config.json5` in the current codebase).

Required variables:

-   `ORGAN_NAME`: organ name
-   `USER_ID`: Hub user ID
-   `PASSWORD`: Hub password
-   `PROTOCOL`: Hub connection protocol (`http` or `https`)
-   `HOST`: Hub address
-   `PORT`: Hub port
-   `ORGAN_FOLDER_PATH`: path to the organ folder in the graph

Optional variables:

-   `LAUNCH_OWN_BACNET_SERVICE`: `1`/`true` to launch a local BACnet service
-   `BACNET_SERVICE_PORT`: BACnet service port (default: `47810`)
-   `CLEAR_ORGAN_IF_NOT_COMPATIBLE`: `1`/`true` to reset the organ when data is incompatible
-   `ADD_INDICATORS`: `1`/`true` to enable communication indicator controlpoints and history (disabled by default)

Example:

```bash
export ORGAN_NAME="spinal-organ-bacnet"
export USER_ID="my_user"
export PASSWORD="my_password"
export PROTOCOL="https"
export HOST="my-spinal-hub.domain.tld"
export PORT="443"
export ORGAN_FOLDER_PATH="/organs"

export LAUNCH_OWN_BACNET_SERVICE="true"
export BACNET_SERVICE_PORT="47810"
```

## Scripts

-   `npm run build`: compile TypeScript to `dist/`
-   `npm run start`: build then start the organ (`node dist/index.js`)
-   `npm run pm2`: build then start with PM2 using [ecosystem.config.js](ecosystem.config.js)

## Run

### Local start

```bash
npm run start
```

### Start with PM2

```bash
npm run pm2
```

## Main structure

-   [src/index.ts](src/index.ts): entry point, Hub connection, service initialization
-   [src/config.ts](src/config.ts): environment variable validation and loading
-   [src/modules/](src/modules/): business logic (discover, devices, monitoring, COV, pilot)
-   [src/utilities/](src/utilities/): BACnet/Spinal utility functions
-   [lib/bacstack/](lib/bacstack/): embedded BACnet implementation

## Data organization (simplified view)

-   Graph
-   Network
-   NetworkVirtual
-   Device
-   GroupEndpoint / Endpoint

## Notes

### Device communication indicators

When `ADD_INDICATORS` is enabled, each `SpinalDevice` exposes a read-only snapshot through
`device.indicators.fetchCurrentIndicators()` or
`device.getCommunicationIndicators()`. The organ projects the indicators into
the device graph under a dedicated `hasControlPoints` relation. The profile
group and endpoints are created once and updated in place; ordinary BACnet
endpoint groups and values are not changed.

The graph exposes only the communication status, last successful response
date, response time p50, success and failure rates, and successful and failed
point counts. These metrics describe the latest read cycle: rates and counts
use that cycle's requested BACnet points as their denominator, and response
time is the median latency of its successful points. Counts and rates are
replaced on every request (zero successes on a complete request failure).
Status is `stopped` when supervision is disabled, `unknown` before the first
read cycle, `online` after a complete read cycle, `degraded` after a partial or
failed cycle, and `offline` after three consecutive failed cycles.

With `ADD_INDICATORS` enabled, at each read cycle all available controlpoint values are inserted into their
TimeSeries with the same timestamp. The last response date is stored as a Unix
timestamp in milliseconds. Status history uses numeric values: `0` stopped,
`1` unknown, `2` online, `3` degraded, and `4` offline. COV notifications
refresh the current values without adding duplicate time-series samples.

While indicators are enabled, the organ logs a metrics snapshot immediately
and then every 60 seconds; it logs one final snapshot when monitoring stops.
The BACnet service must expose `_getChildrenNewValueWithMetrics` for retry,
timeout, and error-category telemetry. With indicators disabled, the organ
uses the regular BACnet read method and does not create or update indicator
controlpoints or their TimeSeries.

COV active counts are based on successful subscription acknowledgements, and
failed renewals are counted when the service retries subscriptions after a
client reset. Subscriptions currently use an indefinite lifetime and the
service has no expiry notification, so `cov.expirations` is `null` and
`cov.expirationTrackingAvailable` is `false`.

-   The [index.js](index.js) file loads compiled artifacts from `dist/`.
-   If you modify TypeScript code in `src/`, run at least `npm run build` again.
