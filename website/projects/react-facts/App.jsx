import Main from "./components/Main";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <div className="app-shell">
      <a className="back-link" href="../../founder.html">← Back to founder projects</a>
      <section className="facts-app" aria-label="React Facts project">
        <Navbar />
        <Main />
      </section>
    </div>
  );
}
