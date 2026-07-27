/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Resizes the image to fit within the specified maxWidth and maxHeight boundaries,
 * keeping the original aspect ratio, and exports it as a compressed JPEG.
 *
 * @param file The original image File object
 * @param maxWidth Maximum width in pixels (defaults to 500)
 * @param maxHeight Maximum height in pixels (defaults to 500)
 * @param quality Compression quality from 0.0 to 1.0 (defaults to 0.7)
 * @returns A Promise resolving to a new File (compressed) or the original File if compression fails
 */
export function compressImage(
  file: File,
  maxWidth = 500,
  maxHeight = 500,
  quality = 0.7
): Promise<File> {
  // If the browser doesn't support canvas or FileReader, fallback to original file
  if (typeof window === 'undefined' || !window.HTMLCanvasElement || !window.FileReader) {
    return Promise.resolve(file);
  }

  // Only compress image files
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions keeping the aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Draw image on canvas (performs resizing)
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with the specified quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Convert blob back to a File object, keeping the original file name
              // but changing the extension and type to JPEG for maximum compression
              const nameWithoutExtension = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
              const compressedFile = new File([blob], `${nameWithoutExtension}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        resolve(file);
      };
    };
    reader.onerror = () => {
      resolve(file);
    };
  });
}
