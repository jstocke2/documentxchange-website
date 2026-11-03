import Header from "./components/Header";
import Entry from "./components/Entry";
import data from "./data";

export default function App() {
  const entryElements = data.map((entry) => (
    <Entry key={entry.id} {...entry} />
  ));

  return (
    <div className="app-shell">
      <a className="back-link" href="../../founder.html">← Back to founder projects</a>
      <section className="travel-app" aria-label="Travel Journal project">
        <Header />
        <main className="container">{entryElements}</main>
      </section>
    </div>
  );
}
