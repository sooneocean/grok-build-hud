# Privacy

**grok-build-hud does not include telemetry, analytics, or crash-reporting SDKs.**

## What stays local

| Data | Location | Leaves machine? |
|------|----------|-----------------|
| Session context / tools | `~/.grok/sessions/**` | No (read only by HUD) |
| HUD config / status files | `~/.grok/hud/**` | No |
| Usage sidecar | `~/.grok/hud/usage-sidecar.json` | No |
| Speed cache | `~/.grok/hud/speed-cache/**` | No |

## Network

The only intentional network use is **optional quota/billing** via xAI endpoints, using **your existing Grok login** (`grok login` credentials). This is the same class of call Grok’s own `/usage` style flows make.

- Disable with `grok-build-hud --no-usage` or config that turns usage off.
- No third-party analytics endpoints are contacted.

## Not collected

- No anonymous usage pings  
- No source code upload by this project  
- No phone-home of HUD layouts or settings  

Identity: **third-party / community** tool — not xAI official.
