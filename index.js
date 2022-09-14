/* JSONデータの出力 */

let trackingDataList = [];

// ログの削除
function clearLog() {
  trackingDataList = [];
  logConsole.value = '';
}

// JSONデータのダウンロード
function downloadJson() {
  const jsonData = { trackingDataList: trackingDataList };
  const blob = new Blob([JSON.stringify(jsonData, null, '  ')], {type: 'application\/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sample.json';
  link.click();
  URL.revokeObjectURL(url);
}

// JSONデータを記録する
let isRecording = false;
let logConsole = null;
function recordJson(trackingData) {
  if (!isRecording) return;
  trackingDataList.push(trackingData);
  logConsole.value = JSON.stringify(trackingData, null, '  ');
}

window.onload = () => {
  logConsole = document.getElementById('log');

  document.getElementById('download').addEventListener('click', function(){
    downloadJson();
    clearLog();
  });

  document.getElementById('clear').addEventListener('click', function(){
    clearLog();
  });

  const status = document.getElementById('status');
  document.getElementById('start').addEventListener('click', function(){
    isRecording = true;
    status.innerText = 'Recording';
  });

  document.getElementById('stop').addEventListener('click', function() {
    isRecording = false;
    status.innerText = 'Stop';
  });
};

/* メイン処理 */

let stream = null;

async function fetchVideoElement() {
  // Webカメラの映像を取得してVideoElementに描画
  const videoElement = document.getElementById('input_video')
  videoElement.width = 1280;
  videoElement.height = 720;
  const constraints = {video: true, audio: true};
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoElement.srcObject = stream;
  videoElement.muted = true;
  videoElement.play();
  const videoElementPlaying = new Promise(resolve => {
    videoElement.addEventListener('playing', resolve, {passive: true});
  });

  //ビデオが再生されるまで待機する
  await videoElementPlaying;

  return videoElement;
}

function release(videoElement) {
  stream.getTracks().forEach(track => track.stop());
  videoElement.srcObject = null;
  videoElement = null;
}

async function exec() {
  let videoElement = await fetchVideoElement();

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

  // 初期実行
  holistic.send({ image: videoElement })
  const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
  await sleep(10000);

  release(videoElement);
  await sleep(3000);
  videoElement = await fetchVideoElement();

  holistic.onResults(results => {
    let facelm = results.faceLandmarks;
    let poselm = results.poseLandmarks;
    let poselm3D = results.ea;
    let rightHandlm = results.rightHandLandmarks;
    let leftHandlm = results.leftHandLandmarks;

    const trackingData = {
      faceLandmarks: facelm,
      poseLandmarks: poselm,
      worldPoseLandmarks: poselm3D,
      rightHandLandmarks: rightHandlm,
      leftHandLandmarks: leftHandlm
    }

    // JSONを記録する
    recordJson(trackingData);

    /* kalidokit.js を利用する場合 */

    let faceRig = facelm ? Kalidokit.Face.solve(facelm, {runtime:'mediapipe', video: videoElement, imageSize:{width: 640, height: 480}}) : null;
    let poseRig = poselm && poselm3D ? Kalidokit.Pose.solve(poselm3D, poselm, {runtime:'mediapipe', video: videoElement, imageSize:{width: 640, height: 480}}) : null;
    let rightHandRig = rightHandlm ? Kalidokit.Hand.solve(rightHandlm, "Right") : null;
    let leftHandRig = leftHandlm ? Kalidokit.Hand.solve(leftHandlm, "Left") : null;

    // 出力データの確認
    // const trackingData = {
    //   face: faceRig,
    //   pose: poseRig,
    //   rightHandRig: rightHandRig,
    //   leftHandRig: leftHandRig,
    // }

    console.log(JSON.stringify(trackingData));
  });

  setInterval(() => {
    holistic.send({ image: videoElement })
  }, 1000/15);
}

exec();