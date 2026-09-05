cmake_minimum_required(VERSION 3.8)
project(turtlebot_pursuit_simulation)

find_package(ament_cmake REQUIRED)

install(DIRECTORY launch worlds models
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
