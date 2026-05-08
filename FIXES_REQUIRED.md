# entropy-cli — Fix & Improvement Requests

> Reviewed by: Senior Code Review (Claude)
> Target: AI agent (Antigravity or equivalent)
> Priority order: 🔴 Bugs first → 🟡 Improvements → 🔵 Polish

---

## 🔴 BUG #1 — Headless progress goroutine race condition

**File:** `main.go`
**Functions:** `runHeadlessURL()`, `runHeadlessFile()`

**Problem:**
The goroutine reading from `ch` runs concurrently but there is no synchronisation
waiting for it to finish before the function continues to the next URL or returns.
The main function can print the next URL's output before the previous goroutine
finishes printing its progress lines.

**Fix:**
Wrap the progress goroutine in a `sync.WaitGroup` and call `wg.Wait()` after
`ingest.Download()` returns, before moving to the next item.

```go
// Example fix for runHeadlessURL and runHeadlessFile:
var wg sync.WaitGroup
ch := make(chan ingest.Progress)

wg.Add(1)
go func() {
    defer wg.Done()
    for p := range ch {
        fmt.Printf("\r  %s", p.Status)
        if p.Speed != "" {
            fmt.Printf("  %s", p.Speed)
        }
    }
    fmt.Println()
}()

if err := ingest.Download(r.URL, opts, ch); err != nil {
    fmt.Fprintf(os.Stderr, "\nerror: %v\n", err)
}
wg.Wait() // ← ADD THIS
```

Apply the same pattern to `runHeadlessFile()`.

---

## 🔴 BUG #2 — aria2c user-agent quoting breaks on Windows

**File:** `internal/ingest/engine.go`
**Function:** `Download()`

**Problem:**
The aria2c downloader args string contains escaped quotes around the user-agent:
```go
aria2Args := fmt.Sprintf("aria2c:-x %d -s %d -j %d -c --user-agent=\"%s\"",
    opt.Connections, opt.Splits, opt.Connections, opt.UserAgent)
```
The `\"` escaping is interpreted differently on Windows command line vs Linux shell,
causing aria2c to receive malformed arguments and fail silently or error.

**Fix:**
Remove the inner quotes around the user-agent value:
```go
aria2Args := fmt.Sprintf("aria2c:-x %d -s %d -j %d -c --user-agent=%s",
    opt.Connections, opt.Splits, opt.Connections, opt.UserAgent)
```

---

## 🔴 BUG #3 — Vault audio extension check is case-sensitive

**File:** `tui/vault.go`

**Problem:**
The `audioExtensions` map uses lowercase keys:
```go
var audioExtensions = map[string]bool{
    ".mp3": true,
    ".flac": true,
    // etc.
}
```
If the file scan does not lowercase the extension before lookup, files with
uppercase or mixed-case extensions (`.MP3`, `.FLAC`, `.M4A`) will be silently
excluded from the vault. This is a real issue on Windows and for files
downloaded by other tools.

**Fix:**
Wherever `audioExtensions` is checked, ensure the extension is lowercased first:
```go
ext := strings.ToLower(filepath.Ext(f.Name()))
if audioExtensions[ext] {
    // include file
}
```
Apply this consistently everywhere `audioExtensions` is used for lookup.

---

## 🔴 BUG #4 — `cmd.Wait()` error incorrectly marks successful downloads as failed

**File:** `internal/ingest/engine.go`
**Function:** `Download()`

**Problem:**
`yt-dlp` frequently exits with a non-zero status code even when the download
succeeds (e.g. when it emits warnings about unavailable formats, skipping
already-downloaded files, or minor extractor issues). Returning `cmd.Wait()`'s
error directly causes successful downloads to be reported as failures in the TUI.

**Fix:**
After `cmd.Wait()`, check if the output file actually exists before deciding
whether to return an error. If the file is present and non-empty, treat the
download as successful regardless of exit code:

```go
err = cmd.Wait()
wg.Wait()
close(progressChan)

// If yt-dlp exited non-zero but a file was written, treat as success
if err != nil {
    // Check output dir for any file modified in the last few seconds
    // If found, suppress the error — yt-dlp warnings are not failures
    if fileWasWritten(opt.DestinationPath) {
        return nil
    }
}
return err
```

Alternatively, only return errors when `stdout` was completely empty AND
`stderr` contains a line starting with `ERROR:`.

---

## 🟡 IMPROVEMENT #1 — Remove or make `--remote-components` optional

**File:** `internal/ingest/engine.go`
**Functions:** `Search()`, `FetchInfo()`, `Download()`

**Problem:**
All three functions pass `--remote-components ejs:github` to yt-dlp. This is
a non-standard or version-specific flag that does not exist in all yt-dlp
installations. On versions that don't support it, yt-dlp will error with an
unrecognised option and the entire operation fails.

**Fix:**
Either remove this flag entirely, or probe for yt-dlp version support at
startup and conditionally include it:

```go
// Option A — remove entirely if not strictly required
// Option B — version gate it
func supportsRemoteComponents() bool {
    out, err := runYtDlp("--version")
    if err != nil {
        return false
    }
    // Parse version string, return true only if >= required version
    return versionAtLeast(strings.TrimSpace(out), "2024.01.01")
}
```

If this flag is genuinely required for correct operation, document why in a
code comment so future maintainers understand the dependency.

---

## 🟡 IMPROVEMENT #2 — `--download-archive` should not apply to Search

**File:** `internal/ingest/engine.go`
**Function:** `Search()`

**Problem:**
Passing `--download-archive` to yt-dlp during search queries causes yt-dlp to
check the archive file and suppress results for tracks that have already been
downloaded. This means tracks the user may want to re-download or simply browse
are silently hidden from search results, which is confusing UX.

**Fix:**
Remove the `--download-archive` flag from `Search()`. Keep it only in
`Download()` and optionally `FetchInfo()`:

```go
// In Search() — REMOVE these lines:
if archive := config.ArchivePath(); archive != "" {
    args = append(args, "--download-archive", archive)
}
```

---

## 🟡 IMPROVEMENT #3 — Settings UI missing Connections and Splits fields

**File:** `tui/settings.go`

**Problem:**
`config.Config` exposes `Connections` and `Splits` as user-configurable values,
and they are correctly written to the TOML config file. However, the Settings
TUI only exposes `OutputDir`, `Quality`, and `MaxConcurrent`. Users cannot
change connection/split counts without manually editing the config file.

**Fix:**
Add two more `textinput.Model` fields to `SettingsModel` for `Connections` and
`Splits`, with appropriate validation (must be positive integer):

```go
// Add to NewSettingsModel():
m.Inputs[3] = textinput.New()
m.Inputs[3].Placeholder = "Parallel Connections (aria2c -x)"
m.Inputs[3].Prompt = " Connections: "
m.Inputs[3].SetValue(strconv.Itoa(config.C.Connections))

m.Inputs[4] = textinput.New()
m.Inputs[4].Placeholder = "File Splits (aria2c -s)"
m.Inputs[4].Prompt = "      Splits: "
m.Inputs[4].SetValue(strconv.Itoa(config.C.Splits))
```

Update `save()` to parse and validate these fields before writing to config.

---

## 🟡 IMPROVEMENT #4 — Settings Quality field has no validation

**File:** `tui/settings.go`
**Function:** `save()`

**Problem:**
The Quality input accepts any string. If the user types an unsupported format
(e.g. `wav`, `aiff`, `garbage`), yt-dlp will error at download time with a
cryptic message. The error should be caught at save time.

**Fix:**
Validate the quality value in `save()` before writing:

```go
validQualities := map[string]bool{
    "mp3": true, "flac": true, "opus": true, "m4a": true, "aac": true,
}
quality := strings.ToLower(strings.TrimSpace(m.Inputs[1].Value()))
if !validQualities[quality] {
    return fmt.Errorf("unsupported format %q — use: mp3, flac, opus, m4a, aac", quality)
}
config.C.Quality = quality
```

---

## 🟡 IMPROVEMENT #5 — OutputDir does not expand `~`

**File:** `tui/settings.go` and `internal/config/config.go`

**Problem:**
If the user types `~/Music` or `~/Downloads` in the OutputDir settings field,
the tilde is not expanded to the actual home directory path. The directory will
be created literally as `~/Music` which is not a valid path on Windows and is
unexpected on Linux.

**Fix:**
Add a helper function that expands `~` at the start of a path:

```go
func expandHome(path string) string {
    if !strings.HasPrefix(path, "~") {
        return path
    }
    home, err := os.UserHomeDir()
    if err != nil {
        return path
    }
    return filepath.Join(home, path[1:])
}
```

Call `expandHome()` when reading `output_dir` from config and when saving from
the Settings UI.

---

## 🔵 POLISH #1 — Add `--no-playlist` safety to direct URL downloads

**File:** `internal/ingest/engine.go`
**Function:** `Download()`

**Problem:**
If a user pastes a YouTube video URL that happens to be part of a playlist
(e.g. `youtube.com/watch?v=xxx&list=yyy`), yt-dlp may download the entire
playlist instead of just the single track. This is unexpected behaviour.

**Fix:**
Add `--no-playlist` to the `Download()` args by default, or expose a playlist
mode toggle. For audio downloads especially, single-track behaviour should be
the default:

```go
// In Download() args, add:
"--no-playlist",
```

If playlist download is desired, it should be an explicit opt-in via
`DownloadOptions`.

---

## 🔵 POLISH #2 — Dependency check at startup

**File:** `main.go`

**Problem:**
If `yt-dlp`, `aria2c`, or `ffmpeg` are not in PATH, the app starts fine but
fails silently or with a cryptic error only when the user tries to download.
This is a poor experience, especially for new users.

**Fix:**
Add a startup dependency check before launching the TUI:

```go
func checkDependencies() []string {
    var missing []string
    for _, bin := range []string{"yt-dlp", "aria2c", "ffmpeg"} {
        if _, err := exec.LookPath(bin); err != nil {
            missing = append(missing, bin)
        }
    }
    return missing
}
```

If any are missing, print a clear message before launching the TUI:
```
[entropy-cli] WARNING: missing dependencies: aria2c, ffmpeg
  Downloads may fail. Install them and ensure they are in your PATH.
```

---

## 🔵 POLISH #3 — Add binary targets to `.gitignore`

**File:** `.gitignore` (root)

**Problem:**
Compiled binaries (`entropy-cli`, `entropy-cli-test`) have previously been
committed to the repository. This bloats git history and causes unnecessary
diffs on every build.

**Fix:**
Ensure `.gitignore` contains:
```
# Compiled binaries
entropy-cli
entropy-cli-test
entropy-cli.exe
entropy-cli-test.exe
```

---

## Summary Table

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | 🔴 Bug | `main.go` | Headless goroutine race condition |
| 2 | 🔴 Bug | `engine.go` | aria2c Windows quoting |
| 3 | 🔴 Bug | `vault.go` | Case-sensitive extension check |
| 4 | 🔴 Bug | `engine.go` | False error on successful download |
| 5 | 🟡 Improve | `engine.go` | Remove/gate `--remote-components` |
| 6 | 🟡 Improve | `engine.go` | Archive flag on Search |
| 7 | 🟡 Improve | `settings.go` | Missing Connections/Splits fields |
| 8 | 🟡 Improve | `settings.go` | Quality validation |
| 9 | 🟡 Improve | `settings.go` + `config.go` | Tilde expansion in paths |
| 10 | 🔵 Polish | `engine.go` | `--no-playlist` default |
| 11 | 🔵 Polish | `main.go` | Dependency check at startup |
| 12 | 🔵 Polish | `.gitignore` | Binary files in git |

---

*Fix in priority order: 🔴 first, then 🟡, then 🔵.*
*All fixes should maintain existing behaviour for working features.*
*Do not refactor working code while fixing — surgical changes only.*
