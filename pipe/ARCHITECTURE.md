# @minderal/pipe — architecture

Secure pipes between a browser tab that holds a local copy of the data and any other
authenticated device. The browser is the **host** (it answers requests); the other side is
the **client**. Neither can hear inbound connections, so a cloud module brokers the
meeting — without ever being trusted with the contents.

## The one bet everything else rests on

**Confidentiality is decoupled from transport.** Every pipe is an end-to-end encrypted
session (Noise) established between two *device keys*, negotiated over whatever byte mover
is available. The cloud relay, a WebRTC data channel, a LAN socket and a test loopback are
interchangeable: swapping one for another changes latency and cost, never the security
properties.

That bet buys three things: the cloud stays dumb (and therefore cheap, stateless and
untrusted), WebRTC becomes an optimization rather than a prerequisite, and the whole stack
is testable over an in-process loopback with no network at all.

## Vocabulary

| Term | Meaning |
|---|---|
| **Account** | The human. Owns a root keypair. |
| **Device** | One browser profile, phone or CLI. Owns a device keypair. |
| **Host** | A device serving its local database over pipes. Usually a browser tab. |
| **Client** | A device opening a pipe to a host. |
| **Node address** | `<accountId>.<deviceId>`, where `deviceId = base32(sha256(devicePublicKey))[:26]`. Self-certifying: the address *is* the key fingerprint, so the cloud can misroute but cannot impersonate. |
| **Grant** | A signed statement that a device belongs to an account, with scopes. |
| **Roster** | The account's current set of grants, versioned and root-signed. |

## Layers

```
        host browser tab                                  client (browser / CLI / phone)
┌────────────────────────────────┐                  ┌────────────────────────────────┐
│ PouchDB (IndexedDB replica)    │                  │ @minderal/core Database        │
├────────────────────────────────┤                  ├────────────────────────────────┤
│ CouchHandler                   │  HTTP semantics  │ PipeConnection (custom fetch)  │  ← service
│  serves the replication API    │ ◄──────────────► │                                │
├────────────────────────────────┤                  ├────────────────────────────────┤
│ Mux — logical streams, backpressure                                                │  ← streams
├────────────────────────────────────────────────────────────────────────────────────┤
│ Session — Noise_IK handshake, AEAD frames, rekey, identity binding                  │  ← crypto
├────────────────────────────────────────────────────────────────────────────────────┤
│ Transport — RelayTransport │ WebRtcTransport │ LoopbackTransport                    │  ← bytes
└────────────────────────────────────────────────────────────────────────────────────┘
                    │                                          │
                    └──────────────► cloud ◄───────────────────┘
                         auth · directory · signaling · relay · TURN
```

Each layer sees the one below as a duplex stream of frames and nothing more. `Transport`
is an interface with `send(bytes)`, an async iterator of inbound bytes, and `close()`.
Everything above it is transport-agnostic by construction.

## Trust model

The cloud is **honest-but-curious at best, hostile at worst**. Design to that.

| The cloud can | The cloud cannot |
|---|---|
| See who is online, and when | Read or alter pipe contents |
| See who talks to whom, how much, how often | Impersonate a device (addresses are key fingerprints) |
| Refuse service, drop or stall a pipe | Inject a device into an account (grants are root-signed) |
| Withhold a roster update (rollback) | Forge a grant, or revive a revoked one past its TTL |
| Learn IP addresses (relay and TURN) | Recover data at rest — it stores ciphertext only |

Metadata exposure is the honest cost of a hosted rendezvous. If that matters later, the
answer is a LAN transport plus an optional self-hosted cloud, not more crypto.

## Identity and pairing

**Root key.** Created on the first device. The private key is wrapped with a key derived
from the account password (Argon2id, high memory cost) and escrowed in the cloud as an
opaque blob, so device #2 can be added from anywhere. The cloud sees the blob, never the
password. A user who refuses escrow keeps a recovery phrase instead and loses the
add-from-anywhere path.

**Device grant.** A new device generates its keypair locally (non-extractable where the
platform allows), then asks an already-trusted device to sign:

```
Grant {
  accountId, deviceId, devicePublicKey,
  scopes: ["db:read", "db:write", "db:*"] | ["db:read:neurons"],
  notBefore, expiresAt,     // months, not years — expiry is the cheap half of revocation
  rosterVersion             // monotonic; peers refuse anything below the highest seen
}  signed by the root key
```

Pairing is confirmed out of band: the new device displays a 6-word SAS derived from
`hash(bothPublicKeys)`, the existing device shows the same words, the human compares them.
A QR code carries the same material for the phone case. This is what stops a cloud that
lies about which key belongs to which device.

**Revocation.** Publish a new roster with the grant removed and `rosterVersion + 1`. Peers
cache the highest version they have seen and refuse older ones, so the cloud can stall a
revocation but not reverse one; short `expiresAt` bounds the stall. A host also checks the
roster on every handshake and tears down live pipes whose peer just lost its grant.

## The cloud module

Four endpoints and one socket. Deliberately small — everything here is replaceable and
none of it is trusted.

```
POST /v1/session          account login → short-lived cloud token (routing only, not authorization)
GET  /v1/roster/:account  fetch the signed roster blob        (verified by the client, not the server)
PUT  /v1/roster/:account  store a root-signed roster          (rejected unless the signature verifies)
GET  /v1/turn             ephemeral TURN credentials
WS   /v1/link             presence · directory · signaling · relay
```

Socket messages, all client-initiated except `peer` and `frame`:

| Message | Direction | Purpose |
|---|---|---|
| `announce {deviceId, capabilities, ttl}` | → | "I am a host, I am online" — refreshed by heartbeat |
| `watch {accountId}` | → | Subscribe to presence for an account you are in |
| `peer {deviceId, state}` | ← | Presence change |
| `open {to, sealedHandshake}` | → | Start a pipe; payload is the opaque Noise message 1 |
| `frame {pipeId, bytes}` | ↔ | Relay. Ciphertext in, ciphertext out |
| `close {pipeId, reason}` | ↔ | Teardown |

The cloud enforces membership (both parties in the same account, per its copy of the
roster) purely as spam control. **The host re-verifies from the signed roster itself** —
cloud membership is a hint, never the authorization decision.

Presence TTL is short (~30 s, heartbeat every 10 s) because a browser host disappears the
instant a tab closes. Stale presence is worse than no presence: it turns a dead host into a
30-second timeout on the client.

## The pipe

**Handshake — Noise_IK_25519_ChaChaPoly_SHA256.** IK because the initiator already knows
the responder's static key (it is the address), which gets the session up in one round trip
and encrypts the initiator's identity to the responder. Bound into the prologue:
`accountId`, both device ids, protocol version, and — when running over WebRTC — the local
and remote DTLS fingerprints, so a cloud that swaps SDP fingerprints breaks the handshake
instead of silently becoming a man in the middle.

After the handshake each side checks the other's grant against the roster and closes on a
mismatch, an expired grant, or a roster version below what it has seen.

**Frames.** `varint length · AEAD ciphertext`, nonce = per-direction counter, rekey every
2^20 frames or 15 minutes. Replay dies on the counter; reordering is the transport's
problem (both real transports are ordered and reliable).

**Mux.** One pipe carries many logical streams — a stripped-down yamux:
`varint streamId · flags(SYN|FIN|RST|DATA|WINDOW) · varint length · payload`, with a
per-stream credit window so one large attachment cannot starve a `_changes` feed. Own
implementation rather than one data channel per stream, because the relay transport has no
notion of channels and the layer above must not care which transport it got.

## Transports

**`RelayTransport` first.** WebSocket to the cloud, frames forwarded blindly. Always works
— no NAT traversal, no ICE, no platform gaps — and because the payload is already E2E
encrypted, shipping it first costs nothing in security. It is the fallback forever.

**`WebRtcTransport` as an upgrade.** Signaling rides the same socket; SDP and ICE
candidates travel as sealed payloads inside an already-established relay pipe, so
candidate IPs are not handed to the cloud in the clear. On success the session migrates to
the data channel and the relay pipe closes; on failure it simply stays on the relay. The
migration is a transport swap under a live Noise session, not a new handshake.

**`LoopbackTransport`** wires two sessions together in one process. Every layer above the
transport gets unit-tested with no network, no Docker and no browser.

## What flows through it: replication, not a bespoke RPC

The host's job is to answer for a PouchDB database, and there is already a protocol for
that — CouchDB's. So the service layer speaks HTTP semantics over the pipe rather than
inventing a data API:

- **Host side — `CouchHandler`.** Implements the replication surface against its local
  PouchDB: `GET /db`, `GET /db/_changes`, `POST /db/_revs_diff`, `POST /db/_bulk_docs`,
  `POST /db/_bulk_get`, `GET /db/_all_docs`, `POST /db/_find`, `GET /db/{doc}`,
  `GET|PUT /db/_local/{id}`. That is the whole list; it is far less than "be CouchDB".
- **Client side — `PipeConnection`.** A `Connection` subclass whose `createDatabase` opens
  `Database.open(name, user, { fetch: pipeFetch })`. Core already threads a custom `fetch`
  through `RemoteConnection`, so the pipe slots into an existing seam with no change to
  `Database`.

The payoff: `PouchDB.sync()` works unmodified across the pipe, conflict handling and
checkpointing come for free, and a client that pulls once keeps its own replica — so a
host that goes offline degrades to stale data rather than to nothing. Live requests and
replication share the same mux, one stream each.

**Authorization is the host's, per stream.** Scopes from the peer's grant are enforced in
`CouchHandler` — a `db:read` peer gets `405` on `_bulk_docs`, a database not in its
allowlist gets `404`. The cloud is not consulted and could not be trusted to answer.

## Browser-as-server realities

These are the constraints that actually decide whether this works, so they belong in the
architecture rather than in a comment later:

- **A tab-backed host exists only while the tab is open.** No amount of engineering fixes
  this. Presence must be truthful and fast to expire, and clients need a sensible "host
  offline" story — which, thanks to replication, is "you still have your copy".
- **One host per browser profile, not per tab.** Elect it with `navigator.locks.request`
  on a lock named for the account; the holder is the host, the rest proxy through
  `BroadcastChannel`. Two tabs both announcing the same `deviceId` would otherwise fight
  over presence and duplicate every pipe.
- **Background tabs get throttled**, timers to ~1/minute. Heartbeats must ride on the
  WebSocket (not `setInterval`), and a throttled host should demote itself rather than
  advertise availability it cannot deliver.
- **A Service Worker does not save you** — no WebRTC, and no guarantee of being alive. It
  is useful for waking a tab via Web Push and for caching, not for hosting.
- **iOS Safari** evicts IndexedDB under storage pressure and suspends aggressively. Treat
  a phone as a client; make it a host only behind an explicit opt-in.
- **Crypto.** `@noble/curves` + `@noble/ciphers` rather than WebCrypto: identical in Node
  and every browser, no Ed25519-availability caveats, and usable in the tests. The Noise
  IK state machine is ~200 lines over those primitives and is pinned against the official
  Noise test vectors. If hand-rolling a handshake is judged too much risk,
  `@chainsafe/libp2p-noise` is the drop-in alternative — it is the same construction.

## Abuse and failure

| Risk | Answer |
|---|---|
| Relay used as free bandwidth | Per-account byte quota, per-pipe rate limit, WebRTC upgrade preferred |
| Handshake flood at a host | Cloud caps pending `open`s per account; host drops unknown `deviceId`s before any crypto |
| Roster rollback by the cloud | Monotonic `rosterVersion` + short grant expiry |
| Stolen device key | Revoke the grant; live pipes torn down at the next roster check |
| Cloud MITM on WebRTC | DTLS fingerprints bound into the Noise prologue |
| Host vanishes mid-replication | Checkpoints are PouchDB's; resume on reconnect |

## Layout

```
pipe/
  src/                     isomorphic library — same rules as core/: one class per file,
                           no comments, named exports, strict TS, async/await
    identity/  DeviceKey · RootKey · Grant · Roster · Sas
    session/   NoiseSession · Frame · Rekey
    transport/ Transport (abstract) · RelayTransport · WebRtcTransport · LoopbackTransport
    mux/       Mux · MuxStream · CreditWindow
    service/   CouchHandler · PipeFetch · PipeConnection
    cloud/     CloudClient   (the browser/CLI side of the socket)
    index.ts
  cloud/                   the service itself — Node, stateless, Redis for presence only
  tests/
    integration/           two real processes over the real cloud
```

`@minderal/core` gains one export, `PipeConnection`, and changes nothing else.

## Phases

1. **Loopback.** Identity, grants, roster, Noise session, mux — all tested in-process.
   No network. This is where the security work happens.
2. **Cloud + relay.** The socket, presence, `RelayTransport`. Two browsers talk.
3. **Service.** `CouchHandler` + `PipeConnection`; `PouchDB.sync()` over a pipe.
4. **WebRTC.** `WebRtcTransport` and live migration off the relay.
5. **Hardening.** Quotas, revocation propagation, host election, background-tab demotion.

Phases 1–3 are a working product: a browser hosting its database for another device, E2E
encrypted, with the cloud unable to read any of it. Phase 4 is a cost and latency
optimization, which is exactly the standing it should have.

## Open decisions

- **Escrowed root key vs. recovery phrase only.** Escrow is the difference between a
  product and a demo, but it puts a password-derived blob in the cloud.
- **Does a client ever host?** If a CLI can host too, "host" and "client" collapse into one
  role and the protocol is symmetric. Cheaper to decide now than later.
- **Cross-account pipes.** Sharing with *another person* needs grants that are not
  root-signed by your own account — a different trust edge, and probably a v2 concern.
- **Attachments.** Large binaries over a credit-windowed mux want their own stream and
  possibly their own transport policy.
