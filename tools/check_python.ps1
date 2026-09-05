$ErrorActionPreference = 'Stop'
$files = @(
  'src/catcher/turtlebot_catcher/catcher_node.py',
  'src/runner/turtlebot_runner/runner_node.py',
  'src/shared/turtlebot_pursuit_shared/geometry.py',
  'src/shared/turtlebot_pursuit_shared/parameters.py',
  'src/shared/turtlebot_pursuit_shared/topics.py',
  'simulation/launch/challenge.launch.py'
)
py -3 -m py_compile $files
py -3 -m unittest discover -s tests
