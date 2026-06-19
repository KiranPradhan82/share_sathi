# Share Sathi — Auto-Generated Facebook Reels: Feasibility Report

## Executive Summary

**Feasibility: PARTIALLY FEASIBLE with a HYBRID approach.** Generating video programmatically and posting it as a Reel is viable, but attaching trending music programmatically is **not reliably supported by Facebook's API**. The recommended path is: **client-side video generation → server-side upload as a silent Reel → user adds music via Facebook's native audio picker**, OR post with pre-licensed royalty-free audio embedded.

---

## A. Video Generation in Serverless (Vercel)

### A1. Vercel Serverless Limits (Current Config Analysis)

Your existing `src/app/api/posts/reel/route.ts` already sets `maxDuration = 300` (5 minutes). Here are the relevant Vercel limits:

| Constraint | Hobby | Pro | Enterprise |
|---|---|---|---|
| **Max execution time** | 10s | 60s (default), up to 300s with `maxDuration` | Up to 900s |
| **Memory** | 1024 MB | 1024 MB | 3008 MB |
| **Function body size** | 4.5 MB (zipped) | 4.5 MB (zipped) | 250 MB |
| **Request body** | 4.5 MB | 4.5 MB | 4.5 MB |
| **Response body** | 4.5 MB | 4.5 MB | 4.5 MB |

**Key insight:** You're already at 300s maxDuration (Pro plan). This is borderline sufficient for video generation but leaves NO headroom for the Facebook upload. You'd need to split generation and upload into separate functions.

### A2. ffmpeg on Vercel — ❌ NOT PRACTICAL

| Approach | Verdict | Details |
|---|---|---|
| **ffmpeg-static** (native binary) | ❌ Broken | Vercel's serverless runtime runs Amazon Linux 2 (glibc-based). `ffmpeg-static` ships a musl-libc binary. It crashes with `version 'GLIBC_2.29' not found`. Workarounds exist but are fragile. |
| **@ffmpeg/ffmpeg** (WASM) | ⚠️ Possible but painful | The WASM binary is ~25MB. Exceeds Vercel's 4.5MB function body limit. You'd need to fetch it from external storage at runtime. Execution is ~5-10x slower than native. At 1080×1920, encoding 15-30s of video could take 2-4 minutes of CPU time. Memory-heavy (WASM heap). |
| **fluent-ffmpeg** (wrapper) | ❌ Same problem | Requires a native ffmpeg binary; all the above issues apply. |

**Verdict:** ffmpeg on Vercel serverless is a constant maintenance burden. Not recommended.

### A3. JS-Only Video Encoders — ✅ THE WINNING PATH

#### `mp4-muxer` + `webm-muxer` (by Vani)
- **Repository:** `niclas/vanilla/mp4-muxer` and `niclas/vanilla/webm-muxer`
- **Size:** ~15KB each (tree-shakeable)
- **How it works:** These are **container muxers only** — they take encoded video/audio chunks (ArrayBuffer) and mux them into MP4 or WebM containers. They do NOT encode pixels.
- **Server-side (Node.js):** Works perfectly. You feed it raw H.264 Annex-B or AVCC NAL units, and it produces a valid MP4.
- **Audio:** Supports AAC audio muxing.

#### `@aspect-build/codec` / `openh264-wasm` — ✅ For encoding pixels to H.264
- **openh264-wasm:** WebAssembly port of OpenH264. ~2MB binary. Produces H.264 bitstream. Can be bundled or fetched at runtime.
- **Combination:** Satori → Canvas → pixel data → openh264-wasm → H.264 NAL units → mp4-muxer → MP4 file.

#### `webcodecs` (Node.js polyfill)
- The WebCodecs API (VideoEncoder, AudioEncoder) is available in:
  - Chrome/Edge browsers (native)
  - Node.js ≥ 20 (via `globalThis.VideoEncoder` behind `--experimental-webcodecs` flag — **not available on Vercel by default**)
  - Deno/Bun (partial support)
- **Vercel Node.js runtime does NOT expose WebCodecs.** You'd need Bun runtime or Edge runtime.

### A4. Canvas-Based Animation → Video Pipeline

**Server-side (Node.js on Vercel):**
```
Satori (JSX → SVG)
  → resvg-js (SVG → PNG buffer)  [already in your stack!]
    → node-canvas (PNG → pixel RGBA data)
      → openh264-wasm (pixels → H.264 NALs)
        → mp4-muxer (NALs → MP4 buffer)
```

**Problems:**
1. You already use `resvg-js` for SVG→PNG, but to get raw pixel data you'd also need `@napi-rs/canvas` (~8MB native addon) or re-render SVGs via `resvg` to get RGBA pixels.
2. `@napi-rs/canvas` may work on Vercel's Amazon Linux 2 runtime (unlike ffmpeg) since it has proper platform-specific binaries.
3. Memory concern: A single 1080×1920 frame = 1080 × 1920 × 4 bytes = ~8.3MB RGBA. You can't hold many frames in memory.

**Client-side (Browser) — MUCH BETTER:**
```
Canvas API (2D context)
  → ctx.drawImage() per frame
    → MediaRecorder API → WebM (VP9/VP8)
    OR
    → canvas.captureStream() → MediaRecorder → WebM blob
    OR
    → OffscreenCanvas → VideoEncoder (WebCodecs) → H.264 chunks → mp4-muxer → MP4 blob
```

The browser approach is **dramatically simpler** because:
- Canvas API is native and fast
- `MediaRecorder` handles encoding automatically
- `captureStream()` + `MediaRecorder` can produce WebM in ~20 lines of code
- No WASM, no native binaries, no size limits
- Works on Chrome, Edge, Firefox, Safari (with caveats)

### A5. Estimated File Sizes (15s, 1080×1920)

| Codec | Resolution | FPS | Bitrate | Audio | Est. Size |
|---|---|---|---|---|---|
| H.264 (open264) | 1080×1920 | 24 | 800kbps video | — | **~1.5 MB** |
| H.264 (open264) | 1080×1920 | 24 | 800kbps video | AAC 64kbps mono | **~2.7 MB** |
| VP9 (browser WebM) | 1080×1920 | 30 | 1Mbps video | Opus 64kbps | **~2.0 MB** |
| VP8 (browser WebM) | 1080×1920 | 30 | 1Mbps video | Opus 64kbps | **~2.3 MB** |
| H.264 (open264) | 720×1280 | 24 | 500kbps | AAC 48kbps | **~1.2 MB** |

**Verdict:** A 15-20 second reel with simple image transitions at 1080×1920 can absolutely fit under 4MB. Even with audio, 2-3MB is achievable.

---

## B. Music / Audio Sourcing

### B1. Facebook Audio Library API — ⚠️ LIMITED

- **`GET /{page-id}/music`** — Lists music available for the page. Returns music that has been uploaded to the page or is available in Facebook's music library. Requires `pages_read_engagement` permission.
- **`GET /{audio-id}`** — Get metadata for a specific audio clip.
- **`GET /me/music`** — Available trending/liked music for the user.
- **Problem:** Facebook's trending music library for Reels is NOT directly queryable via a "get trending audio" endpoint. The Reels audio picker in the app uses a proprietary, undocumented API.
- **`GET /{ig-user-id}/music`** (Instagram Graph API) — Returns Instagram's music library. Requires Instagram Business/Creator account + `instagram_basic` permission. This is the closest thing to a "trending audio" API, but results are paginated and not sorted by "trending."

### B2. Free Music Libraries with API Access

| Service | API | Nepali Music? | License | Notes |
|---|---|---|---|---|
| **Pixabay Music** | ✅ REST API (free) | Limited | Pixabay License (free for commercial use) | Good quality, search by keyword "nepali" returns some results |
| **Free Music Archive** | ✅ REST API (free) | Very limited | Varies per track | API has rate limits |
| **YouTube Audio Library** | ❌ No API | N/A | YouTube TOS | Only accessible via YouTube Studio UI |
| **Mixkit** | ❌ No public API | N/A | Mixkit License | Download only via website |
| **Epidemic Sound** | ✅ API (paid) | No | Commercial license | $15+/month |
| **Artlist** | ❌ No API | N/A | Subscription | Download only |

### B3. Nepali Music Specific Sources — ❌ NO GOOD API OPTIONS

- **Sarangi** (streaming app) — No public API
- **Gaana** — No API
- **IME Nepal** — No API
- **TikTok trending Nepali audio** — No reliable API
- **YouTube search "trending Nepali music"** — Would require scraping (TOS violation risk)

### B4. Legal Considerations

- **Using copyrighted Nepali music in Facebook Reels without a license = copyright violation.** Facebook's Content ID system WILL detect it, mute the audio, or remove the reel.
- **Facebook's music licensing agreements** cover music played through their native audio picker in the app. They have deals with major labels (Sony, Universal, Warner) and regional distributors.
- **Programmatically adding copyrighted music to a Reel bypass** is NOT covered by Facebook's licensing. The API terms of service explicitly state that content must not infringe third-party rights.
- **Safe options:** (1) Facebook's native audio picker (user selects), (2) royalty-free music from Pixabay/FMA, (3) original/licensed music.

### B5. Alternative: Let User Pick via Facebook's Native UI — ⚠️ NOT POSSIBLE

- **Facebook does NOT provide an API for their Reels audio picker.** The audio library browser is a native app feature.
- **You cannot pass a `music_id` or `audio_id` parameter** in the Reels upload API to attach a licensed track.
- The `video_reels` upload endpoint (start/transfer/finish) does NOT accept music-related parameters in any of its phases.
- **Workaround:** Post the Reel without music (or with royalty-free music). Facebook users can use the "Add Sound" feature on the posted Reel (if available for Page posts).

---

## C. Facebook Reels + Music Integration

### C1. The 3-Phase Reel Upload (Your Existing Code)

Your `src/lib/facebook-reel.ts` correctly implements:
1. **Start:** `POST /{page-id}/video_reels?upload_phase=start` → gets `upload_session_id` + `video_id`
2. **Transfer:** `POST https://rupload.facebook.com/video-upload/v21.0/{upload_session_id}` → uploads bytes
3. **Finish:** `POST /{page-id}/video_reels?upload_phase=finish&...` → publishes with `title` + `description`

### C2. Can You Attach Music Programmatically?

| Parameter | Phase | Supported? | Details |
|---|---|---|---|
| `music_id` | finish | ❌ No | Not documented, not supported |
| `audio_id` | finish | ❌ No | Not documented, not supported |
| `original_sound` | finish | ❌ No | Not documented |
| `sound_id` | start/finish | ❌ No | Not documented |
| `background_music` | finish | ❌ No | Not documented |

**Facebook Graph API v21.0 does NOT support attaching music to Reels via the upload API.** Music must be embedded in the video file itself (as an audio track), or added by users through the Facebook app's native UI.

### C3. The Audio Track Must Be IN the MP4

If you want music in your Reel, the **only API-supported method** is:
1. Generate the video WITH audio already muxed into the MP4/WebM container
2. Upload that video as-is
3. Facebook will play it with the embedded audio

This means you need:
- A royalty-free audio file
- A way to mux audio + video into one container

---

## D. Practical Architecture Options

### Option 1: Server-Side (Vercel Function) — ⚠️ POSSIBLE BUT FRAGILE

**Pipeline:**
```
API route (maxDuration=300)
  → Satori → resvg → PNG frames
    → openh264-wasm → H.264 NALs
      → mp4-muxer → MP4 buffer (with AAC audio)
        → postReelToFacebook()
```

**Pros:**
- Fully automated, no user interaction
- Fits your existing server-side architecture

**Cons:**
- openh264-wasm is ~2MB (approaching function size limits)
- Need AAC encoder too (fdk-aac-wasm or similar, ~500KB more)
- Memory pressure (frame buffers + encoder state)
- 300s timeout is tight for frame generation + encoding + upload
- Must split generation and upload into 2 functions
- Encoding quality from openh264 is mediocre compared to x264
- **Cannot add trending Nepali music** — only royalty-free

**Estimated bundle size impact:** +3-5MB → would need to externalize WASM binaries to R2/S3

---

### Option 2: Client-Side (Browser) — ✅ HIGHLY RECOMMENDED

**Pipeline:**
```
Browser (user's device)
  → HTML5 Canvas animation (existing card images + transitions)
    → MediaRecorder → WebM blob (VP9 + Opus)
      → POST to /api/posts/reel (existing route!)
        → postReelToFacebook()
```

**Pros:**
- **Zero server-side dependencies** — no WASM, no native binaries
- MediaRecorder API is battle-tested and widely supported
- GPU-accelerated canvas rendering (fast!)
- Audio can be captured from `<audio>` element via `MediaStreamDestination`
- Can use WebCodecs VideoEncoder on Chrome for H.264 output (if available)
- Falls back to WebM/VP9 on all browsers (Facebook accepts WebM for Reels)
- User can preview the reel before posting
- No Vercel function size or timeout concerns

**Cons:**
- Requires user to trigger (not fully headless/automated)
- Safari MediaRecorder produces .mov (MP4) instead of WebM — need to handle both
- Audio capture requires CORS-compliant audio source

**Code complexity:** ~100-150 lines of JS for the animation + recording logic

---

### Option 3: External Service — ✅ RELIABLE BUT COSTS MONEY

| Service | Video from API? | Music? | Price | Notes |
|---|---|---|---|---|
| **Remotion** | ✅ React-based templates | Custom audio | $0 (self-host) or $25+/mo (hosted) | Overkill for your use case. Requires ffmpeg on server. |
| **Bannerbear** | ✅ Template-based | ✅ Built-in music library | $49+/mo | Good but expensive, limited customization |
| **Creatomate** | ✅ JSON API | ✅ Music library | $29+/mo for 30 videos | Best API for this use case |
| **Shotstack** | ✅ JSON/EDL API | ✅ Music library | $49+/mo | Enterprise-focused |
| **Renderform** | ✅ JSON API | Custom only | Pay-per-render (~$0.03/video) | Cheapest option |

**Pros:** Zero infrastructure burden, professional output, music included
**Cons:** Monthly cost, vendor lock-in, limited to provider's music library, may not have Nepali music

---

### Option 4: Hybrid (Client Generates, Server Uploads) — ✅ BEST BALANCE

**Pipeline:**
```
1. Client: Canvas animation → MediaRecorder → WebM/MP4 blob
2. Client: POST blob to /api/posts/reel (existing route!)
3. Server: Receives video buffer → postReelToFacebook()
```

**This is essentially Option 2 + your existing upload infrastructure.** Your `/api/posts/reel/route.ts` already handles receiving a video file (base64 or multipart) and uploading via the 3-phase API. You just need to add the client-side generation step.

---

## E. Size Optimization

### Target: < 4MB for 15-20s Reel at 1080×1920

### E1. Video Bitrate Calculator

```
File Size (bits) = Duration (s) × Bitrate (bps)
4 MB = 4 × 8 × 1024 × 1024 = 33,554,432 bits
Available for 15s: 33.5M / 15 = 2,236,960 bps ≈ 2.1 Mbps (video + audio)
Available for 20s: 33.5M / 20 = 1,677,721 bps ≈ 1.6 Mbps (video + audio)
```

### E2. Recommended Encoding Settings

| Parameter | Recommended | Why |
|---|---|---|
| **Resolution** | 1080×1920 (full HD portrait) | Facebook Reels standard. Don't downscale — your images are already 1080px wide. |
| **Frame Rate** | 24 fps | Cinematic, lower than 30fps = smaller files. Simple transitions don't need 60fps. |
| **Video Codec** | VP9 (WebM) or H.264 (MP4) | VP9: better compression, native in Chrome/FF. H.264: universal compatibility, Facebook's preferred format. |
| **Video Bitrate** | 800kbps - 1.2Mbps | Sufficient for image slideshows with text overlays (low motion). |
| **Audio Codec** | Opus (WebM) or AAC (MP4) | Opus: best compression. AAC: best compatibility. |
| **Audio Bitrate** | 64kbps mono | Music sounds fine in mono on phone speakers. Saves ~64kbps vs stereo 128kbps. |
| **Audio Sample Rate** | 44100 Hz | Standard. 22050 Hz is acceptable but may sound slightly dull. |

### E3. Expected Sizes with These Settings

| Duration | Video Bitrate | Audio Bitrate | Total Bitrate | Est. Size |
|---|---|---|---|---|
| 15s | 1.0 Mbps | 64 kbps | 1.064 Mbps | **~1.95 MB** |
| 20s | 1.0 Mbps | 64 kbps | 1.064 Mbps | **~2.60 MB** |
| 15s | 1.2 Mbps | 64 kbps | 1.264 Mbps | **~2.32 MB** |
| 20s | 1.2 Mbps | 64 kbps | 1.264 Mbps | **~3.10 MB** |
| 15s | 1.5 Mbps | 128 kbps stereo | 1.628 Mbps | **~2.99 MB** |
| 20s | 1.5 Mbps | 128 kbps stereo | 1.628 Mbps | **~3.99 MB** |

**All comfortably under 4MB.**

### E4. H.264 vs H.265 vs VP9 for Size

| Codec | Compression Efficiency | Compatibility | Encoding Speed | Recommendation |
|---|---|---|---|---|
| **H.264 (AVC)** | Baseline | ✅ Universal | Fast | Best for MP4 output. Facebook's preferred Reel format. |
| **H.265 (HEVC)** | ~40% better than H.264 | ❌ Limited browser/OS support | Slow | NOT recommended. Browser MediaRecorder doesn't produce it. |
| **VP9** | ~30% better than H.264 | ✅ Chrome, Firefox, Edge | Medium | Good for WebM. Facebook accepts WebM Reels. |
| **AV1** | ~50% better than H.264 | ⚠️ Chrome 121+, limited | Very slow | Overkill. Not needed for <4MB target. |

---

## F. FINAL RECOMMENDATION

### 🏆 Recommended Architecture: Client-Side Generation + Server-Side Upload (Hybrid)

**Phase 1: Video Generation (Client-Side Browser)**

```
User clicks "Generate Reel"
  → Canvas-based slideshow animation:
      Frame 1-3s:  Market summary card (fade-in)
      Frame 4-7s:  Top gainers card (slide transition)
      Frame 8-11s: Top losers card (slide transition)
      Frame 12-15s: Outro with "Follow Share Sathi" + hashtags
  → Background: <audio> element playing royalty-free music
  → captureStream() merges canvas + audio into one MediaStream
  → MediaRecorder captures MediaStream → WebM/MP4 Blob
  → User previews and clicks "Post to Facebook"
```

**Phase 2: Upload (Server-Side, Existing Code)**

```
POST /api/posts/reel with video blob (multipart or base64)
  → postReelToFacebook() (your existing 3-phase implementation)
  → Done! ✅
```

### Why This Is the Best Approach

1. **Reuses 100% of existing infrastructure** — your Facebook Reel upload code, your Satori image generation, your market data pipeline
2. **Zero new server dependencies** — no WASM, no native binaries, no function size concerns
3. **No Vercel timeout issues** — encoding happens on the client
4. **File size is naturally small** — MediaRecorder produces optimized WebM/MP4, well under 4MB
5. **User gets a preview** — they can review the reel before posting
6. **Audio is embedded** — royalty-free music is captured alongside the canvas via `captureStream()`

### Music Strategy

1. **Primary:** Bundle 5-10 royalty-free Nepali-inspired tracks (~500KB each) as static assets. User picks one from a dropdown.
2. **Secondary:** Let user upload their own audio file (stored temporarily in browser).
3. **Not recommended:** Trying to access Facebook's trending music library. It's not available via API and would require copyright licensing.
4. **Note on "trending" effect:** Facebook promotes Reels that use their licensed music library. Since you can't attach that programmatically, consider posting the Reel without music and adding the disclaimer "Add trending sound in Facebook app for more reach."

### Implementation Effort Estimate

| Task | Effort | Priority |
|---|---|---|
| Client-side Canvas animation engine | 2-3 days | P0 |
| MediaRecorder capture pipeline | 0.5 day | P0 |
| Audio selection UI (bundled tracks) | 0.5 day | P0 |
| Preview player | 0.5 day | P1 |
| Upload integration (already exists!) | 0 days | ✅ Done |
| Reel templates (card transitions) | 1-2 days | P0 |
| Progressive motion effects (Ken Burns, etc.) | 1 day | P2 |

**Total: ~5-7 days of development**

### New Dependencies Needed

```json
{
  "dependencies": {
    // NONE required for the client-side approach!
    // MediaRecorder API is native browser API
    // Canvas API is native browser API
    // Your existing upload code handles everything
  }
}
```

### Bundle Size Impact

**0 bytes added to server.** All video generation happens in the browser using native APIs.

### Key Technical Notes

1. **Safari compatibility:** Safari's MediaRecorder outputs `.mov` (MP4 container) with H.264, which is fine for Facebook. Chrome/Firefox output `.webm` with VP9. Facebook accepts both formats for Reels.

2. **Audio capture:** Use `createMediaStreamDestination()` from the Web Audio API to route an `<audio>` element's output into the MediaRecorder stream alongside the canvas video track.

3. **Canvas animation with existing images:** Your `client-image-generator.ts` already renders Satori SVGs to Canvas PNGs. For the Reel, render the same SVGs at 1080×1920 (portrait), draw them on a canvas, and animate transitions with `requestAnimationFrame()`.

4. **Quality tip:** Set `MediaRecorder` options to `videoBitsPerSecond: 1000000` (1Mbps) and `audioBitsPerSecond: 64000` for optimal quality/size balance.

---

## Appendix: Code Sketch for Client-Side Reel Generation

```typescript
// src/lib/reel-generator.ts (browser-only)

async function generateReel(
  cards: string[], // array of data:image/png;base64,... cards
  audioUrl: string,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d')!;

  // Load audio
  const audio = new Audio(audioUrl);
  audio.crossOrigin = 'anonymous';
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaElementSource(audio);
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);
  source.connect(audioCtx.destination); // also play locally

  // Setup MediaRecorder
  const stream = canvas.captureStream(24); // 24fps
  const audioTrack = dest.stream.getAudioTracks()[0];
  if (audioTrack) stream.addTrack(audioTrack);

  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/mp4',
    videoBitsPerSecond: 1_000_000,
    audioBitsPerSecond: 64_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);

  return new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      resolve(blob);
    };

    // Start recording
    audio.play();
    recorder.start();

    // Animate cards
    const CARD_DURATION = 4000; // 4s per card
    const TRANSITION_DURATION = 500; // 0.5s transitions
    let startTime: number;

    function drawFrame(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const totalDuration = cards.length * CARD_DURATION;

      if (elapsed >= totalDuration) {
        recorder.stop();
        audio.pause();
        onProgress?.(100);
        return;
      }

      // Determine which card to show
      const cardIndex = Math.min(
        Math.floor(elapsed / CARD_DURATION),
        cards.length - 1,
      );
      const cardProgress = (elapsed % CARD_DURATION) / CARD_DURATION;

      // Draw card image
      const img = new Image();
      img.src = cards[cardIndex];
      // ... draw with fade/slide transitions ...

      onProgress?.(Math.round((elapsed / totalDuration) * 100));
      requestAnimationFrame(drawFrame);
    }

    requestAnimationFrame(drawFrame);
  });
}
```

---

## Summary Decision Matrix

| Criteria | Server (ffmpeg) | Server (JS muxers) | Client (MediaRecorder) | External API |
|---|---|---|---|---|
| Feasibility | ❌ Fragile | ⚠️ Possible | ✅ Easy | ✅ Easy |
| Vercel compatible | ❌ No | ⚠️ Barely | ✅ N/A (client) | ✅ Yes |
| File size control | ✅ Good | ✅ Good | ✅ Good | ✅ Good |
| Audio/music support | ✅ Full | ⚠️ Complex | ✅ Via Web Audio | ✅ Built-in |
| Trending music | ❌ | ❌ | ❌ | ⚠️ Limited |
| Automated posting | ✅ Yes | ✅ Yes | ⚠️ Needs trigger | ✅ Yes |
| Development effort | High | Medium | Low | Low |
| Recurring cost | $0 | $0 | $0 | $29-49/mo |
| **RECOMMENDED?** | **❌** | **⚠️** | **✅ YES** | **⚠️ If budget allows** |
