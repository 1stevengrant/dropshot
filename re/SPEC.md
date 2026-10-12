# Droplr for Mac 5.9.19: behavioural spec for a clean-room rebuild

Source: `/Applications/Droplr.app` (bundle id `com.droplr.droplr-mac`, build 478, min macOS 10.12, `LSUIElement`), arm64 slice at `re/Droplr-arm64`.
Method: ObjC metadata (`otool -ov` parsed into `re/class_methods.txt`, selector to IMP address), CFString-annotated disassembly (`re/disasm_annot.txt`), Ghidra decompilation via REA for a few functions (`re/dec/*.c`), nib decoding via `rea decode-interface-builder` (`re/nibs.json`, text in `re/nib_text.txt`), Info.plist, sdef, `bundle.js`.

Tags: **[O]** Observed (direct evidence cited), **[I]** Inferred (strong circumstantial evidence), **[U]** Unknown.
Addresses are `0x100xxxxxx` in the arm64 slice. "nib:X" means `Contents/Resources/X.nib`.

The rebuild does not talk to Droplr's backend. Server behaviour is summarised only in section 13.

---

## 1. App structure

| Class | Responsibility | Tag |
|---|---|---|
| `DroplrAppDelegate` | Launch, Sparkle updates, services provider (`uploadService:userData:error:`), URL scheme handler (`getUrl:withReplyEvent:` @0x100006a98), open files/folders on Dock icon, pasteboard writers (`writeURLToPasteboard:`, `writeHTMLToPasteboard:`), start-at-login prompt, upload complete handling, menu command entry points (`captureScreenShot:`, `newScreenRecordingAsGIF:` etc.) | O |
| `DMStatusItemController` (singleton `instance`) | Owns the NSStatusItem and its custom view; click handling; drag-and-drop onto icon (`performFile/URL/String/Image/FilePromise/ITunesDragOperation:`); clipboard upload; main hotkey; screenshot/recording entry points; upload progress/state; error popovers; binds global shortcuts (`registerShortcuts` @0x10002ca5c) | O |
| `DMStatusItemView` / `DMStatusItemLayer` | Menu bar icon view: states, progress drawing, drag destination, left/right/alt click delegation | O |
| `DroplrStatusMenu` (+`DroplrStatusMenuViewController`, nib) | The status menu: actions, plugins submenu, recent drops list, uploading row | O |
| `DropMenuItemView(Controller)`, `DropPreviewViewController`, `UploadingMenuItemViewController`, `DMThumbnailProvider/Cache` | Recent drop rows (thumbnail, title, view count, copy/edit/delete/more buttons, drag out), hover preview popover, in-menu upload progress row, thumbnail fetching | O |
| `DMServiceController` (singleton) | All upload and drop operations (upload file/data/chunked, archive and upload, shorten link, create note, privacy, self destruct, rename, delete, list drops), login state, cancellation | O |
| `DMArchiver` | Zips folders / multi-file selections with `/usr/bin/zip` | O |
| `DMScreenGrabber` | Screenshot via `/usr/sbin/screencapture`; also renders a web URL into an image (`imageFromWebURL:completionBlock:` using a WebView) | O |
| `DMScreenRecorder` | Recording orchestration: options UI, stop button panel over the status item, pause/mute/cancel, recording hotkeys, GIF conversion, then upload | O |
| `LNCaptureWindowController` / `LNCapturePanel` / `LNCaptureSession` / `LNCaptureSessionOptions` / `LNVideoControlsViewController` / `LNWindowInspector` / `LNGIFConverter` | Region selection panel with resize handles and presets, camera preview overlay, AVFoundation screen capture to movie file, recording options persistence, window snapping (CGWindowList), MOV to GIF conversion via bundled ffmpeg | O |
| `NativeScreenRecorder` | `screencapture -v -R...` recorder. No selector references to it anywhere, so dead code | O (unused) |
| `ScreenshotDetector` | Spotlight `NSMetadataQuery` watching for new macOS screenshots/screen recordings to auto-upload | O |
| `DMAnnotationWindowController` / `DMAnnotationViewController` / `DMAnnotationView` / `DMAnnotation*Layer` | Markup editor ("Droplr Draw") | O |
| `DMColorSelectionViewController`, `DMFontStyleViewController`, `DMEmojiController`, `TextCapturerView`, `DMTextEditorView` | Editor popovers: colour swatches, font/size, emoji grid | O |
| `DDDefaultTheme` | Persists editor defaults (colour, font, size) | O |
| `DMNotificationController` | User notifications (native `NSUserNotification` or internal popover attached to the status item) | O |
| `InternalNotificationPopoverController`, `DMAttentionGrabberWindowController` | Popover messages under the icon; "bounce" animation pointing at the icon | O |
| `DMPreferencesWindowController` (+General/Account/Shortcuts view controllers, `DBPrefsWindowController` base) | Preferences window with toolbar tabs | O |
| `DMShortcutsController`, `ShortcutsViewController` | MASShortcut defaults, migration and recorder UI | O |
| `DMDefaultsController` | Thin wrapper over `NSUserDefaultsController`, registers initial values | O |
| `DMPluginGateway`, `DMDropletFactory`, `DMAbstractDroplet` + `DM*Droplet`, `DMSketchPlugin` | Per-app "plugins" run by the main hotkey (AppleScript into the frontmost app) | O |
| `DetailWebViewController`, `ComposeNoteViewController`, `CodeSnippetViewController`, `CreateLinkViewController`, `EditNoteViewController`, `NotificationScriptMessageHandler` | WKWebView hosting `markdownEditor.html` + `bundle.js` for notes, code snippets and link shortening | O |
| `DMGrabImageFromURLCommand`, `DMShortenURLCommand`, `DMShowNoteComposerCommand` | AppleScript commands | O |
| `OnboardingController`, `DMNewFeaturesWindowController`, `TooltipViewController` | Onboarding web view, "What's new" window, first-run tooltip in editor | O |
| `DMAccountController`, `LoginWindowController`, `AuthWindowController`, `TwitterWebAuthWindowController`, `DK*` (DroplrKit) | Auth and API client. Out of scope for rebuild | O |
| `DCDropCache`, `DCDropContentCache`, `DMCacheController`, `BBCappedCache` | Local drop list and content cache | O |
| `Droplr.appex` (`ShareViewController`) | macOS Share extension | O |
| `DroplrHelper.app` (LoginItems) | Background-only login item for start at login | O |

Frameworks: MASShortcut (+ ShortcutRecorder legacy), Sparkle, AFNetworking, SAMKeychain, Reachability, CDEvents (FSEvents watcher for file promise dir), EGOCache [O].

---

## 2. Status item and status menu

### 2.1 Icon states [O]
Strings: `DMStatusItemStateNormal`, `Highlighted`, `Dragging`, `IndicatingProgress`, `IndicatingProgressHighlighted`, `Error`, `Disabled`, `RecordingInput`, `RecordingInputInProgress`; images `DMStatusItemIcon`, `DMStatusItemIconHighlighted`, `DMStatusItemIconError`, `DMStatusItemIconDisabled`, `DMStatusItemRecording`, `DMStatusItemRecordingHighlighted` (Resources has `DMStatusItemIcon.pdf`, `DMStatusItemRecordingIcon.pdf`).
- Drag enters icon: state Dragging (`draggingEntered:` sets 2) [O].
- Upload in progress: icon draws progress (`setStatusItemProgressValue:`, `imageForCurrentProgressValue`, animation timer) [O].
- Upload failure: Error state (7) [O]. Recording: recording states (3 prepared, 4 recording) [I from `captureScreenRecordingAsGIF:includeCamera:` @0x10002d828].

### 2.2 Clicks [O]
- Left click (`didLeftClickStatusItemView:` @0x10002ac98): if onboarding should display, show onboarding window instead. Else if a recording is active, show recording options. Else silently refresh account and pop up the status menu.
- Right click: pop up the same menu (or recording options when recording).
- Option/alternate click: same as left click.
- While a recording is "prepared" (region panel open), clicking the icon cancels the capture (`DMScreenRecorder statusItemMouseDown`) [O].

### 2.3 Menu items (nib:DroplrStatusMenuViewController, actions on `DroplrStatusMenu`) [O]
In order:
1. `Pro` badge item (hidden unless trial; `upgradeMenuItem`).
2. **Upload File…** (`file:`) opens an NSOpenPanel titled "Select File" (files and directories, multiple selection) [O].
3. **Screenshot** (`screenshot:`), **Screenshot with markup** (`screenshotWithDraw:`).
4. **Screencast as HD Video** (`screenRecording:`), **Screencast as GIF** (`screenRecordingAsGIF:`).
5. **Plugins** submenu: "Run plugin on active app", "Upload selected Finder file", "Share Sketch page as PNG", "Share Photoshop file as PNG", "Share Illustrator artwork as PNG", "Shorten current Google Chrome URL", "Shorten current Safari URL", "Share selected Font Book font", "Share current TextWrangler file", "Activate Sharing Extension…".
6. **More** submenu: "Markdown Note" (`note:`), "Code Snippet" (`code:`), "Shorten Link" (`link:`), "Upload clipboard contents" (`clipboard:`).
7. Recent drops section (see 2.4).
8. **View All Drops…** (opens web dashboard), **Preferences…**, **Open Archive Folder**, **Upgrade**, **Quit**.
- Menu item key equivalents are set at runtime from the bound shortcuts (`updateMenuItem:shortcutKey:`) [O].
- While uploading, an "uploading" row (nib:UploadingMenuItemViewController, "Preparing upload" / e.g. "52% • 5 minutes left", cancel button `cancelCurrentUpload:`) is inserted at the top (tag 16) and capture items (screenshot, markup, video, GIF) are disabled; they are re-enabled after (`DroplrStatusMenu setup` @0x10004ddc8) [O].
- Time remaining is fuzzy: "~Ns left" / "~Nm left"; speed formatted "%.1f<unit>/s" [O strings].

### 2.4 Recent drops list [O unless noted]
- Built on menu open from a background queue `com.droplr.reloadDrops`, using cached list then refreshed from server (`refreshDropListComplete:`).
- Up to 10 rows [I: constant 10 in `setup`]. Each row is a custom view (nib:DropMenuItemViewController): thumbnail, title (e.g. "Screen Shot on 2018-02-12 at 12:08:34"), view count, buttons: copy link, copy HTML, edit, delete, more, drag handle.
- Thumbnails fetched and cached (`DMThumbnailProvider provideImagesForDrops:…`, `thumbnails.plist`, queue `com.droplr.buildThumbnails`). Type icons by MIME (`type-img`, `type-zip`, `type-pdf`, `type-doc`, `type-code`, `type-video`, `type-audio`, `type-note`, `type-link`, etc.).
- Hover shows a preview popover (`showPreview:` → `DropPreviewViewController`).
- **Click row** (`showDrop:`/`openDrop:`): close menu, open the drop's public URL in the default browser.
- **Copy link** (`copyLink:`): close menu, put short URL on pasteboard (string type), show "Link Copied"/"%@ Copied" notification.
- **Copy HTML** (`copyHTMLLink:`): pasteboard HTML: a 300px-wide `<img>` of the drop followed by a link.
- **Copy direct link** (`copyDroplrDirectLink:`): short URL with `+` appended (direct file).
- **Copy BB embed** (`copyBBEmbedLink:`): `[img]URL[/img]`.
- **Edit** (`edit:`): image drop → download and open in markup editor; markdown note → note editor window; video → opens web video editor URL.
- **Delete** (`deleteDrop:`): confirmation "Are you sure you want to delete this Drop?" / "This action cannot be undone." [O strings].
- **Rename** (`titleDidUpdate:`): inline title edit, saves via `updateTitle:ofDropWithCode:`; alert strings "Update title" / "Enter your new Drop title".
- **More** → "Drop Actions" menu (`actionsMenu` @0x10008a77c): Privacy submenu (Public, Password Protected, Team Only; checkmark on current; Password prompts "Set password" / "Please enter a password to secure your Drop", alphanumeric 4 to 32 chars), Self Destruct submenu (Keep, 1 Hour, 1 Day, 1 Week, 1 Month, 3 Months, 6 Months; `setSelfDestruct:` computes expiry timestamp from now), plus system sharing services (`activateSharingService:` performs `NSSharingService` with the URL) [O].
- **Drag a row out** (e.g. to Finder): file promise; downloads the direct file ("Downloading Drop" then "Drop downloaded" notification) [O].

---

## 3. Upload flow

### 3.1 Entry points [O]
| Source | Behaviour |
|---|---|
| Drag files onto icon | `performFileDragOperation:` → `archiveAndUpload:` |
| Drag image data (e.g. from browser) | `performImageDragOperation:` (web archive / TIFF / PNG data) → upload as image |
| Drag URL | shorten link |
| Drag text | if it parses as URL with scheme and host → shorten; else create text note (default note type) |
| Drag file promise | `performFilePromiseDragOperation:` writes into a watched promise directory (CDEvents) then uploads |
| Dock/Finder "Open With" (`application:openFiles:`) | `archiveAndUpload:` |
| Services menu "Share with Droplr" (`uploadService:userData:error:` @0x1000075fc) | iTunes items → file; TIFF → PNG data upload; filenames → `archiveAndUpload:`; promised file URL → file; URL type → shorten; string → absolute path uploads file, URL shortens, otherwise text note |
| Clipboard (`uploadClipboard:` @0x10002bbb8) | file URL → upload file; image data → PNG named "Image <timestamp>.png"; URL string → shorten; other text → note |
| Main hotkey (see 7) | plugin for frontmost app, else clipboard |
| Share extension | see 10.4 |
| URL scheme / AppleScript | see 9 |

### 3.2 File and folder handling [O]
- Single regular file: uploaded as is (`uploadFile:withOptions:complete:` @0x10000c014).
- Directory, or more than one file: zipped first (`archiveInBackground:…` @0x100011c88 → `DMArchiver zipFiles:` @0x100015a44). Runs `/usr/bin/zip -r -9 -D -x *.DS_Store <Archive>.zip <items>` with the working directory set to the parent folder; output in the temp dir named "Archive.zip" [O args; name for single folder I].
- Empty files rejected ("File is empty") [O string].
- Images: retina detection adds a pixel density field so the web view shows at 1x [O `hasRetina`, `backingScaleAsString:`]. JPEG EXIF orientation is read before upload [O].
- Cancel: `cancelCurrentUpload` from the uploading row [O].

### 3.3 After upload [O]
1. "Instant links": as soon as the server creates the drop record (before bytes finish), the short URL is written to the general pasteboard as a plain string and a "Link Copied" notification is shown (`handleUploadMetaCreatedNotification:` @0x10000941c). The "What's new in 4.2" window describes this.
2. On completion the URL is written again, notification "%@ Copied", and if **Open Drop page after upload** is on, the drop page is opened in the browser (`handleUploadCompleteNotification:` ~0x100009528 reads `DMDefaultsOpenDropsKey`).
3. Sound (`DMStatusItemController handleUploadCompleteNotification:` @0x10002ed7c): if `DroplrNotificationPlaySound`, play `DroplrNotificationSoundName`: "Arcade" or "Drop" are bundled `.aif`, others are system sounds (Glass, Morse, Pop, Tink), "None" disables.
4. Native notification has an "Open" action button; activating it opens the link (`userInfo["droplrLink"]`) [O].
5. Failure: icon Error state; popover under the icon with error text, "No data has been lost. You can manually recover your file." and a "Recover my file" button that reveals the temp file in Finder (`activateFileViewerSelectingURLs:`) [O]. Plan limit errors show "Monthly Upload Limit Reached" / "Subscription Expired" variants.
6. Uploaded content is also stored in a local cache ("Archive folder", opened in Finder by **Open Archive Folder**) [I: `storeInCache:ofType:withCode:`, `DCDropContentCache`].

### 3.4 Link format [O strings]
Short links on `d.pr` with a type prefix and code, e.g. `https://d.pr/i/<code>` (image), `https://d.pr/v/<code>` (video). Private drops use longer "obscure" codes. Appending `+` gives the direct file. Rebuild: generate the equivalent public URL of the S3 object (optionally a short key) and keep the "+ = direct" idea optional.

---

## 4. Screenshot capture

- Tool: `/usr/sbin/screencapture` launched via NSTask, synchronous wait (`DMScreenGrabber captureScreen:` @0x100017018, `captureToolPath` checks the file exists) [O]. No CGWindow capture for stills.
- Region (default): `screencapture -i <path>` (interactive crosshair; user can press Space to switch to window mode, the macOS built-in behaviour) [O args `-i`].
- Window: `screencapture -i -w <path>` (`captureWindow` @0x10001719c) [O].
- Fullscreen: no dedicated mode [O: only `-i` and `-w` strings exist].
- If the user cancels (Esc) no file exists, nothing happens [O: `fileExistsAtPath:` check].
- Output: PNG in `NSTemporaryDirectory()` named "Screenshot on yyyy-MM-dd at HH-mm-ss.png" (format "%@ on %@ at %@.%@", date "yyyy-MM-dd", time "HH-mm-ss") [O strings; mapping I]. Markup screenshots use prefix "Markup".
- Flow (`captureScreenshotWithDraw:` @0x10002d244): requires logged in and not uploading; sets icon to progress state; capture; if `draw` → open image in markup editor; else upload immediately [O].
- Which action draws: menu "Screenshot" and screenshot hotkey → no draw; "Screenshot with markup", markup hotkey and `droplr-action://screenshot` → draw [O]. `captureScreenshotStandard/Alternate` consult `DrawActive` (account `drawEnabled`) [O; UI exposure U].
- Hotkeys are ignored while recording [O `isRecording` checks].
- **Auto-upload of system screenshots**: `ScreenshotDetector` runs a Spotlight query `kMDItemIsScreenCapture = 1 OR kMDItemIsScreenRecording = 1`; on update, if `DMDefaultsUploadScreenshotsKey` is on and the newest item is under 10 s old and different from the last one, upload it [O @0x10006dd64, @0x10006e0b4].
- Web page capture: `DMScreenGrabber imageFromWebURL:` loads a URL in an offscreen WebView and snapshots it (used by AppleScript `capture`, share extension "Share as Image", `droplr-draw://`) [O].
- `resample-dpi.sh` (third-party, MIT) bundled for retina DPI fixing; no reference found from code [U].

---

## 5. Annotation (markup) editor

Window: nib:DMAnnotationWindowController, view nib:DMAnnotationViewController. Opened with an image (`showDrawWindowWithImage:`) or URL (`showDrawWindowWithImageURL:`, downloads with progress) [O].

### 5.1 Toolbar [O nib]
- Tool segmented control (images): arrow, pencil (menu: **Pen**, **Highlighter**), shape (menu: **Line**, **Rectangle**, **Filled Rectangle**, **Oval**, **Filled Oval**), text, blur, emoji.
- Initial state on open: zoom 100%, undo/redo disabled and cleared, pencil = Pen, shape = Rectangle (`setInitialOptions` @0x10003be80) [O]. Default tool on open: type 4 [I: likely arrow].
- Colour button (14x14 swatch of current colour) → popover with 9 preset colours plus "custom" using `NSColorPanel` [O `colors` @0x1000336d0 builds 9; `orderFrontColorPanel:`].
- Text style button → popover: Font (Helvetica, Impact, Times, Elfin), Size (Small, Medium, Large, Ginormous); defaults Helvetica / Large [O nib:DMFontStyleViewController, `awakeFromNib`].
- Emoji → popover grid (`DMEmojiController`) seeded from macOS emoji recents (`com.apple.EmojiPreferences` / `EMFRecents`) with "More…" opening the system character palette [O].
- Undo, Redo; Zoom popup (50%, 100%, 125%, 150%, 200%, 300%) [O].
- Tags token field (`showTags:`) [O, server feature].
- Drag button: drag the rendered PNG out as a file promise [O `DMDraggableButton`].
- Download button: Save panel, PNG only, default name "Markup on yyyy-MM-dd at HH:mm:ss", then reveal in Finder [O `saveImage:` @0x1000397c8].
- **Save & Copy URL** (primary): render, write PNG to temp, fade window out, upload [O `upload:` @0x100038b28].
- Copy (`copy:`): PNG of rendered image to pasteboard [O].
- Dropping an image file onto the window replaces the image [I: `draggingEntered:`/`performDragOperation:`].
- First open shows a one-off tooltip on the upload button ("Just type…", `HasShownDrawUploadShortcut`) [O].

### 5.2 Layers and editing [O class list]
`DMAnnotationArrowLayer` (start/end handles, tapered arrow path), `LineLayer`, `SquareLayer`/`CircleLayer` (4 corner handles, `filled`), `PenLayer` (freehand points; Highlighter is a pen type with translucent stroke [I]), `TextLayer` (inline text editor, commits on notification), `EmojiLayer`, `BlurLayer` (rectangle that pixelates the underlying image; `CIPixellate` used, `CIGaussianBlur` appears for UI background) [O strings].
- Each layer is selectable, shows handles, can be moved/resized; Shift constrains proportions [I: `trackFlagsChanged`, `proportional`].
- Delete key removes selected layer; arrow keys nudge selected layer [O `DMAnnotationView keyDown:` @0x100053a7c, I for exact keys].
- Full undo/redo via NSUndoManager with action grouping; property changes observed via KVO (`DMAnnotationLayerObservableProperty`) [O].
- Stroke size and scale stored on the view controller; defaults from `DDDefaultTheme` (colour `DefaultColorKey`, font `DefaultFontKey`/`DefaultFontTitleKey`, size `DefaultFontSizeKey`/`DefaultFontShorthandSizeKey`), persisted when changed [O].
- Export: `imageRepresentation` flattens layers at the screen backing scale [O].

---

## 6. Screen recording

### 6.1 Start [O]
- Entry: menu "Screencast as HD Video" / "Screencast as GIF", hotkeys, `droplr-action://screen-recording[-with-camera]`.
- `captureScreenRecordingAsGIF:includeCamera:` @0x10002d828 creates a `DMScreenRecorder`, which opens `LNCaptureWindowController` on the main screen: a translucent full-screen panel with a resizable crop rectangle (handles, `LNResizeHandle`, `LNOverlayView` size label) and a control bar (nib:LNVideoControlsViewController).
- Control bar: **Preset** popup (Apple iPhone: iPhone 8 375×667, 8 Plus 414×736, SE 320×568, XS 375×812, XR 414×896; Web: 1366×768, 1920×1080, 1440×900, 1280×800; **Snap to window**; **Fullscreen**), **Options** menu (Timer: None/3/5/10 seconds; Camera: device list or none; Camera Size: Small/Medium/Large; Microphone: device list or none; Video Format: MOV/MP4; Show mouse clicks), **Record** button, close [O nib].
- Snap to window: lists on-screen windows (CGWindowList: owner, window id, layer, bounds) and snaps the crop rect to the clicked window [O `LNWindowInspector`, `windowToRect:`].
- Permissions: requests mic, camera and Screen Recording permission, with alerts pointing to System Preferences > Security & Privacy [O strings]. If no audio option is selected: alert "No audio selected / Please select one of the audio options" [O].
- Countdown: Record button shows the remaining seconds, ticking every second, then starts [O `countdown:complete:`].
- Options persist in user defaults (`kStartDelayKey`, `kVideoFormatKey`, `kCamSizeKey`, `kShowMouseClicksKey`, `kDefaultMicIdKey`, `kDefaultCamIdKey`); last crop rect `LNCropRectKey` [O].
- Esc in the capture window closes it [I: `keyDown:` orders window out].

### 6.2 Capture engine [O]
AVFoundation, not ffmpeg: `AVCaptureSession` preset High, `AVCaptureScreenInput` for the main display with `cropRect` and `capturesMouseClicks`, `AVCaptureDeviceInput` for the mic (unless audio disabled), `AVCaptureMovieFileOutput` to a temp `.mov` (`LNCaptureSession` @0x100061278). Camera bubble is a separate `AVCaptureSession` with `AVCaptureVideoPreviewLayer` overlaid inside the region so it is recorded with the screen [O `createCameraPreview:camera:`; I for "recorded"].
- Pause/resume via `pauseRecording`/`resumeRecording`; mute toggles the audio connection volume [O].
- Max duration: no `maxRecordedDuration` or timer found [U, probably unlimited].

### 6.3 During recording [O]
- Status icon switches to recording state; a 16×16 borderless stop button panel is placed over the status item at shielding window level (`createStopButton` @0x10007f238).
- Clicking it (or the status item) shows a menu: **Finish Recording**, **Pause Recording/Resume Recording**, **Mute Recording/Unmute Recording** (only with a mic), separator, **Cancel and Delete Recording**; each with its shortcut shown (`recordingOptions` @0x10007ec4c).
- Recording hotkeys are bound only during recording (`registerHotKeys`): finish, pause, mute.

### 6.4 Finish and convert [O]
- Video: the movie file is uploaded directly (MOV or MP4 per option) with a pixel-density option.
- GIF: message "This may take a few minutes for long recordings."; `LNGIFConverter convertFileAtPath:withName:"Screen Capture" scaleFactor:` with scale 0.5 on retina (2x) screens, else 1.0. If bundled `MacOS/ffmpeg` exists, two passes:
  1. palette: `ffmpeg -i <mov> -y -vf "fps=10,scale=-1:-1:flags=lanczos,palettegen" <palette.png>`
  2. encode: `ffmpeg -i <mov> -i <palette.png> -y -lavfi "fps=10,scale=-1:-1:flags=lanczos [x]; [x][1:v] paletteuse" -f gif <out.gif>`
  Task timeout 500 s. Fallback without ffmpeg: AVAssetImageGenerator frames into a CGImageDestination GIF with progress notifications, then an optional gifsicle-style optimiser (`-O3 --careful --no-comments --no-names --same-delay --same-loopcount`, `--scale`/`--resize 480x`) if a helper executable named `DroplrGIFHelper` exists (not bundled) [O `convertFileAtPath:…` @0x10001ee50, `makeAnimatedGifFromAsset:…` @0x10001fa6c, strings].
- `DMScreenRecorderConfirmationViewController` ("Share recording as… Movie (Includes audio) / GIF (No audio)", with GIF progress) exists [O nib] but the current flow picks format up front; whether it is still shown [U].
- Audio recording default: pref `DroplrRecordSound` [I].

---

## 7. Hotkeys

Implementation: MASShortcut, stored in user defaults under keys with suffix `-MAS`; bound via `MASShortcutBinder bindShortcutWithDefaultsKey:toAction:` [O]. Legacy keys without `-MAS` (dict of `DroplrShortcutKeyCode`, `DroplrShortcutModifierFlags`) are written by `reassignShortcuts` (@0x10001bd10) on first run of v3+, then converted [O]. All are user-rebindable in Preferences > Shortcuts.

### Default hotkeys
| Action | Defaults key | Default | Tag |
|---|---|---|---|
| Droplr Hot Key ("main": plugin for frontmost app, else upload clipboard; while recording shows recording menu) | `DroplrShortcutCopySelection-MAS` | ⌥D | O |
| Capture Screenshot | `DroplrShortcutScreenshotCapture-MAS` | ⌥⇧4 | O |
| Capture Screenshot & Draw | `DroplrShortcutsDraw-MAS` | ⌥⇧3 | O |
| Record Screencast (video) | `DroplrShortcutScreenRecordingCapture-MAS` | ⌥⇧5 | O |
| Record GIF Screencast | `DroplrShortcutScreenRecordingGIFCapture-MAS` | ⌥⇧2 | O |
| Choose File (upload) | `DroplrShortcutSelectFile-MAS` | ⌥⇧6 | O |
| Compose Note | `DroplrShortcutComposeNote-MAS` | ⌥⇧N | O |
| Finish Recording | `DroplrShortcutStopScreenRecording-MAS` | ⇧⌘D | O |
| Pause Recording | `DroplrShortcutPauseScreenRecording-MAS` | ⌥⇧7 | O |
| Mute Recording | `DroplrShortcutMuteRecording-MAS` | ⌥M | O |

Evidence: key codes and modifier masks in `reassignShortcuts` (modifier 0xA0000 = ⌥⇧, 0x80000 = ⌥, 0x120000 = ⇧⌘; key codes 0x15=4, 0x14=3, 0x17=5, 0x13=2, 0x16=6, 0x2D=N, 0x02=D, 0x1A=7) and `setStop…/setMute…ShortcutToDefaultIfNeeded` (@0x10001bc74: 0x2E=M with ⌥). Stop and mute defaults are reapplied at launch if missing [O].

Bound actions (`registerShortcuts`): screenshot (no draw), draw screenshot, video recording, GIF recording, main hotkey (`copyCurrentSelection` @0x10002cdb4), compose note, choose file [O]. Window capture has menu/AppleScript entry points but no default shortcut [O].

Main hotkey logic: if recording → recording menu; if frontmost app is Droplr → open file picker; if a droplet exists for the frontmost app's bundle id → run it; else if clipboard has content → upload clipboard [O selectors; order I].

---

## 8. Preferences

Window (nib:DMPreferencesWindow) toolbar tabs: **General**, **Account**, **Shortcuts** (plus "Upgrade"/Pro promo content) [O].

General tab controls: Start at Login, Hide Dock icon, Automatically upload screen captures, Open Drop page after upload, Notification Sound popup (Arcade, Drop, Glass, Morse, Pop, Tink, None), note pointing to System Notification Preferences, Check for Updates, version line "You are currently running Droplr for Mac %@ (build %@)", "Enjoying Droplr? Buy Today!" banner for trials [O nib]. Code also handles a "record screen sound" checkbox and a "draw active" checkbox (`toggleRecordSound:`, `toggleDrawActive:`) whose visible labels were not found in the nib [O selectors, U labels].

Shortcuts tab: MASShortcutView rows: Droplr Hot Key, Capture Screenshot, Capture Screenshot & Draw, Record Screencast, Record GIF Screencast, Choose File, Compose Note, Finish Recording (+ pause view) with help text "The main Droplr hotkey will upload the clipboard contents or perform certain actions in apps like Photoshop & Safari." [O nib].

Account tab: signed-in user, plan, storage meter, Sign In/Sign Out, upgrade buttons. Not needed for rebuild except as "Storage" settings [O].

### Preferences table
| Key | Type | Default | Meaning | Tag |
|---|---|---|---|---|
| `DroplrStartAtLogin` | Bool | YES (registered initial value) | Launch at login via `DroplrHelper` login item | O key, I default |
| `DroplrHasPromptedForStartAtLogin` | Bool | NO | One-time alert "Start Droplr when Logging In?" (Yes / No thanks) | O |
| `HideDockIcon` | Bool | (unset → NO) | Toggling asks to restart ("Restart Required", Restart Now/Later) and relaunches | O |
| `DMDefaultsUploadScreenshotsKey` | Bool | NO if unset | Auto-upload new macOS screenshots | O key, I default |
| `DMDefaultsOpenDropsKey` | Bool | YES on first run | Open drop page in browser after upload | O key, I default |
| `DroplrNotificationPlaySound` | Bool | NO (registered) [I] | Play sound after upload | O key |
| `DroplrNotificationSoundName` | String | U (likely "Drop") | Arcade, Drop, Glass, Morse, Pop, Tink, None ("None" also clears PlaySound) | O |
| `DroplrRecordSound` | Bool | NO (registered) [I] | Record audio in screencasts | O key, I meaning |
| `DrawActive` | Bool | U | Screenshots open in markup editor first (`drawEnabled`) | O key, I meaning |
| `DroplrNotificationDetailText` | | | Used in failure popover | O |
| `DefaultsNoteFormatKey` | NSValue(UInt) | 3 if unset | Default note type for dropped text | O |
| `DefaultColorKey`, `DefaultFontKey`, `DefaultFontTitleKey` ("Helvetica"), `DefaultFontSizeKey`, `DefaultFontShorthandSizeKey` ("Large") | | | Markup editor defaults | O |
| `kStartDelayKey`, `kVideoFormatKey`, `kCamSizeKey`, `kShowMouseClicksKey`, `kDefaultMicIdKey`, `kDefaultCamIdKey`, `LNCropRectKey` | | | Recording options and last region | O |
| `HasShownDrawUploadShortcut` | Bool | NO | Editor tooltip shown once | O |
| `DroplrHasRunBeforeV3` | Bool | NO | First-run migration/shortcut defaults | O |
| `*HasShownNotification` (per plugin name) | Bool | NO | Plugin tip shown once ("Type Option+D (…) on your keyboard to …") | O |
| `ServerEnvironment` (Production/Development/Local) | String | Production | Backend switch. Not needed | O |
| `DroplrShortcut*-MAS` | data | see 7 | Hotkeys | O |
| Sparkle `SUScheduledCheckInterval` | | 86400 s | Daily update check; also checks in background at launch | O |

Rebuild additions needed (not in Droplr): S3 endpoint, bucket, region, keys (Keychain), public URL base, key naming scheme, ACL.

---

## 9. URL schemes and AppleScript

### 9.1 `droplr://` [O `getUrl:withReplyEvent:` @0x100006a98]
- `droplr://auth?accessToken=…` login callback (out of scope).
- `droplr://?twitterOAuth=true…` Twitter OAuth callback (out of scope).
- `droplr://?handleURL=<url>&format=<fmt>` (used by the Share extension):
  - `kDMSharingFormatFile`: file URL → upload file.
  - `kDMSharingFormatShortlink`: shorten URL.
  - `kDMSharingFormatURLImage`: render web page to image (`imageFromWebURL:`) then upload.
### 9.2 `droplr-action://<host>` [O]
| Host | Action |
|---|---|
| `screenshot` | screenshot with markup (`drawScreenshot`) |
| `screen-recording` | video screencast |
| `screen-recording-with-camera` | video screencast with camera bubble |
| `clipboard` | upload clipboard |
### 9.3 `droplr-draw://<url>` [O `drawURL`]
Fetches the image (web URL rendered/downloaded) and opens it in the markup editor (`showDrawWindowWithImageURL:`).

### 9.4 AppleScript (`Droplr.sdef`, suite "Droplr Suite") [O]
- `capture "<url>"`: capture a URL as an image and upload (`DMGrabImageFromURLCommand`).
- `shorten "<url>"`: shorten a URL (`DMShortenURLCommand`).
- `compose`: show the note composer (`DMShowNoteComposerCommand`).
- Note: `capture` and `shorten` share the same Apple event code `dmstshrt` in the sdef (a Droplr bug; give them distinct codes).
- The editor can also hand off an image via `tell application "Droplr" to open file "<path>"` (`uploadOverScriptingBridge:`) [O string].

---

## 10. Other features

### 10.1 Plugins ("droplets") for the frontmost app [O strings]
Run by main hotkey or Plugins menu; each drives the app with AppleScript (needs Automation permission; on failure shows "Permissions error" with link to Privacy_Automation) and then uploads or shortens:
- Finder: selected files → upload. Safari / Chrome / Firefox: current tab URL → shorten (Safari/Firefox: if text is selected, copy selection instead). Photoshop / Illustrator: export current doc as PNG → upload. Sketch: `sketchtool export pages --formats=png` → upload. InDesign: export PDF ("[Smallest File Size]" preset) → upload (`indesign.scpt` variant lets user pick a preset). Pages / Numbers: export as PDF. TextEdit, TextWrangler, iA Writer, Xcode: current document file/text → upload. Font Book: selected font file. Contacts: selected contact as `.vcf`. iPhoto: selected photo. Photo Booth: copies selected photo.
- First time a plugin activates, a tip notification is shown once.

### 10.2 Notes, code snippets, link shortener [O]
`DetailWebViewController` hosts `markdownEditor.html` + `bundle.js` (React; SimpleMDE markdown editor, CodeMirror for code with line numbers, a URL field with validation for links, title field "Untitled"). Query `?type=markdown|code|link`. JS ↔ native: native calls `window.setMarkdownText`, `window.setNoteType`, `window.getNote()` → `{title,type,text}`; JS posts `{action:'editorUpdated'}` via `webkit.messageHandlers.desktop`; native also handles actions `showDrop`, `showMessage`, `dropCreated`. Closing a dirty note asks "Do you want to keep this note?" (Save / Don't Save / Cancel). Note variants: markdown, plain, textile, code.

### 10.3 Notifications and attention [O]
- Two styles: native `NSUserNotification` (title, subtitle, informative text, "Open" button) or an internal popover anchored under the status item (`InternalNotificationPopoverController showWindowAtPoint:withTitle:message:image:actionTitle:action:`).
- First launch / after login: popover "Welcome, <first name>! to Droplr. Drag images, videos and files here to share." and start-at-login prompt (`displayReadyToUploadMessage`) [O].
- `DMAttentionGrabberWindowController bounceOnStatusItem:` shows a small window under the icon that fades in, bounces vertically (±5 pt keyframes), then fades out after a delay, used to point at the icon [O].

### 10.4 Share extension (`Droplr.appex`) [O]
Accepts up to 250 files/images, 10 movies, text, 1 web URL. Files → `droplr://?handleURL=<fileURL>&format=kDMSharingFormatFile`. Web URL → asks "How do you want to share this link?" **Share as Image** / **Share as Short Link**. Text → put on clipboard then `droplr-action://clipboard` [I].

### 10.5 Drop settings popover (nib:DMDropSettingsViewController) [O]
Title field, Privacy popup (Public, Password Protected, Team Only), password field, BACK / SAVE; Pro-only features show "Please upgrade to Pro to password protect your Drops". Privacy values: PUBLIC, PRIVATE (obscure URL), TEAM, password. Self destruct types: TIME, VIEWS, NONE.

### 10.6 Misc
- Drop meter (nib:DMDropMeterViewController, "10/30"): free-plan monthly drop counter [O, out of scope].
- Onboarding: web view "Get started with Droplr" shown on first click until done [O].
- Reachability check on launch, drop list reload timer and account refresh timer [O].
- Dock icon can be shown (activation policy switch) [O].
- `DMNewFeaturesWindowController`: "What's new in Droplr 4.2" pages (Instant links, App Extension, Screen Recording, Reaction GIFs) [O].

---

## 11. Rebuild notes (suggested, not evidence)
- Replace `screencapture` + AVCaptureScreenInput with ScreenCaptureKit for recording on modern macOS; keep `screencapture -i` / `-iw` for stills (simple, native UX).
- Keep the ffmpeg two-pass palette GIF recipe (fps 10, lanczos, scale 0.5 on retina) or use a Swift GIF encoder.
- "Instant link": compute the final public URL before upload (deterministic S3 key) and copy it immediately, mirroring Droplr.
- Zip folders/multi-selection with `zip -r -9 -D -x '*.DS_Store'` or `NSFileCoordinator` zip.

## 12. Unknowns
- Exact default of `DroplrNotificationSoundName`, `DrawActive`, `DroplrRecordSound` and the visible labels for the last two.
- Maximum recording duration (none found).
- Whether the "Share recording as…" confirmation popover is still reachable.
- Exact per-colour RGB values of the 9 annotation colours (loaded from literals; count is certain).
- Default annotation tool (type index 4) mapping.
- Font size points for Small/Medium/Large/Ginormous.

## 13. Droplr server protocol (summary only)
REST API (DroplrKit) with token auth (`X-Droplr-Authorization: Bearer …`), endpoints for files (meta then data, chunked multipart `files/part/<id>/<n>`), links, notes, drops (list with filters since/type/sort/search, get, update title/privacy/self destruct, delete), account, push registration, in-app purchase status. Web dashboard and auth via `d.pr`/`auth.droplr.com`. Error details in `droplr-errordetails` header; HTTP 401 → signed out, 402 → upload limit or expired subscription. Not relevant to an S3-backed rebuild beyond the UX it implies.
