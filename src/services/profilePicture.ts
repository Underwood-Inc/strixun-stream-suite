/**
 * Profile Picture Service (Post-MVP)
 * 
 * Composable, agnostic service for profile picture management.
 * Handles image upload, conversion to WebP, and storage in Cloudflare R2.
 * 
 * @module services/profilePicture
 * 
 * Architecture Design:
 * - Composable: Can be used independently
 * - Agnostic: Works with any storage backend (R2, S3, etc.)
 * - Strongly Typed: Full TypeScript coverage
 * - Efficient: WebP conversion for optimal file size
 */

export interface ProfilePictureConfig {
  /**
   * API base URL for upload endpoints
   */
  apiUrl: string;
  
  /**
   * Maximum file size (bytes)
   * @default 5MB
   */
  maxFileSize?: number;
  
  /**
   * Target image dimensions
   * @default { width: 200, height: 200 }
   */
  targetDimensions?: {
    width: number;
    height: number;
  };
  
  /**
   * Image quality (0-1)
   * @default 0.85
   */
  quality?: number;
}

export interface ProfilePictureData {
  /**
   * Profile picture URL
   */
  url: string;
  
  /**
   * Upload timestamp
   */
  uploadedAt: string;
  
  /**
   * File size (bytes)
   */
  fileSize: number;
  
  /**
   * Image dimensions
   */
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * Profile Picture Service
 * 
 * Manages profile picture upload and storage
 */
export class ProfilePictureService {
  private config: ProfilePictureConfig;

  constructor(config: ProfilePictureConfig) {
    this.config = {
      maxFileSize: 5 * 1024 * 1024, // 5MB
      targetDimensions: { width: 200, height: 200 },
      quality: 0.85,
      ...config,
    };
  }

  /**
   * Convert image to WebP format
   * 
   * @param file - Image file to convert
   * @returns WebP blob
   */
  async convertToWebP(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        
        img.onload = () => {
          // Create canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Calculate dimensions (maintain aspect ratio)
          const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            this.config.targetDimensions!
          );

          canvas.width = width;
          canvas.height = height;

          // Draw and convert to WebP
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to convert to WebP'));
              }
            },
            'image/webp',
            this.config.quality
          );
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = event.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Calculate target dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    target: { width: number; height: number }
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;
    
    let width = target.width;
    let height = target.height;

    if (originalWidth > originalHeight) {
      // Landscape: fit to width
      height = width / aspectRatio;
    } else {
      // Portrait or square: fit to height
      width = height * aspectRatio;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  /**
   * Validate image file
   * 
   * @param file - File to validate
   * @returns Validation result
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'File must be an image' };
    }

    // Check file size
    if (file.size > this.config.maxFileSize!) {
      const maxMB = (this.config.maxFileSize! / (1024 * 1024)).toFixed(1);
      return { valid: false, error: `File size must be less than ${maxMB}MB` };
    }

    return { valid: true };
  }

  /**
   * Upload profile picture
   * 
   * @param file - Image file to upload
   * @param token - Authentication token
   * @returns Profile picture data
   */
  async uploadProfilePicture(file: File, token: string): Promise<ProfilePictureData> {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid file');
    }

    // Convert to WebP
    const webpBlob = await this.convertToWebP(file);

    // Create FormData
    const formData = new FormData();
    formData.append('image', webpBlob, 'profile.webp');

    // Upload to server
    const response = await fetch(`${this.config.apiUrl}/user/profile-picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.detail || 'Failed to upload profile picture');
    }

    const data = await response.json();
    return data.picture;
  }

  /**
   * Get profile picture URL
   * 
   * @param userId - User ID
   * @returns Profile picture URL or null
   */
  async getProfilePictureUrl(userId: string, token: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.apiUrl}/user/profile-picture/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        return null; // No profile picture
      }

      if (!response.ok) {
        throw new Error('Failed to get profile picture');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('[ProfilePicture] Failed to get URL:', error);
      return null;
    }
  }

  /**
   * Delete profile picture
   * 
   * @param token - Authentication token
   */
  async deleteProfilePicture(token: string): Promise<void> {
    const response = await fetch(`${this.config.apiUrl}/user/profile-picture`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.detail || 'Failed to delete profile picture');
    }
  }
}

