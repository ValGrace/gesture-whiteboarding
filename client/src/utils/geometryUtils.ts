/**
 * Calculates the Euclidean distance between two points.
 * @param p1 Point 1 {x, y}
 * @param p2 Point 2 {x, y}
 * @returns Distance between p1 and p2
 */
export const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

/**
 * Normalizes a coordinate from range [0, 1] to [0, dimension]
 * @param value Normalized value (0 to 1)
 * @param dimension Width or Height
 * @returns Pixel coordinate
 */
export const toPixelUrl = (value: number, dimension: number): number => {
    return value * dimension;
};
