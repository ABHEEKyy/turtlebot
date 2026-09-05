import math
import unittest

from src.shared.turtlebot_pursuit_shared.geometry import Pose2D, angle_to, distance, wrap_angle


class GeometryTest(unittest.TestCase):
    def test_distance(self):
        self.assertAlmostEqual(distance(Pose2D(0.0, 0.0, 0.0), Pose2D(3.0, 4.0, 0.0)), 5.0)

    def test_angle_to(self):
        self.assertAlmostEqual(angle_to(Pose2D(0.0, 0.0, 0.0), Pose2D(0.0, 1.0, 0.0)), math.pi / 2.0)

    def test_wrap_angle(self):
        self.assertAlmostEqual(wrap_angle(3.0 * math.pi), math.pi)


if __name__ == '__main__':
    unittest.main()
