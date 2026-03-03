/**
 * File Upload Validation Utilities
 *
 * Provides comprehensive validation for file uploads with support for:
 * - File type validation (images only by default)
 * - File size validation (max 50MB by default)
 * - File count validation (max 20 files by default)
 * - Detailed error messages
 * - Configurable limits
 */

// Constants
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_MAX_FILES = 20;
const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

/**
 * Validation options for file upload
 */
interface ValidationOptions {
  /** Maximum file size in bytes (default: 50MB) */
  maxFileSize?: number;
  /** Maximum number of files (default: 20) */
  maxFiles?: number;
  /** Allowed MIME types (default: image/*) */
  allowedTypes?: string[];
}

/**
 * Result of file validation
 */
interface ValidationResult {
  /** Whether all files are valid */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of valid files */
  validFiles: File[];
  /** List of invalid files with their specific errors */
  invalidFiles: Array<{ file: File; error: string; }>;
}

/**
 * Result of single file validation
 */
interface SingleValidationResult {
  /** Whether the file is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Check if a file is an image based on MIME type
 *
 * Security: Only allows explicit MIME types from IMAGE_TYPES array.
 * Does NOT accept arbitrary image/* types to prevent potentially
 * dangerous formats like image/svg+xml (XSS risk) or image/x-icon.
 */
export function isImageFile(file: File): boolean {
  return IMAGE_TYPES.includes(file.type);
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate a single file against validation options
 */
export function validateFile(
  file: File,
  options: ValidationOptions = {},
): SingleValidationResult {
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_SIZE;
  const allowedTypes = options.allowedTypes ?? IMAGE_TYPES;

  // Validate file type
  const isTypeAllowed = allowedTypes.some(type => {
    if (type.endsWith("/*")) {
      const prefix = type.slice(0, -2);
      return file.type.startsWith(prefix);
    }
    return file.type === type;
  });

  if (!isTypeAllowed) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Only images are allowed.`,
    };
  }

  // Validate file size
  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `File too large: ${formatFileSize(file.size)}. Maximum size is ${
        formatFileSize(maxFileSize)
      }.`,
    };
  }

  // Validate file name exists
  if (!file.name || file.name.trim() === "") {
    return {
      valid: false,
      error: "File must have a valid name.",
    };
  }

  // Validate filename security (path traversal, hidden files, length)
  if (!isSecureFilename(file.name)) {
    // Provide specific error messages based on the security issue
    if (
      file.name.includes("..") || file.name.includes("/")
      || file.name.includes("\\")
    ) {
      return {
        valid: false,
        error: "Insecure filename: path traversal characters are not allowed.",
      };
    }
    if (file.name.startsWith(".")) {
      return {
        valid: false,
        error: "Insecure filename: hidden files (starting with '.') are not allowed.",
      };
    }
    // If isSecureFilename returns false and the above conditions don't match,
    // the only remaining case is filename length > 255 (per isSecureFilename logic)
    return {
      valid: false,
      error: "Insecure filename: name exceeds maximum length of 255 characters.",
    };
  }

  return { valid: true };
}

/**
 * Validate multiple files against validation options
 */
export function validateFiles(
  files: File[] | FileList,
  options: ValidationOptions = {},
): ValidationResult {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const fileArray = Array.from(files);

  const errors: string[] = [];
  const validFiles: File[] = [];
  const invalidFiles: Array<{ file: File; error: string; }> = [];

  // Validate file count
  if (fileArray.length === 0) {
    errors.push("No files selected.");
    return { valid: false, errors, validFiles, invalidFiles };
  }

  if (fileArray.length > maxFiles) {
    errors.push(
      `Too many files: ${fileArray.length}. Maximum is ${maxFiles} files.`,
    );
    return { valid: false, errors, validFiles, invalidFiles };
  }

  // Validate each file
  for (const file of fileArray) {
    const result = validateFile(file, options);
    if (result.valid) {
      validFiles.push(file);
    } else {
      invalidFiles.push({ file, error: result.error! });
      errors.push(`${file.name}: ${result.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validFiles,
    invalidFiles,
  };
}

/**
 * Get a summary message for validation results
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.valid) {
    return `${result.validFiles.length} file(s) ready to upload.`;
  }

  const parts: string[] = [];

  if (result.validFiles.length > 0) {
    parts.push(`${result.validFiles.length} valid file(s)`);
  }

  if (result.invalidFiles.length > 0) {
    parts.push(`${result.invalidFiles.length} invalid file(s)`);
  }

  return parts.join(", ");
}

/**
 * Check if file extension matches expected image extensions
 */
export function hasImageExtension(filename: string): boolean {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const extension = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return imageExtensions.includes(extension);
}

/**
 * Validate file name for security (prevent path traversal, etc.)
 */
export function isSecureFilename(filename: string): boolean {
  // Prevent path traversal
  if (
    filename.includes("..") || filename.includes("/") || filename.includes("\\")
  ) {
    return false;
  }

  // Prevent hidden files
  if (filename.startsWith(".")) {
    return false;
  }

  // Check for reasonable length
  if (filename.length > 255) {
    return false;
  }

  return true;
}
