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

Captures use the system screencapture tool, so selection and the recording toolbar are the native macOS ones. Stop a recording with the stop button in the menu bar, the Dropshot icon, or ⇧⌘D.

You can also drop files or text on the menu bar icon, or use Upload with Dropshot in the Finder Services menu. Folders and multiple files are zipped. After each upload the link is copied to the clipboard. The menu lists recent drops, each with copy link, Markdown and HTML formats.

The annotation editor has arrow, line, rectangle, filled rectangle, ellipse, pen, highlighter, text, pixelate, step number and emoji stamp tools, with undo and redo. You can upload, copy or save the result.

Automation URLs: `dropshot://screenshot`, `annotate`, `record`, `gif`, `stop`, `clipboard`, `note`, and `upload?path=/absolute/file`.

## Not yet built

Droplr features left out of this version: auto uploading new macOS screenshots, recording countdown, pause and mute, camera bubble, per app plugins, privacy and self destruct settings, and instant links (copying the link before the upload finishes).
