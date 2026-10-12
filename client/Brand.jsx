export default function Brand({ href = '/', onClick }) {
  return (
    <a className="brand" href={href} aria-label="Darktide, início" onClick={onClick}>
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span>DARKTIDE<span className="brand-period">.</span></span>
    </a>
  );
}