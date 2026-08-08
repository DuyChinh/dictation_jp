# Raw source moved

JLPT N2 12/2025 content lives in the published package (not bundled by Vite):

- `content/jlpt/n2/2025-12/listening.json` — canonical schema
- `content/jlpt/n2/2025-12/listening.mp3`
- `content/jlpt/n2/2025-12/source.v4.json` — raw import source
- Choice images on Cloudinary (URLs in `listening.json` / `choice-image-urls.json`)

Regenerate:

```bash
npm run content:upload-images
npm run content:adapt-n2
npm run content:validate
```
