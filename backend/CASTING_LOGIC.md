
# Casting Logic: The "Room" Model

The goal is to allow a User (Controller) to project the match to a TV (Spectator) without logging in on the TV.

## The Workflow

1. **Host (Mobile)**:
    * User clicks "Cast" or "Start Match".
    * App calls `POST /api/match`.
    * Server creates a match with ID `MATCH_ID` (e.g., `SUMO-XYZ`).
    * Server returns `ws_url` and a `watch_url` (e.g. `app.com/watch/SUMO-XYZ`).
    * Mobile App displays:
        * The standard Controller UI.
        * A "Connect to Screen" button showing the `MATCH_ID`.
        * A QR Code encoding the `watch_url`.

2. **Spectator (TV/Browser)**:
    * User opens `app.com/watch` (or scans QR).
    * If entering manually, User types matching code: `SUMO-XYZ`.
    * TV App connects to `wss://api.app.com/ws/SUMO-XYZ`.
    * **Crucial**: The Spectator client is *read-only*. It receives the state but sends no inputs.

3. **Synchronization**:
    * Both Mobile and TV are connected to the same WebSocket Channel.
    * **Mobile**: Sends `{"action": "PUSH"}` messages.
    * **Server**: Updates physics, Broadcasts `{"p1": {x,y}, "p2": {x,y}}`.
    * **Mobile**: Updates local UI (Health bars, stamina).
    * **TV**: Updates high-fidelity canvas (Sprites, Animations).

## Implementation Details

* **Latency**: Cloud Run WebSockets are generally fast (<100ms).
* **State Authority**: The Server is the source of truth. If the TV lags, it snaps to the latest server state (interpolation can smooth this).
* **Security**: The `MATCH_ID` is a temporary capability token. Anyone with the ID can watch.
