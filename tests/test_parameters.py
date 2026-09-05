import unittest

from src.shared.turtlebot_pursuit_shared.parameters import (
    ARENA_MAX_X,
    ARENA_MAX_Y,
    ARENA_MIN_X,
    ARENA_MIN_Y,
    CAPTURE_DISTANCE_M,
)


class ParameterTest(unittest.TestCase):
    def test_arena_bounds_are_ordered(self):
        self.assertLess(ARENA_MIN_X, ARENA_MAX_X)
        self.assertLess(ARENA_MIN_Y, ARENA_MAX_Y)

    def test_capture_distance_is_positive(self):
        self.assertGreater(CAPTURE_DISTANCE_M, 0.0)


if __name__ == '__main__':
    unittest.main()
