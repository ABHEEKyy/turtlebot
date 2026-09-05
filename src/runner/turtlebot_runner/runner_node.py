import math

import rclpy
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from rclpy.node import Node

from turtlebot_pursuit_shared.geometry import Pose2D, angle_to, distance, wrap_angle
from turtlebot_pursuit_shared.parameters import ARENA_MAX_X, ARENA_MAX_Y, ARENA_MIN_X, ARENA_MIN_Y
from turtlebot_pursuit_shared.topics import CATCHER_POSE, RUNNER_CMD_VEL, RUNNER_POSE


class RunnerNode(Node):
    def __init__(self):
        super().__init__('runner_node')
        self.declare_parameter('linear_speed', 0.38)
        self.declare_parameter('angular_gain', 2.8)
        self.declare_parameter('threat_distance', 2.8)
        self.declare_parameter('boundary_margin', 1.0)
        self.pose = None
        self.catcher_pose = None
        self.publisher = self.create_publisher(Twist, RUNNER_CMD_VEL, 10)
        self.create_subscription(Odometry, RUNNER_POSE, self._pose_callback, 10)
        self.create_subscription(Odometry, CATCHER_POSE, self._catcher_callback, 10)
        self.create_timer(0.05, self._control_loop)

    def _pose_callback(self, message):
        self.pose = self._to_pose(message)

    def _catcher_callback(self, message):
        self.catcher_pose = self._to_pose(message)

    @staticmethod
    def _to_pose(message):
        orientation = message.pose.pose.orientation
        yaw = math.atan2(2.0 * orientation.w * orientation.z, 1.0 - 2.0 * orientation.z**2)
        return Pose2D(message.pose.pose.position.x, message.pose.pose.position.y, yaw)

    def _control_loop(self):
        command = Twist()
        if self.pose is None or self.catcher_pose is None:
            self.publisher.publish(command)
            return
        escape_heading = angle_to(self.catcher_pose, self.pose)
        threat_distance = distance(self.pose, self.catcher_pose)
        boundary_margin = float(self.get_parameter('boundary_margin').value)
        boundary_heading = self._boundary_correction(boundary_margin)
        if threat_distance < float(self.get_parameter('threat_distance').value):
            desired_heading = escape_heading + boundary_heading
        else:
            desired_heading = self.pose.yaw + boundary_heading
        heading_error = wrap_angle(desired_heading - self.pose.yaw)
        command.linear.x = float(self.get_parameter('linear_speed').value) * max(0.0, math.cos(heading_error))
        command.angular.z = max(-2.5, min(2.5, float(self.get_parameter('angular_gain').value) * heading_error))
        self.publisher.publish(command)

    def _boundary_correction(self, margin):
        correction = 0.0
        if self.pose.x < ARENA_MIN_X + margin:
            correction += 0.8
        if self.pose.x > ARENA_MAX_X - margin:
            correction -= 0.8
        if self.pose.y < ARENA_MIN_Y + margin:
            correction += math.pi / 2.0
        if self.pose.y > ARENA_MAX_Y - margin:
            correction -= math.pi / 2.0
        return correction


def main(args=None):
    rclpy.init(args=args)
    node = RunnerNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
