import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { createLogger } from './src/logger.js';

const region = process.env.AWS_REGION || 'ap-southeast-1';
const bucket = process.env.MEDIA_BUCKET;
const signedUrlExpiry = Number.parseInt(process.env.SIGNED_URL_EXPIRY || '3600', 10);

const s3Client = new S3Client({ region });

const CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,DELETE'
};

const ALLOWED_FOLDERS = ['products', 'profiles', 'categories', 'banners'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const buildResponse = (statusCode, body) => ({
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body)
});

const getExtension = (filename) => {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
};

export const handler = async (event) => {
    const logger = createLogger(event);
    logger.info('Received event');

    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    try {
        // 4) GET /health
        if (method === 'GET' && path === '/media/health') {
            return buildResponse(200, { service: 'media-service', status: 'healthy' });
        }

        // 1) POST /media/upload-url
        if (method === 'POST' && path === '/media/upload-url') {
            if (!event.body) {
                return buildResponse(400, { success: false, message: 'Missing body' });
            }

            let body;
            try {
                body = JSON.parse(event.body);
            } catch (err) {
                return buildResponse(400, { success: false, message: 'Invalid JSON' });
            }

            const { folder, fileName, contentType } = body;

            if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
                return buildResponse(400, { success: false, message: 'Invalid or missing folder' });
            }
            if (!fileName) {
                return buildResponse(400, { success: false, message: 'Missing fileName' });
            }
            if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
                return buildResponse(400, { success: false, message: 'Invalid or unsupported content type' });
            }

            const uuid = randomUUID();
            const extension = getExtension(fileName);
            const key = `${folder}/${uuid}${extension}`;

            const command = new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                ContentType: contentType
            });

            const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: signedUrlExpiry });
            
            logger.info('Generated upload URL', { key, contentType });
            return buildResponse(200, { success: true, uploadUrl, key, expiresIn: signedUrlExpiry });
        }

        // 2) GET /media/download-url
        if (method === 'GET' && path === '/media/download-url') {
            const queryParams = event.queryStringParameters || {};
            const key = queryParams.key;

            if (!key) {
                return buildResponse(400, { success: false, message: 'Missing key' });
            }

            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: key
            });

            const url = await getSignedUrl(s3Client, command, { expiresIn: signedUrlExpiry });
            
            logger.info('Generated download URL', { key });
            return buildResponse(200, { success: true, url });
        }

        // 3) DELETE /media
        if (method === 'DELETE' && path === '/media') {
            if (!event.body) {
                return buildResponse(400, { success: false, message: 'Missing body' });
            }

            let body;
            try {
                body = JSON.parse(event.body);
            } catch (err) {
                return buildResponse(400, { success: false, message: 'Invalid JSON' });
            }

            const { key } = body;
            if (!key) {
                return buildResponse(400, { success: false, message: 'Missing key' });
            }

            const command = new DeleteObjectCommand({
                Bucket: bucket,
                Key: key
            });

            await s3Client.send(command);
            
            logger.info('Deleted media object', { key });
            return buildResponse(200, { success: true, message: 'Media deleted successfully.' });
        }

        // Unknown route
        logger.warn('Route not found', { path, method });
        return buildResponse(404, { success: false, message: 'Not Found' });

    } catch (error) {
        logger.error('Internal Server Error', { error: error.message, stack: error.stack });
        return buildResponse(500, { success: false, message: 'Internal Server Error' });
    }
};
