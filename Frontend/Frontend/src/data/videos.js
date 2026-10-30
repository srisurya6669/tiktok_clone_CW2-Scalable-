// Placeholder feed. Replace with a fetch from your backend when a videos API exists.
const BASE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample";

const videos = [
  { id: 1, title: "Big Buck Bunny", author: "blender", src: `${BASE}/BigBuckBunny.mp4`, poster: `${BASE}/images/BigBuckBunny.jpg` },
  { id: 2, title: "Elephants Dream", author: "orange", src: `${BASE}/ElephantsDream.mp4`, poster: `${BASE}/images/ElephantsDream.jpg` },
  { id: 3, title: "For Bigger Blazes", author: "google", src: `${BASE}/ForBiggerBlazes.mp4`, poster: `${BASE}/images/ForBiggerBlazes.jpg` },
  { id: 4, title: "For Bigger Escapes", author: "google", src: `${BASE}/ForBiggerEscapes.mp4`, poster: `${BASE}/images/ForBiggerEscapes.jpg` },
  { id: 5, title: "For Bigger Fun", author: "google", src: `${BASE}/ForBiggerFun.mp4`, poster: `${BASE}/images/ForBiggerFun.jpg` },
  { id: 6, title: "For Bigger Joyrides", author: "google", src: `${BASE}/ForBiggerJoyrides.mp4`, poster: `${BASE}/images/ForBiggerJoyrides.jpg` },
];

export default videos;
