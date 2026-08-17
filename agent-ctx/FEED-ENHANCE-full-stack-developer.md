# FEED-ENHANCE — Feed enhancements

## Task
Fix photo display in production (R2), add camera capture + PDF upload to feed-poster, add send target selector, and PDF display cards in feed displays.

## Files modified
- `src/components/profesor/feed-poster.tsx`
- `src/components/representante/representante-feed.tsx`
- `src/components/alumno/alumno-feed.tsx`

## Approach
1. **`fileUrl(mediaKey)` helper** added to all three components. Handles three input shapes:
   - `null` → `null`
   - URL starting with `http` or `/api/` → returned as-is
   - Path starting with `/` → `/api/files{path}` (e.g. `/uploads/x.jpg` → `/api/files/uploads/x.jpg`)
   - Plain key like `uploads/abc.jpg` → `/api/files/uploads/abc.jpg`
   This routes every media reference through the R2/filesystem-serving route so production reads from R2.

2. **PDF detection** via shared `isPdf(mediaKey, tipo)` helper — true when `tipo === 'pdf'` OR `mediaKey` ends with `.pdf`.

3. **Feed display** (representante + alumno):
   - tipo `foto`: renders `<img>` with `src={fileUrl(mediaKey)}` inside bordered container.
   - tipo `pdf` / `.pdf` keys: renders a rose-themed PDF card with icon, filename (derived from `mediaKey.split('/').pop()`), and a "Ver PDF" button linking to `/api/files/{mediaKey}` with `target="_blank"`.
   - Other tipos with mediaKey: shows a muted "Archivo adjunto" note (alumno-feed only).

4. **feed-poster.tsx enhancements**:
   - Added `'pdf'` to the Tipo union and tipoConfig (rose theme, `FileType` icon since lucide-react has no `FilePdf`).
   - Tipo picker is now 4 columns (texto / foto / aviso / pdf).
   - Switching tipo clears the currently selected file.
   - File input attrs are dynamic:
     - `tipo === 'foto'`: `accept="image/*" capture="environment"` — enables mobile camera capture.
     - `tipo === 'pdf'`: `accept=".pdf,application/pdf"`.
     - Both enforce a 15MB max (matching the upload route's MAX_SIZE).
   - Preview differs by tipo:
     - foto: `<img>` data URL thumbnail.
     - pdf: rose-themed card with `FilePdf` icon, filename, size in MB.
   - **Send target selector** added: `Select` with options `representantes` (default), `alumnos`, `ambos` (icons via `Users`). The chosen value is sent as `destinatarios` in the POST body.
   - Post body now includes `destinatarios` field; per task rules, the existing API route is not modified (unknown fields are ignored).
   - Recent posts list now shows the "Para: {label}" footer (read from `p.destinatarios`).
   - File input id renamed from `photo-input` to `media-input` to reflect generic usage.
   - State renames: `photoFile`/`photoPreview` → `mediaFile`/`mediaPreview`. Max image size raised from 5MB → 15MB to match the API.

5. **Icon caveat**: initial version used `FilePdf` from lucide-react which is not exported in this installed version. Replaced with `FileType` (which exists) across all three files via sed.

## Lint
`bun run lint` passes clean (no errors, no warnings).

## Dev server
After fix, `GET /` returns 200 in 349ms (verified via curl + dev.log).

## Notes / Caveats
- The existing `/api/profesor/feed` POST route is not modified per task rules. It will silently ignore the `destinatarios` field. If students should actually receive notifications, the API needs a separate update (out of scope here).
- The `destinatarios` value is still sent in the request body so the field is ready for when the API supports it.
- All text labels are Spanish (es-VE): "Enviar a", "Ambos", "Ver PDF", "Para:", etc.
- Color theme is emerald/teal for primary actions and rose for PDF-related UI accents.
