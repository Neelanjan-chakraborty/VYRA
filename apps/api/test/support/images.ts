import sharp from 'sharp';

/** A solid-colour test image; vary `seed` to get different content hashes. */
export function makeImage(
  seed: number,
  options: { width?: number; height?: number; format?: 'jpeg' | 'png' | 'webp' } = {},
): Promise<Buffer> {
  const { width = 800, height = 1000, format = 'jpeg' } = options;
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: (seed * 53) % 256, g: (seed * 97) % 256, b: (seed * 193) % 256 },
    },
  })
    .toFormat(format)
    .toBuffer();
}

/** JPEG carrying EXIF with a GPS position, to prove uploads strip it. */
export function makeImageWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 900, height: 900, channels: 3, background: '#557799' } })
    .withExif({
      IFD0: { Make: 'TestCam', Software: 'secret-device-id' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '12/1 58/1 0/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '77/1 35/1 0/1',
      },
    })
    .jpeg()
    .toBuffer();
}
