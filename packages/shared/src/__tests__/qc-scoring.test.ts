import { describe, it, expect } from 'vitest';
import { scoreShot, quickScore, getRecommendation } from '../qc-scoring.js';

describe('QC Scoring', () => {
  describe('getRecommendation', () => {
    it('should return approve for score >= 85', () => {
      expect(getRecommendation(85)).toBe('approve');
      expect(getRecommendation(100)).toBe('approve');
    });

    it('should return review for score 60-84', () => {
      expect(getRecommendation(60)).toBe('review');
      expect(getRecommendation(84)).toBe('review');
    });

    it('should return reject for score 30-59', () => {
      expect(getRecommendation(30)).toBe('reject');
      expect(getRecommendation(59)).toBe('reject');
    });

    it('should return regenerate for score < 30', () => {
      expect(getRecommendation(0)).toBe('regenerate');
      expect(getRecommendation(29)).toBe('regenerate');
    });
  });

  describe('quickScore', () => {
    it('should return a numeric score for a valid image buffer', () => {
      // Create a buffer with random data (simulating an image)
      const buffer = Buffer.alloc(10000);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
      }
      const score = quickScore(buffer, 1024, 1024);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should score very small buffers low', () => {
      const buffer = Buffer.alloc(100);
      const score = quickScore(buffer, 1024, 1024);
      // A 100-byte all-zeros buffer gets low technical score (10) but baseline
      // scores on other dimensions; overall should still be below normal quality
      expect(score).toBeLessThan(60);
    });
  });

  describe('scoreShot', () => {
    it('should return a full score result with all dimensions', () => {
      const buffer = Buffer.alloc(50000);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
      }
      const result = scoreShot({ imageBuffer: buffer, width: 1024, height: 1024 });
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
      expect(result.dimensions).toBeDefined();
      expect(result.dimensions.technical).toBeDefined();
      expect(result.dimensions.promptAdherence).toBeDefined();
      expect(result.dimensions.consistency).toBeDefined();
      expect(result.dimensions.composition).toBeDefined();
      expect(result.dimensions.colorQuality).toBeDefined();
      expect(result.recommendation).toBeDefined();
      expect(result.issues).toBeInstanceOf(Array);
    });

    it('should detect low resolution as an issue', () => {
      const buffer = Buffer.alloc(5000);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
      }
      const result = scoreShot({ imageBuffer: buffer, width: 128, height: 128 });
      expect(result.dimensions.technical).toBeLessThan(80);
    });

    it('should use previous shot for consistency scoring', () => {
      const buffer1 = Buffer.alloc(10000);
      const buffer2 = Buffer.alloc(10000);
      // Fill with similar data
      for (let i = 0; i < buffer1.length; i++) {
        buffer1[i] = 128;
        buffer2[i] = 130;
      }
      const result = scoreShot({
        imageBuffer: buffer2,
        width: 1024,
        height: 1024,
        previousShotBuffer: buffer1,
      });
      // Similar buffers should have high consistency
      expect(result.dimensions.consistency).toBeGreaterThan(70);
    });
  });
});
