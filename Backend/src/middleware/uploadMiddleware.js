import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}


// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

// Maximum file size (5 MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(uploadsDir, file.mimetype.split('/')[0]);
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${Date.now()}${ext}`);
    }
});


const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'), false);
    }
    cb(null, true);
};


const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});

export const uploadSingle = upload.single('avatar');