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

-   The [index.js](index.js) file loads compiled artifacts from `dist/`.
-   If you modify TypeScript code in `src/`, run at least `npm run build` again.
