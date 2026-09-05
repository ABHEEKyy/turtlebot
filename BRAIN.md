# BRAIN: Pursuit and Evasion Strategy

## Mission

This repository separates the competition brain from the robot platform. The Catcher and Runner consume odometry and publish `geometry_msgs/Twist`, so the same decision logic can be tested in simulation and later connected to TurtleBot 4 Lite drivers.

## Control contracts

| Role | Pose input | Opponent input | Command output |
| --- | --- | --- | --- |
| Catcher | `/catcher/pose` | `/runner/pose` | `/catcher/cmd_vel` |
| Runner | `/runner/pose` | `/catcher/pose` | `/runner/cmd_vel` |

Inputs use `nav_msgs/Odometry`. Outputs use `geometry_msgs/Twist`.

## Catcher brain

1. Compute the bearing from the Catcher to the Runner.
2. Turn toward that bearing with proportional angular control.
3. Reduce forward speed when the heading error is large.
4. Stop once the separation is at or below `CAPTURE_DISTANCE_M`.

This baseline is deliberately understandable. Candidate improvements include velocity-obstacle prediction, occupancy-grid planning, lidar-based reacquisition, and a finite-state machine for search, pursuit, and capture.

## Runner brain

1. Compute the vector directly away from the Catcher.
2. Use that escape heading while the Catcher is within `threat_distance`.
3. Add a soft arena-boundary bias to avoid driving into the walls.
4. Continue moving instead of stopping when the threat is not currently visible.

Candidate improvements include waypoint selection, wall-following, randomized replanning, visibility reasoning, and a learned policy evaluated against deterministic baselines.

## Safety and scoring hooks

- Keep maximum linear and angular velocity parameters bounded.
- Treat missing pose data as a stop command.
- Keep capture distance and arena bounds in one shared module.
- Add a match referee node later for timer, capture, timeout, and score events.

## Known integration boundary

The current launch file starts Gazebo and autonomy nodes but does not select a particular TurtleBot 4 simulator implementation. Add the platform's robot spawn and odometry bridge in `simulation/launch/challenge.launch.py`, then remap its odometry and velocity topics to the contracts above. This avoids baking a distribution-specific assumption into the strategy code.
