# Deployed image recovery

Pawfolio's deployed public photos and private documents live in the existing
Supabase buckets. Render redeployments do not remove those objects. Keep
`UPLOAD_STORAGE=supabase` and the validated S3 credentials configured on Render;
follow [upload-storage.md](upload-storage.md) for environment setup.

The image repair command restores referenced originals from a local backup,
recreates explicitly named demo pet photos from bundled samples, and restores
explicitly synthetic demo IDs. It never invents personal IDs or verification
photos. Originals that cannot be recovered need a backup or an owner re-upload.

Run from `backend` with both Supabase disks configured:

```sh
php artisan pawfolio:repair-images --source=/absolute/path/to/upload-backup --fill-empty
php artisan pawfolio:repair-images --source=/absolute/path/to/upload-backup --fill-empty --write
```

The source must contain `public` and `private` directories. The first command
reports changes without writing. The second applies them. Existing objects are
skipped, sources are retained, and rerunning is safe. Empty pet/home covers and
home avatars receive illustrated defaults; existing profile images stay intact.
Database updates only apply while the field still has its original empty value,
so a concurrent real upload wins. Original field values are backed up to
`operations/image-repairs/<uuid>.json` on the private disk before changes.

Default PNG filenames include their content hash, so a replacement asset gets
a new URL and cannot reuse a cached previous version. Their source files live
in `backend/resources/images/defaults/`. The cover and avatar are generic
illustrations, not photographs of actual members or their pets.

After repair, check all referenced public URLs, Recently Hired, frontend image
optimization, and permission-checked private downloads. Redeploy the existing
Render service and repeat the public checks to verify persistence.

No service or storage setup can promise uninterrupted access during every
network outage or after intentional deletion. Keep original upload backups;
Supabase durability and the existing frontend image error fallback protect
against the previous loss of files from Render's temporary filesystem.

The frontend bundles the same illustrations at `frontend/public/images/defaults/`.
Photo frames, Recently Hired, and feed image tiles use these local images if an
original is missing or both optimized and direct remote loading fail. These
fallbacks bypass the optimizer and do not need Supabase access. The production
API's exact public bucket is also allowed in `next.config.ts` when the optional
storage URL was omitted on an older Vercel deployment; explicit environment
configuration still takes precedence for other storage projects.

## Generated assets

Both assets were generated with the built-in image generation tool. Final prompts:

### Home cover

Use case: illustration-story. Asset type: default wide cover image for Pawfolio, a friendly pet adoption and home profile website. Create a polished editorial illustration of a cozy pet-friendly living room with a comfortable blue sofa, a golden friendly dog relaxing on a cream rug, a gray cat curled on the sofa, leafy house plants and gentle daylight. Style: clean soft hand-drawn shapes with subtle paper texture, navy outlines, powder blue, warm cream and small golden-yellow accents. Landscape aspect ratio 3:1. Keep the dog, cat and sofa in the central horizontal band so the image also works when cropped to a very wide 5:1 header. Clearly an illustration, not a photograph of any actual user or pet. No people, no text, no logo, no watermark.

### Generic profile avatar

Use case: illustration-story. Asset type: square generic profile avatar for Pawfolio pet-adoption home profiles that have no uploaded avatar. An affectionate golden dog and gray tabby cat nestling side by side, close-up head-and-shoulders portrait, both looking gently toward the viewer, centered with generous safe margins for circular cropping. Clearly a hand-drawn editorial illustration, not a real pet photo or real person's identity. Soft painted texture, navy outlines, warm cream background, powder-blue and golden accents, welcoming calm mood, simple readable composition at 48 pixels, no people, no text, no logo, no watermark.
