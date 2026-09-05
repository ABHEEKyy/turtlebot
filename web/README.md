# Browser 3D demo

Open this app through a local HTTP server so the ES module imports resolve:

```powershell
cd web
py -3 -m http.server 5000
```

Then visit <http://localhost:5000>.

The demo is a visual browser simulation of the Catcher and Runner baseline strategies. It is independent from the ROS 2 runtime and does not replace the Gazebo launch path.
