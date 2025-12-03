/**
 * File Storage Service
 *
 * Handles local filesystem storage for the Vault module.
 * Files are stored in: {UPLOAD_DIR}/vault/{company_id}/{filename}
 */

import {
	createReadStream,
	createWriteStream,
	existsSync,
	mkdirSync,
	unlinkSync,
	statSync,
} from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";

const VAULT_BUCKET = "vault";

export interface UploadResult {
	filename: string;
	originalName: string;
	path: string[];
	size: number;
	mimetype: string;
}

export interface FileInfo {
	exists: boolean;
	size?: number;
	path?: string;
	mimetype?: string;
}

/**
 * Get the base upload directory for vault files
 */
export function getVaultBaseDir(): string {
	return join(env.UPLOAD_DIR, VAULT_BUCKET);
}

/**
 * Get the full path for a company's vault directory
 */
export function getCompanyVaultDir(companyId: string): string {
	return join(getVaultBaseDir(), companyId);
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDirectoryExists(dirPath: string): void {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}
}

/**
 * Generate a unique filename while preserving the extension
 */
export function generateUniqueFilename(originalName: string): string {
	const ext = extname(originalName);
	const uniqueId = randomUUID();
	const timestamp = Date.now();
	return `${timestamp}-${uniqueId}${ext}`;
}

/**
 * Get the full filesystem path from path tokens
 */
export function getFullPath(pathTokens: string[]): string {
	return join(getVaultBaseDir(), ...pathTokens);
}

/**
 * Upload a file to the vault
 */
export async function uploadFile(
	companyId: string,
	file: File | Blob,
	originalName: string,
): Promise<UploadResult> {
	const companyDir = getCompanyVaultDir(companyId);
	ensureDirectoryExists(companyDir);

	const filename = generateUniqueFilename(originalName);
	const filePath = join(companyDir, filename);
	const pathTokens = [companyId, filename];

	// Convert File/Blob to ArrayBuffer and write to disk
	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	const writeStream = createWriteStream(filePath);
	writeStream.write(buffer);
	writeStream.end();

	await new Promise<void>((resolve, reject) => {
		writeStream.on("finish", resolve);
		writeStream.on("error", reject);
	});

	const stats = statSync(filePath);

	return {
		filename,
		originalName,
		path: pathTokens,
		size: stats.size,
		mimetype: file.type || "application/octet-stream",
	};
}

/**
 * Upload a file from a readable stream
 */
export async function uploadFileFromStream(
	companyId: string,
	stream: NodeJS.ReadableStream,
	originalName: string,
	mimetype: string,
): Promise<UploadResult> {
	const companyDir = getCompanyVaultDir(companyId);
	ensureDirectoryExists(companyDir);

	const filename = generateUniqueFilename(originalName);
	const filePath = join(companyDir, filename);
	const pathTokens = [companyId, filename];

	const writeStream = createWriteStream(filePath);
	await pipeline(stream, writeStream);

	const stats = statSync(filePath);

	return {
		filename,
		originalName,
		path: pathTokens,
		size: stats.size,
		mimetype,
	};
}

/**
 * Delete a file from the vault
 */
export async function deleteFile(pathTokens: string[]): Promise<boolean> {
	const filePath = getFullPath(pathTokens);

	if (!existsSync(filePath)) {
		return false;
	}

	try {
		unlinkSync(filePath);
		return true;
	} catch (error) {
		serviceLogger.error(error, "Error deleting file:");
		return false;
	}
}

/**
 * Get file information
 */
export function getFileInfo(pathTokens: string[]): FileInfo {
	const filePath = getFullPath(pathTokens);

	if (!existsSync(filePath)) {
		return { exists: false };
	}

	try {
		const stats = statSync(filePath);
		return {
			exists: true,
			size: stats.size,
			path: filePath,
		};
	} catch {
		return { exists: false };
	}
}

/**
 * Create a readable stream for a file
 */
export function createFileReadStream(
	pathTokens: string[],
): NodeJS.ReadableStream | null {
	const filePath = getFullPath(pathTokens);

	if (!existsSync(filePath)) {
		return null;
	}

	return createReadStream(filePath);
}

/**
 * Read file as buffer
 */
export async function readFileAsBuffer(
	pathTokens: string[],
): Promise<Buffer | null> {
	const filePath = getFullPath(pathTokens);

	if (!existsSync(filePath)) {
		return null;
	}

	const { readFile } = await import("node:fs/promises");
	return readFile(filePath);
}

/**
 * List files in a company's vault directory
 */
export async function listCompanyFiles(companyId: string): Promise<string[]> {
	const companyDir = getCompanyVaultDir(companyId);

	if (!existsSync(companyDir)) {
		return [];
	}

	try {
		const files = await readdir(companyDir);
		return files;
	} catch {
		return [];
	}
}

/**
 * Delete all files for a company
 */
export async function deleteCompanyFiles(companyId: string): Promise<boolean> {
	const companyDir = getCompanyVaultDir(companyId);

	if (!existsSync(companyDir)) {
		return true;
	}

	try {
		await rm(companyDir, { recursive: true, force: true });
		return true;
	} catch (error) {
		serviceLogger.error(error, "Error deleting company files:");
		return false;
	}
}

/**
 * Get the MIME type based on file extension
 */
export function getMimeType(filename: string): string {
	const ext = extname(filename).toLowerCase();
	const mimeTypes: Record<string, string> = {
		// Images
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".png": "image/png",
		".gif": "image/gif",
		".webp": "image/webp",
		".heic": "image/heic",
		".heif": "image/heif",
		".avif": "image/avif",
		".svg": "image/svg+xml",
		// Documents
		".pdf": "application/pdf",
		".doc": "application/msword",
		".docx":
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		".odt": "application/vnd.oasis.opendocument.text",
		".xls": "application/vnd.ms-excel",
		".xlsx":
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		".ods": "application/vnd.oasis.opendocument.spreadsheet",
		".ppt": "application/vnd.ms-powerpoint",
		".pptx":
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		".odp": "application/vnd.oasis.opendocument.presentation",
		// Text
		".txt": "text/plain",
		".csv": "text/csv",
		".md": "text/markdown",
		".rtf": "application/rtf",
		// Archives
		".zip": "application/zip",
		".rar": "application/vnd.rar",
		".7z": "application/x-7z-compressed",
	};

	return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Check if a MIME type is supported for upload
 */
export function isSupportedMimeType(mimetype: string): boolean {
	const supportedTypes = [
		// Images
		"image/jpeg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/heic",
		"image/heif",
		"image/avif",
		// Documents
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.oasis.opendocument.text",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/vnd.oasis.opendocument.spreadsheet",
		"application/vnd.ms-powerpoint",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"application/vnd.oasis.opendocument.presentation",
		// Text
		"text/plain",
		"text/csv",
		"text/markdown",
		"application/rtf",
		// Archives
		"application/zip",
	];

	return supportedTypes.includes(mimetype);
}

/**
 * Validate file size
 */
export function isValidFileSize(size: number): boolean {
	return size > 0 && size <= env.MAX_FILE_SIZE;
}

/**
 * Get a signed/temporary URL for a file (for local dev, just returns the API download path)
 */
export function getSignedUrl(
	pathTokens: string[],
	expiresIn: number = 3600,
): string {
	// For local filesystem, we'll use the API download endpoint
	// In production with cloud storage, this would generate a pre-signed URL
	const filePath = pathTokens.join("/");
	return `/api/v1/documents/download/${filePath}`;
}

/**
 * Initialize the vault storage directory
 */
export function initializeVaultStorage(): void {
	const vaultDir = getVaultBaseDir();
	ensureDirectoryExists(vaultDir);
	console.log(`✅ Vault storage initialized at: ${vaultDir}`);
}
