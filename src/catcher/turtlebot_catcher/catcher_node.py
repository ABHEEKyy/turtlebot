import math

import rclpy
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from rclpy.node import Node

from turtlebot_pursuit_shared.geometry import Pose2D, angle_to, distance, wrap_angle
from turtlebot_pursuit_shared.parameters import CAPTURE_DISTANCE_M
from turtlebot_pursuit_shared.topics import CATCHER_CMD_VEL, CATCHER_POSE, RUNNER_POSE


class CatcherNode(Node):
    def __init__(self):
        super().__init__('catcher_node')
        self.declare_parameter('linear_speed', 0.45)
        self.declare_parameter('angular_gain', 2.2)
        self.declare_parameter('max_angular_speed', 2.5)
        self.pose = None
        self.runner_pose = None
        self.publisher = self.create_publisher(Twist, CATCHER_CMD_VEL, 10)
        self.create_subscription(Odometry, CATCHER_POSE, self._pose_callback, 10)
        self.create_subscription(Odometry, RUNNER_POSE, self._runner_callback, 10)
        self.create_timer(0.05, self._control_loop)

    def _pose_callback(self, message):
        self.pose = self._to_pose(message)

    def _runner_callback(self, message):
        self.runner_pose = self._to_pose(message)

    @staticmethod
    def _to_pose(message):
        orientation = message.pose.pose.orientation
        yaw = math.atan2(2.0 * (orientation.w * orientation.z), 1.0 - 2.0 * orientation.z**2)
        return Pose2D(message.pose.pose.position.x, message.pose.pose.position.y, yaw)

    def _control_loop(self):
        command = Twist()
        if self.pose is None or self.runner_pose is None:
            self.publisher.publish(command)
            return
        target_distance = distance(self.pose, self.runner_pose)
        if target_distance <= CAPTURE_DISTANCE_M:
            self.get_logger().info('Runner captured at %.2f m' % target_distance, once=True)
            self.publisher.publish(command)
            return
        heading_error = wrap_angle(angle_to(self.pose, self.runner_pose) - self.pose.yaw)
        command.linear.x = float(self.get_parameter('linear_speed').value) * max(0.0, math.cos(heading_error))
        command.angular.z = max(-float(self.get_parameter('max_angular_speed').value), min(
            float(self.get_parameter('max_angular_speed').value),
            float(self.get_parameter('angular_gain').value) * heading_error,
        ))
        self.publisher.publish(command)


def main(args=None):
    rclpy.init(args=args)
    node = CatcherNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
