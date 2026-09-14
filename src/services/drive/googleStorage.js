const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { googleDriveSqlEngine } = require('./googleDriveSqlEngine');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config(); // Fallback

class GoogleDriveStorage {
  constructor() {
    this.mediaFolderId = null;
  }

  /**
   * Ensure dedicated media folder or fallback to root folder
   */
  async ensureMediaFolder() {
    if (this.mediaFolderId) return this.mediaFolderId;

    const rootFolderId = await googleDriveSqlEngine.ensureRootFolder();
    if (!rootFolderId) {
      throw new Error('Google Drive root storage folder unavailable');
    }

    try {
      const token = await googleDriveSqlEngine.getAccessToken();
      const res = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          q: `name = 'media_storage' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)'
        },
        timeout: 15000
      });

      if (res.data.files && res.data.files.length > 0) {
        this.mediaFolderId = res.data.files[0].id;
      } else {
        const createRes = await axios.post(
          'https://www.googleapis.com/drive/v3/files',
          {
            name: 'media_storage',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootFolderId]
          },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000
          }
        );
        this.mediaFolderId = createRes.data.id;
      }

      return this.mediaFolderId;
    } catch (err) {
      console.warn('[GoogleDriveStorage] Media folder check failed, using root folder:', err.message);
      this.mediaFolderId = rootFolderId;
      return this.mediaFolderId;
    }
  }

  /**
   * Upload a binary buffer or file stream to Google Drive
   */
  async uploadFile({
    originalname,
    mimetype = 'application/octet-stream',
    buffer,
    filePath,
    size,
    uploadedBy = 'system',
    metadata = {}
  }) {
    try {
      let fileBuffer = buffer;
      if (!fileBuffer && filePath && fs.existsSync(filePath)) {
        fileBuffer = fs.readFileSync(filePath);
      }

      if (!fileBuffer) {
        throw new Error('No file buffer or valid filePath provided for upload');
      }

      const fileSize = size || fileBuffer.length;
      const targetFolderId = await this.ensureMediaFolder();
      const token = await googleDriveSqlEngine.getAccessToken();

      // Multipart boundary definition
      const boundary = `-------NearWorkUploadBoundary${Date.now()}`;
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadataPayload = {
        name: originalname || `file_${Date.now()}`,
        parents: [targetFolderId],
        properties: {
          ...metadata,
          uploadedBy: String(uploadedBy),
          originalName: originalname || 'file',
          uploadedAt: new Date().toISOString()
        }
      };

      const multipartBody = Buffer.concat([
        Buffer.from(
          delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadataPayload) +
            delimiter +
            `Content-Type: ${mimetype}\r\n\r\n`
        ),
        fileBuffer,
        Buffer.from(closeDelimiter)
      ]);

      const response = await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink',
        multipartBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': multipartBody.length
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 60000
        }
      );

      const file = response.data;
      if (!file || !file.id) {
        throw new Error('Google Drive upload did not return a valid file id');
      }

      // Make file readable for web view links
      try {
        await axios.post(
          `https://www.googleapis.com/drive/v3/files/${file.id}/permissions`,
          { role: 'reader', type: 'anyone' },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
          }
        );
      } catch (permErr) {
        // Permissions might be restricted on some domain configs; non-fatal
      }

      const webViewLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
      const directDriveUrl = `https://drive.google.com/uc?export=view&id=${file.id}`;
      const streamUrl = `/api/v1/storage/stream/${file.id}`;

      return {
        fileId: file.id,
        id: file.id,
        filename: originalname || file.name,
        mimeType: file.mimeType || mimetype,
        size: Number(file.size || fileSize),
        webViewLink,
        directDriveUrl,
        streamUrl,
        uploadedAt: new Date().toISOString(),
        uploadedBy
      };
    } catch (err) {
      console.error('[GoogleDriveStorage] Upload failed:', err.response?.data || err.message);
      throw err;
    }
  }

  /**
   * Stream a file directly from Google Drive to an Express response
   */
  async streamFile(fileId, res, req = null) {
    try {
      const token = await googleDriveSqlEngine.getAccessToken();

      // Fetch metadata
      const metaRes = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000
        }
      );
      const meta = metaRes.data;

      const headers = {
        Authorization: `Bearer ${token}`
      };

      if (req && req.headers && req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const driveRes = await axios({
        method: 'GET',
        url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        headers,
        responseType: 'stream',
        timeout: 30000
      });

      res.status(driveRes.status);
      res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
      if (meta.size) {
        res.setHeader('Content-Length', meta.size);
      }
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.name || 'file')}"`);

      driveRes.data.pipe(res);
    } catch (err) {
      console.error('[GoogleDriveStorage] Stream error:', err.response?.data || err.message);
      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          message: 'File not found or cannot be streamed from Google Drive'
        });
      }
    }
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(fileId) {
    try {
      const token = await googleDriveSqlEngine.getAccessToken();
      await axios.delete(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });
      return { success: true, fileId };
    } catch (err) {
      console.error('[GoogleDriveStorage] Failed to delete file:', err.response?.data || err.message);
      throw err;
    }
  }

  /**
   * Generate resumable upload session URL for direct client streaming
   */
  async getResumableUploadUrl(filename, mimeType = 'application/octet-stream') {
    try {
      const targetFolderId = await this.ensureMediaFolder();
      const token = await googleDriveSqlEngine.getAccessToken();

      const metadata = {
        name: filename,
        parents: [targetFolderId]
      };

      const response = await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
        metadata,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': mimeType
          },
          timeout: 20000
        }
      );

      return response.headers['location'];
    } catch (err) {
      console.error('[GoogleDriveStorage] Error generating resumable URL:', err.response?.data || err.message);
      throw new Error('Failed to generate Google Drive upload session');
    }
  }
}

const googleStorage = new GoogleDriveStorage();

module.exports = {
  GoogleDriveStorage,
  googleStorage
};
