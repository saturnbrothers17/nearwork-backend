import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';

// Using require for JS module interoperability
const { googleStorage } = require('../../services/drive/googleStorage');

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for Near Work media
});

/**
 * Direct file upload to Google Drive
 */
router.post('/upload', upload.single('file') as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded in form field "file"' });
    }

    const uploadedBy = req.body.uploadedBy || (req as any).user?.id || 'anonymous';
    const metadata = req.body.metadata ? (typeof req.body.metadata === 'string' ? JSON.parse(req.body.metadata) : req.body.metadata) : {};

    const fileData = await googleStorage.uploadFile({
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      buffer: req.file.buffer,
      size: req.file.size,
      uploadedBy,
      metadata
    });

    res.status(201).json({
      success: true,
      message: 'File successfully uploaded to Google Drive storage',
      data: fileData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Resumable upload session creation for direct streaming
 */
router.post('/upload-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename, mimeType } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, message: 'filename is required' });
    }

    const uploadUrl = await googleStorage.getResumableUploadUrl(filename, mimeType || 'application/octet-stream');
    res.status(200).json({
      success: true,
      data: { uploadUrl }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Stream binary media file directly from Google Drive
 */
router.get('/stream/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId } = req.params;
    await googleStorage.streamFile(fileId, res, req);
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a media file from Google Drive
 */
router.delete('/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId } = req.params;
    const result = await googleStorage.deleteFile(fileId);
    res.status(200).json({
      success: true,
      message: 'File deleted from Google Drive',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
