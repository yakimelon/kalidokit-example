// Webカメラの映像を取得してVideoElementに描画
const videoElement = document.querySelector(".input_video");
const constraints = {video: true, audio: true};
videoElement.srcObject = await navigator.mediaDevices.getUserMedia(constraints);
videoElement.muted = true;
videoElement.play();
const videoElementPlaying = new Promise(resolve => {
  videoElement.addEventListener('playing', resolve, {passive: true});
});

//ビデオが再生されるまで待機する
await videoElementPlaying;

// holisticの初期化
let holistic = new Holistic({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1635989137/${file}`;
  },
});

// 初期化が完了するまで待機する (これが無いとlocateFileが大量に呼び出される)
// 参考: https://github.com/google/mediapipe/issues/2823
await holistic.initialize();

holistic.setOptions({
  modelComplexity: 1,          //ランドマーク検出精度(0か1)
  smoothLandmarks: true,
  minDetectionConfidence: 0.7, //手を検出するための信頼値(0.0~1.0)
  minTrackingConfidence: 0.7,  //ランドマーク追跡の信頼度(0.0~1.0)
  refineFaceLandmarks: true,
});

holistic.onResults(results => {
  let facelm = results.faceLandmarks;
  let poselm = results.poseLandmarks;
  let poselm3D = results.ea;
  let rightHandlm = results.rightHandLandmarks;
  let leftHandlm = results.leftHandLandmarks;

  let faceRig = Kalidokit.Face.solve(facelm, {runtime:'mediapipe', video: videoElement, imageSize:{width: 640, height: 480}});
  let poseRig = Kalidokit.Pose.solve(poselm3D, poselm, {runtime:'mediapipe', video: videoElement, imageSize:{width: 640, height: 480}});
  let rightHandRig = rightHandlm ? Kalidokit.Hand.solve(rightHandlm, "Right") : null;
  let leftHandRig = leftHandlm ? Kalidokit.Hand.solve(leftHandlm, "Left") : null;

  // 出力データの確認
  const trackingData = {
    face: faceRig,
    pose: poseRig,
    rightHandRig: rightHandRig,
    leftHandRig: leftHandRig,
  }
  console.log(JSON.stringify(trackingData));
});

setInterval(() => {
  holistic.send({ image: videoElement })
}, 500);
