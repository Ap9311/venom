/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Compresses an image file and converts it into a web-optimized Base64 WebP/JPEG string
 * of professional high sharpness to ensure extreme loading speed and fit in Firestore.
 */
export function compressImageToBase64(file: File, maxDimension: number = 1080, quality: number = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while resizing down
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context could not be created'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Try to export as image/webp, fallback to image/jpeg if not supported
        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          // If browser doesn't support webp, toDataURL will fallback to image/png which might be huge,
          // so check if the size is optimized or export as jpeg.
          if (webpData.startsWith('data:image/webp')) {
            resolve(webpData);
          } else {
            const jpegData = canvas.toDataURL('image/jpeg', quality);
            resolve(jpegData);
          }
        } catch (e) {
          const fallbackData = canvas.toDataURL('image/jpeg', quality);
          resolve(fallbackData);
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
