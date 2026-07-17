import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_DIMENSION,
  fitWithinMaxDimension,
  isAcceptedImageType,
} from './imageCompression';

describe('fitWithinMaxDimension (lado más largo ≤ 1600 px)', () => {
  it('no cambia imágenes que ya cumplen el límite', () => {
    expect(fitWithinMaxDimension(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithinMaxDimension(1600, 1200)).toEqual({ width: 1600, height: 1200 });
  });

  it('reduce el lado más largo a 1600 manteniendo la proporción (horizontal)', () => {
    expect(fitWithinMaxDimension(3200, 2400)).toEqual({ width: 1600, height: 1200 });
  });

  it('reduce el lado más largo a 1600 manteniendo la proporción (vertical)', () => {
    expect(fitWithinMaxDimension(1500, 3000)).toEqual({ width: 800, height: 1600 });
  });

  it('nunca produce dimensiones menores a 1 px', () => {
    const result = fitWithinMaxDimension(1, 100000);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBe(MAX_IMAGE_DIMENSION);
  });
});

describe('isAcceptedImageType', () => {
  it('acepta JPG, PNG y WebP', () => {
    expect(isAcceptedImageType('image/jpeg')).toBe(true);
    expect(isAcceptedImageType('image/png')).toBe(true);
    expect(isAcceptedImageType('image/webp')).toBe(true);
  });

  it('rechaza otros formatos (PDF, GIF, HEIC)', () => {
    expect(isAcceptedImageType('application/pdf')).toBe(false);
    expect(isAcceptedImageType('image/gif')).toBe(false);
    expect(isAcceptedImageType('image/heic')).toBe(false);
  });
});
