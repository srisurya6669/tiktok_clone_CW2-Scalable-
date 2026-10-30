
const images = [
  {
    src: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=700&q=85",
    alt: "City skyline at sunset",
  },
  {
    src: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=700&q=85",
    alt: "Golden retriever",
  },
  {
    src: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=700&q=85",
    alt: "Ocean and coastline",
  },
  {
    src: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=700&q=85",
    alt: "Music and headphones",
  },
  {
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=700&q=85",
    alt: "Mountain landscape",
  },
  {
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=85",
    alt: "Travel landscape",
  },
  {
    src: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=85",
    alt: "Coffee in a cafe",
  },
  {
    src: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=700&q=85",
    alt: "Live music festival",
  },
  {
    src: "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=700&q=85",
    alt: "City architecture",
  },
];

function VideoCollage() {
  return (
    <aside className="collage-panel" aria-label="Video inspiration collage">
      <div className="collage-grid">
        {images.map((image, index) => (
          <div
            className={`collage-tile tile-${index + 1}`}
            key={image.src}
          >
            <img src={image.src} alt={image.alt} />
          </div>
        ))}
      </div>
    </aside>
  );
}

export default VideoCollage;
