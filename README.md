# Dropshot

A clean room rebuild of the Droplr menu bar app for macOS 15 and later. It uploads to your own S3 compatible storage (Cloudflare R2, AWS S3, Backblaze B2, MinIO) instead of Droplr's service.

The behaviour was derived from Droplr 5.9.19 using REA with the Ghidra provider. The findings are in `re/SPEC.md`. No Droplr code, assets or keys are included.

## Build

```bash
xcodegen generate
xcodebuild -project Dropshot.xcodeproj -scheme Dropshot -derivedDataPath build build
open build/Build/Products/Debug/Dropshot.app
```

Run the tests with the same command, replacing `build` at the end with `test`.

## Setup

On first launch the Settings window opens. Under Storage, enter the endpoint, bucket, access key and secret, plus the public base URL that serves the bucket (for R2, a custom domain or the r2.dev URL). Use Test Upload to confirm the object is publicly readable. macOS asks for Screen Recording permission on the first capture.

## Features

| Feature | Default hotkey |
| --- | --- |
| Upload clipboard (files, images, text, or a URL to shorten) | ⌥D |
| Screenshot (drag a region, or press Space to pick a window) | ⌥⇧4 |
| Screenshot and annotate | ⌥⇧3 |
| Record video (MOV) | ⌥⇧5 |
| Record GIF | ⌥⇧2 |
| Upload file | ⌥⇧6 |
| New note | ⌥⇧N |
| Finish recording | ⇧⌘D |
| Pause or resume recording (while recording) | ⌥⇧7 |
| Mute or unmute the microphone (while recording) | ⌥M |
| Cancel and delete the recording (while recording) | Esc |

Screenshots use the system screencapture tool, so selection is the native macOS one. Recordings use ScreenCaptureKit: drag to record an area, click or press Space to record a window, press Return for the whole screen, or Esc to cancel. A countdown (3 seconds by default, set under Settings › Capture) runs before recording starts. While recording, a control bar next to the area has stop, pause, mute and delete buttons. It never appears in the video. The Dropshot menu offers the same controls. System audio and the microphone are recorded to separate tracks, and paused time is cut from the movie. GIFs record without sound.

With Automatically upload macOS screenshots turned on (Settings › Capture), screenshots and recordings you take with ⌘⇧3, ⌘⇧4 or ⌘⇧5 upload as soon as macOS saves them. The originals are left where they are.

You can also drop files or text on the menu bar icon, or use Upload with Dropshot in the Finder Services menu. Folders and multiple files are zipped. The link is copied to the clipboard as soon as an upload starts. Anyone who opens it before the upload finishes sees a Still uploading page that refreshes until the drop is ready. Turn off instant links under General to copy the link only once the upload is done. The menu lists recent drops, each with copy link, Markdown and HTML formats, and a Manage item that opens the drop's management page.

Under General › Drops you choose the privacy (public, password or private), self destruct time and download permission for new drops. They are sent as object metadata and applied by the Worker when it registers the drop. Passwords are hashed on the Mac (the plaintext stays in your Keychain), and a password drop without a valid hash is registered as private.

The annotation editor has arrow, line, rectangle, filled rectangle, ellipse, pen, highlighter, text, pixelate, step number and emoji stamp tools, with undo and redo. You can upload, copy or save the result.

Automation URLs: `dropshot://screenshot`, `annotate`, `record`, `gif`, `stop`, `pause`, `mute`, `clipboard`, `note`, and `upload?path=/absolute/file`.

## Not yet built

Droplr features left out of this version: camera bubble and per app plugins.
