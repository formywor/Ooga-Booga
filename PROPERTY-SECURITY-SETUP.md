# Private property camera prototype

New pages: `/property-security` (PC dashboard) and `/camerainput` (phone).
No ScriptNovaa account required. Existing pages and account routes are unchanged.

## Setup
1. Generate a random key with at least 32 characters. Set `PROPERTY_SECURITY_SECRET` in the existing Vercel API project's environment. Do not put the key in website files or GitHub. Changing it revokes every camera pairing.
2. Publish the updated API folder first, then the website folder, using your existing hosting. If you use the included Cloudflare security-header Worker, publish its updated `deployment/cloudflare-security-worker.js` too: it permits the camera only on `/camerainput` and model loading only on the dashboard. A separately configured Cloudflare header rule must provide equivalent page-specific exceptions. This change has not been deployed.
3. Open `https://scriptnovaa.com/property-security` in Chrome or Edge on your PC. Enter your key and connect. Initial model loading requires internet. Connect your speaker to the PC audio output, select it in Windows audio settings and press Test PC speaker.
4. Add a camera and choose its location. Use Pair phone, then open the generated link in Safari on your iPhone. Press Start camera and grant camera permission. No microphone permission is requested.
5. Press Connect / reconnect for that camera on the PC. Repeat for additional cameras. Camera names, locations and zones are stored on this PC/browser; the key stays only in page memory.
6. Set the zone percentages and response for each camera. Garage defaults to warning/alarm. Other locations default to record only. Zone membership uses the detected person's bottom-center point. A person must persist for about one second before the warning. The default warning grace is 5 seconds, followed by the requested 3-second countdown. Test at comfortable speaker volume, then arm.

## Cellular / different networks
Configure a TURN service in Vercel: `PROPERTY_TURN_URL` (comma-separated TURN/TURNS URLs), `PROPERTY_TURN_USERNAME`, `PROPERTY_TURN_PASSWORD`. This API handles only signaling, not media relay. A provider or self-hosted TURN server supplies the relay. Credentials are shared with paired cameras; use a dedicated, quota-limited service credential. Reissue phone pairing links after changing TURN settings. Without TURN, cellular connectivity is not guaranteed. Network changes may require pressing Connect / reconnect again.

## Clips without Firebase Storage
Clips use Firebase **Realtime Database**, like the existing encoded profile images; Firebase Storage is not used. Clips are encoded video values uploaded through the API, limited to 1 MB each, latest 20 clips, seven-day access retention. Listing or uploading clips removes expired records. Expired records can remain physically stored until the next list/upload; this is not scheduled deletion. Clip metadata lists omit video data. The API stores only this feature's dedicated nodes: `propertySecuritySignals` and `propertySecurityClips`.

Event recordings start at confirmed detection and last up to 8 seconds. There is no pre-event buffer. Record test clip lets you verify storage/playback before arming. Clips use 320 kbps target video, no microphone audio; encoding overhead or browser behavior may exceed the cap, in which case a visible error is logged. This storage method is intentionally for a small prototype, not continuous recording. Video database reads/writes may consume existing Firebase quotas and increase the work of the existing API's root-level database transactions. Download important clips. Recordings do not upload without the PC dashboard open.

## Camera compatibility and operational limits
Supports iPhones, Android phones and webcams accessible through a modern HTTPS browser. Native RTSP/ONVIF cameras are not directly browser-readable; add a WebRTC bridge when choosing those devices. A single camera has one dashboard receiver. Twelve configured slots are allowed, but practical simultaneous capacity depends on the PC and needs testing; detection runs sequentially in the dashboard. The camera selector filters the view, while every connected camera is still checked.

The PC must stay awake with the dashboard visible. Hiding the dashboard disarms it. Locking the phone or backgrounding Safari can stop capture despite the optional wake lock. Fresh-video checks cancel active warnings and sirens after loss of video. A lost camera does not automatically restart or rearm. There are no phone notifications or hardware relay controls. The siren is PC audio, capped at 15 seconds per incident with cooldown. Silence & disarm cancels all audio immediately. Model downloads use pinned TensorFlow.js and COCO-SSD libraries; inference runs on the PC. This is a prototype, not an unattended production security installation.

Camera capability links expire after 30 days and allow only that slot's signaling, not reading clips or controlling the dashboard. Keep the control key and pairing links private. The unlisted pages themselves grant no control or video access.

## Validation
Run `npm run check` inside `outputs/api`. Live testing still required: real iPhone permissions/video, PC speaker playback, person departure cancellation, lost-video cancellation, actual clip playback, and TURN connectivity over cellular. These cannot be certified by unit tests alone.
