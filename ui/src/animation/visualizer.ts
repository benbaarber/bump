import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const fftSize = 2 ** 9;
const bufferLen = 2 ** 9;

const topX = fftSize / 2;
const topY = bufferLen;

export default class Visualizer {
  // Canvas
  canvas: HTMLCanvasElement;
  // cx: CanvasRenderingContext2D;
  parentWidth: number;
  frame: number;

  // Three
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  geometry: THREE.PlaneGeometry;

  // Audio
  audioContext: AudioContext;
  audioAnalyser: AnalyserNode;

  // Core
  topography: Uint8Array[];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // this.cx = canvas.getContext("2d");
    this.scale();
    this.parentWidth = canvas.parentElement.clientWidth;

    this.generateThreeScene();
    this.threeScale();
    window.addEventListener("resize", this.onResize.bind(this));

    this.setupAudio();

    this.topography = Array.from(Array(topY), () => new Uint8Array(topX));
  }

  scale() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = dpr * rect.width;
    const h = dpr * rect.height;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  threeScale() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  onResize() {
    if (this.parentWidth !== this.canvas.parentElement.clientWidth) {
      this.parentWidth = this.canvas.parentElement.clientWidth;
      this.scale();
    }
  }

  scaleFrequency(frequency: number): number {
    const minFreq = 10;
    const maxFreq = 20000;
    if (frequency < minFreq || frequency > maxFreq) return -1;
    return (
      (Math.log(frequency / minFreq) / Math.log(maxFreq / minFreq)) *
      this.canvas.width
    );
  }

  async setupAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    // const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, systemAudio: "include" } as any);
    const audioContext = new AudioContext({ sampleRate: 10000 });
    const sourceNode = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    sourceNode.connect(analyser);
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0.85;

    const frequencyPerBin = audioContext.sampleRate / analyser.fftSize;
    const minPitchBin = Math.floor(0 / frequencyPerBin);
    const maxPitchBin = Math.ceil(3000 / frequencyPerBin);
    const topX = maxPitchBin - minPitchBin;

    this.audioContext = audioContext;
    this.audioAnalyser = analyser;
    this.topography = Array.from(Array(topY), () => new Uint8Array(topX));
  }

  generateThreeScene() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x000022, 10, 20);
    this.scene.background = new THREE.Color("black");

    const ambientLight = new THREE.AmbientLight("white", 0.3);
    ambientLight.position.set(0, 10, 0);
    this.scene.add(ambientLight);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.canvas.width / this.canvas.height,
      0.1,
      1000,
    );
    this.camera.position.set(0, -15, 5);
    this.camera.up.set(0, 0, 1); // make rotate around z axis
    this.camera.lookAt(this.scene.position);
    new OrbitControls(this.camera, this.renderer.domElement);

    this.geometry = new THREE.PlaneGeometry(20, 20, topX - 1, topY - 1);

    const material = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      // flatShading: true,
      shininess: 50,
      specular: 0x444444,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(this.geometry, material);

    this.scene.add(mesh);

    const pointLight = new THREE.PointLight("magenta", 100, 20);
    pointLight.position.set(10, 10, 10);
    this.scene.add(pointLight);
    // this.pointLight = pointLight;

    const light1 = new THREE.DirectionalLight("cyan", 1);
    light1.position.set(10, 10, 10);
    this.scene.add(light1);
  }

  step() {
    this.computeWave();

    const positionAttr = this.geometry.getAttribute("position");
    for (let i = 0; i < positionAttr.count; i++) {
      const z = Math.max(
        this.topography[Math.floor(i / topX)][i % topX] / 32 - 2,
        0,
      );
      positionAttr.setZ(i, z);
    }
    positionAttr.needsUpdate = true;

    this.geometry.computeVertexNormals();
    this.renderer.render(this.scene, this.camera);
  }

  computeWave() {
    if (!this.audioAnalyser) return;

    const dataArray = new Uint8Array(topX);
    this.audioAnalyser.getByteFrequencyData(dataArray);

    const frequencyPerBin =
      this.audioContext.sampleRate / this.audioAnalyser.fftSize;
    const minPitchBin = Math.floor(0 / frequencyPerBin);
    const maxPitchBin = Math.ceil(5000 / frequencyPerBin);

    const scaledDataArray = dataArray.slice(minPitchBin, maxPitchBin);
    this.topography.push(scaledDataArray);
    this.topography.shift();
  }

  async start() {
    const animate = () => {
      this.step();
      this.frame = requestAnimationFrame(animate);
    };

    this.frame = window.requestAnimationFrame(animate);
  }

  stop() {
    if (this.frame) window.cancelAnimationFrame(this.frame);
    window.removeEventListener("resize", this.onResize);
  }
}
