# TurtleBot Pursuit & Evasion Challenge

A ROS 2 and Gazebo starter workspace for a two-robot autonomous competition. The Catcher must locate and capture the Runner; the Runner must remain uncaptured for the match duration. TurtleBot 4 Lite is the tentative platform.

## Repository layout

- `src/catcher`: Catcher controller and ROS 2 package.
- `src/runner`: Runner controller and ROS 2 package.
- `src/shared`: Shared geometry, topics, and challenge constants.
- `simulation`: Gazebo arena and launch package.
- `config`: Controller parameters.
- `tests`: Fast geometry and configuration tests.
- `BRAIN.md`: Design decisions, interfaces, and extension points.
- `docs/WALKTHROUGH.md`: Setup and first-run walkthrough.

## Quick start

Use a ROS 2 installation with `gazebo_ros` and the selected TurtleBot 4 simulator packages available:

```bash
source /opt/ros/$ROS_DISTRO/setup.bash
colcon build --symlink-install
source install/setup.bash
ros2 launch turtlebot_pursuit_simulation challenge.launch.py
```

The launch file starts the bounded arena and both autonomy nodes. Robot spawning and odometry bridges are intentionally platform-specific; see `simulation/models/README.md` and `docs/WALKTHROUGH.md`.

Run the repository tests with:

```bash
python3 -m unittest discover -s tests
```

## Browser realism pipeline

The browser demo in `web/` uses Three.js with `MeshPhysicalMaterial`, ACES tone mapping, an HDRI environment loaded through `RGBELoader`, `EffectComposer`, SSAO, and bloom. Open it through a local server:

```powershell
cd web
py -3 -m http.server 5000
```

For authored assets, create and optimize models in Blender, export them as `.glb`, and place them in `web/assets/`. Substance 3D Painter can author the PBR texture maps that glTF stores in its material channels. The workspace recommends Cesium glTF Tools and shader language support through `.vscode/extensions.json`; those extensions inspect assets and shaders but are not runtime dependencies of the web app.

## Public web deployment

The browser app deploys automatically to GitHub Pages whenever `main` changes. After the first workflow run completes, it will be available at:

`https://abheekyy.github.io/turtlebot/`

In the GitHub repository, open **Settings > Pages** and set **Source** to **GitHub Actions** if Pages has not been enabled yet. The workflow is defined in `.github/workflows/deploy-pages.yml` and publishes only the `web/` folder.
