# First-run walkthrough

## 1. Install prerequisites

Use Ubuntu with ROS 2, Gazebo, `gazebo_ros`, Python 3, and the TurtleBot 4 simulator package selected by the competition. Source ROS 2 in every terminal used for building or launching.

```bash
source /opt/ros/$ROS_DISTRO/setup.bash
```

## 2. Build the workspace

From the repository root:

```bash
colcon build --symlink-install
source install/setup.bash
```

The three Python packages install the autonomy nodes and shared module. The simulation package installs the arena world and launch files.

## 3. Connect the robot models

The arena is ready, but model spawning is distribution-specific. Add two TurtleBot 4 Lite instances to `simulation/launch/challenge.launch.py`. Each instance must publish `nav_msgs/Odometry` on `/catcher/pose` or `/runner/pose` and accept `geometry_msgs/Twist` on the corresponding command topic. Namespaces or remappings are recommended so the two robots do not share topics.

## 4. Launch

```bash
ros2 launch turtlebot_pursuit_simulation challenge.launch.py
```

The default controller parameters are in `config/catcher.yaml` and `config/runner.yaml`. Pass them through the launch file when the robot spawn actions are integrated.

## 5. Observe the contracts

```bash
ros2 topic echo /catcher/pose
ros2 topic echo /runner/pose
ros2 topic echo /catcher/cmd_vel
ros2 topic echo /runner/cmd_vel
```

If either pose topic is unavailable, its controller publishes a zero command. This is intentional fail-safe behavior.

## 6. Iterate on a strategy

Start with the baseline in `BRAIN.md`, then change one behavior at a time. Keep geometry tests fast and add scenario tests for capture distance, missing observations, walls, and timeout/referee behavior before comparing strategies.
