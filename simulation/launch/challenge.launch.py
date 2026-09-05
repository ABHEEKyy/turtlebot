from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    use_sim_time = LaunchConfiguration('use_sim_time')
    world = PathJoinSubstitution([
        FindPackageShare('turtlebot_pursuit_simulation'), 'worlds', 'pursuit_arena.world'
    ])
    gazebo = IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            FindPackageShare('gazebo_ros'), '/launch/gazebo.launch.py'
        ]),
        launch_arguments={'world': world}.items(),
    )
    return LaunchDescription([
        DeclareLaunchArgument('use_sim_time', default_value='true'),
        gazebo,
        Node(package='turtlebot_catcher', executable='catcher_node', name='catcher_node', parameters=[{'use_sim_time': use_sim_time}]),
        Node(package='turtlebot_runner', executable='runner_node', name='runner_node', parameters=[{'use_sim_time': use_sim_time}]),
    ])
