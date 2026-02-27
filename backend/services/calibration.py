"""Map calibration service – computes pixels-per-meter ratio."""

import math
from schemas.map import PointSchema


def compute_pixel_distance(p1: PointSchema, p2: PointSchema) -> float:
    """Euclidean distance between two pixel-coordinate points."""
    return math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)


def compute_pixels_per_meter(
    p1: PointSchema, p2: PointSchema, real_distance_m: float
) -> tuple[float, float]:
    """
    Given two pixel points and the real-world distance between them,
    return (pixels_per_meter, pixel_distance).
    """
    pixel_dist = compute_pixel_distance(p1, p2)
    if real_distance_m <= 0:
        raise ValueError("Real distance must be > 0")
    if pixel_dist == 0:
        raise ValueError("The two calibration points must be different")
    ppm = pixel_dist / real_distance_m
    return ppm, pixel_dist


def pixel_to_meter(
    point_px: PointSchema,
    origin_px: PointSchema,
    pixels_per_meter: float,
) -> tuple[float, float]:
    """Convert a pixel coordinate to real-world meters relative to the origin."""
    x_m = (point_px.x - origin_px.x) / pixels_per_meter
    y_m = (origin_px.y - point_px.y) / pixels_per_meter  # y is inverted in images
    return x_m, y_m


def meter_to_pixel(
    x_m: float,
    y_m: float,
    origin_px: PointSchema,
    pixels_per_meter: float,
) -> tuple[float, float]:
    """Convert real-world meter coordinates back to pixel coordinates."""
    px_x = origin_px.x + x_m * pixels_per_meter
    px_y = origin_px.y - y_m * pixels_per_meter  # y is inverted in images
    return px_x, px_y
