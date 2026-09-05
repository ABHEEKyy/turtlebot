import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Pose2D:
    x: float
    y: float
    yaw: float


def distance(first: Pose2D, second: Pose2D) -> float:
    return math.hypot(second.x - first.x, second.y - first.y)


def angle_to(first: Pose2D, second: Pose2D) -> float:
    return math.atan2(second.y - first.y, second.x - first.x)


def wrap_angle(angle: float) -> float:
    return math.atan2(math.sin(angle), math.cos(angle))
