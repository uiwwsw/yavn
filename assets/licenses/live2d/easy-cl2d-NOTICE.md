NOTICE

This project contains modified portions of the following original software:

Live2D [CubismWebFramework](https://github.com/Live2D/CubismWebFramework)
Live2D [CubismWebSamples](https://github.com/Live2D/CubismWebSamples)
© Live2D Inc. https://www.live2d.com/

These original works are licensed under the Live2D Open Software License Agreement.
See `easy-cl2d-LICENSE.live2d.md` for details.

Summary of changes:
- Part of the code has been restructured so that the values is not set to `null` in the `constructor`.
- Written `Ticker` implementation to use `requestAnimationFrame` and remove the use of `Date.now()` for that
- Transparent canvas
- Function that starts up `CubismFramework` is exported
- Added callbacks `onTap` and `onIdle`
- Texture uses `document.createElement('img')` instead of `new Image()`
- Function that creates and renders model is externalized and exported
- Relationship between classes is slightly simplified
