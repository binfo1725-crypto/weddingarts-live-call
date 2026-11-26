// OmniSix AI — Cloud Media Offload Store (MongoDB GridFS + Local Persistent Fallback + Optional Cloudinary)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let GridFSBucket = null;
try {
  GridFSBucket = require('mongodb').GridFSBucket;
} catch (_) {}

const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/var/data') ? '/var/data' : path.join(__dirname, 'data'));
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

class MediaStore {
  constructor() {
    this.bucket = null;
    if (!fs.existsSync(MEDIA_DIR)) {
      try { fs.mkdirSync(MEDIA_DIR, { recursive: true }); } catch (_) {}
    }
  }

  initGridFs(mongoDb) {
    if (!mongoDb || !GridFSBucket) {
      this.bucket = null;
      return;
    }
    try {
      this.bucket = new GridFSBucket(mongoDb, { bucketName: 'omnisix_media' });
    } catch (e) {
      console.warn('[media-store] GridFS init warning:', e.message);
      this.bucket = null;
    }
  }

  _sanitizeMime(mimeType) {
    return String(mimeType || 'application/octet-stream').split(';')[0].trim().slice(0, 80) || 'application/octet-stream';
  }

  _decodeInput(input, fallbackMime = 'image/jpeg') {
    if (Buffer.isBuffer(input)) {
      return { buffer: input, mimeType: this._sanitizeMime(fallbackMime) };
    }
    const str = String(input || '');
    const match = /^data:([^;]+);base64,(.+)$/s.exec(str);
    if (match) {
      return {
        buffer: Buffer.from(match[2], 'base64'),
        mimeType: this._sanitizeMime(match[1])
      };
    }
    return {
      buffer: Buffer.from(str, 'base64'),
      mimeType: this._sanitizeMime(fallbackMime)
    };
  }

  async _tryCloudinaryUpload(buffer, mimeType, mediaId) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) return null;
    try {
      const form = new FormData();
      form.append('upload_preset', preset);
      form.append('public_id', mediaId);
      form.append('file', new Blob([buffer], { type: mimeType }), `${mediaId}.${mimeType.split('/')[1] || 'bin'}`);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(15000)
      });
      const data = await res.json();
      if (res.ok && data && data.secure_url) {
        return data.secure_url;
      }
    } catch (e) {
      console.warn('[media-store] Cloudinary upload warning:', e.message);
    }
    return null;
  }

  async saveMedia(input, mimeType = 'image/jpeg', meta = {}) {
    const { buffer, mimeType: resolvedMime } = this._decodeInput(input, mimeType);
    if (!buffer || buffer.length === 0) {
      return { ok: false, error: 'Empty media payload' };
    }

    const mediaId = 'med_' + crypto.randomBytes(12).toString('hex');

    // Optional external Cloudinary offload when configured
    const cloudinaryUrl = await this._tryCloudinaryUpload(buffer, resolvedMime, mediaId);
    if (cloudinaryUrl) {
      return {
        ok: true,
        id: mediaId,
        url: cloudinaryUrl,
        mimeType: resolvedMime,
        bytes: buffer.length,
        storage: 'cloudinary'
      };
    }

    // Write local persistent copy so reads never fail cleanly
    try {
      if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
      fs.writeFileSync(path.join(MEDIA_DIR, `${mediaId}.bin`), buffer);
      fs.writeFileSync(
        path.join(MEDIA_DIR, `${mediaId}.json`),
        JSON.stringify({ id: mediaId, mimeType: resolvedMime, bytes: buffer.length, createdAt: new Date().toISOString(), ...meta }),
        'utf8'
      );
    } catch (e) {
      console.warn('[media-store] Local disk write warning:', e.message);
    }

    // Offload asynchronously or await GridFS upload when MongoDB Atlas is active
    let storage = 'disk';
    if (this.bucket) {
      try {
        await new Promise((resolve, reject) => {
          const uploadStream = this.bucket.openUploadStream(mediaId, {
            metadata: { mediaId, mimeType: resolvedMime, ...meta }
          });
          uploadStream.on('finish', resolve);
          uploadStream.on('error', reject);
          uploadStream.end(buffer);
        });
        storage = 'gridfs';
      } catch (gErr) {
        console.warn('[media-store] GridFS offload warning:', gErr.message);
      }
    }

    return {
      ok: true,
      id: mediaId,
      url: `/api/media/${mediaId}`,
      mimeType: resolvedMime,
      bytes: buffer.length,
      storage
    };
  }

  async getMedia(mediaId) {
    if (!mediaId || !SAFE_ID_RE.test(mediaId)) return null;

    // 1. Check local disk cache first for sub-millisecond reads
    const binPath = path.join(MEDIA_DIR, `${mediaId}.bin`);
    const metaPath = path.join(MEDIA_DIR, `${mediaId}.json`);
    if (fs.existsSync(binPath)) {
      let mimeType = 'application/octet-stream';
      try {
        if (fs.existsSync(metaPath)) {
          mimeType = JSON.parse(fs.readFileSync(metaPath, 'utf8')).mimeType || mimeType;
        }
      } catch (_) {}
      return {
        id: mediaId,
        buffer: fs.readFileSync(binPath),
        mimeType,
        storage: 'disk'
      };
    }

    // 2. Fetch from MongoDB GridFS (survives ephemeral Render container restarts)
    if (this.bucket) {
      try {
        const files = await this.bucket.find({ filename: mediaId }).limit(1).toArray();
        if (files && files.length > 0) {
          const doc = files[0];
          const chunks = [];
          await new Promise((resolve, reject) => {
            const ds = this.bucket.openDownloadStream(doc._id);
            ds.on('data', c => chunks.push(c));
            ds.on('end', resolve);
            ds.on('error', reject);
          });
          const buffer = Buffer.concat(chunks);
          const mimeType = (doc.metadata && doc.metadata.mimeType) || 'application/octet-stream';
          // Warm local disk cache cleanly
          try {
            if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
            fs.writeFileSync(binPath, buffer);
            fs.writeFileSync(metaPath, JSON.stringify({ id: mediaId, mimeType, bytes: buffer.length }), 'utf8');
          } catch (_) {}
          return { id: mediaId, buffer, mimeType, storage: 'gridfs' };
        }
      } catch (gErr) {
        console.warn('[media-store] GridFS read warning:', gErr.message);
      }
    }

    return null;
  }
}

module.exports = new MediaStore();
