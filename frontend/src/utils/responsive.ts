import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base size from a standard design (e.g., iPhone 11/13/14 size)
const baseWidth = 375;
const baseHeight = 812;

const scaleWidth = SCREEN_WIDTH / baseWidth;
const scaleHeight = SCREEN_HEIGHT / baseHeight;
const scale = Math.min(scaleWidth, scaleHeight);

/**
 * Normalizes size based on device screen density and base width.
 * Useful for fonts, margins, paddings.
 */
export const normalize = (size: number) => {
  const newSize = size * scale;
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  }
};

/**
 * Returns width percentage of current screen.
 * @param percentage 
 */
export const widthPercentage = (percentage: number) => {
  return (percentage * SCREEN_WIDTH) / 100;
};

/**
 * Returns height percentage of current screen.
 * @param percentage 
 */
export const heightPercentage = (percentage: number) => {
  return (percentage * SCREEN_HEIGHT) / 100;
};

export const SCREEN_DIMENSIONS = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
};
