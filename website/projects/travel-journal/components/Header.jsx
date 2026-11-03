import globeIcon from "../images/globe.png";

export default function Header() {
  return (
    <header>
      <img src={globeIcon} alt="Globe icon" />
      <h1>my travel journal.</h1>
    </header>
  );
}
