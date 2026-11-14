import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Widget } from "@/components/chat/Widget";
import { getChatProps } from "@/lib/public";
import { DEMO_SLUG } from "@/lib/session";
import { getStore } from "@/lib/store";
import "./larkspur.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Larkspur Night Line (Askwell demo site)" },
  description: "A made-up sleeper train company. Its help centre is the knowledge base for the Askwell demo.",
};

const CABINS = [
  {
    name: "Reclining seat",
    line: "A wide seat that tips back to 40 degrees, with a reading light, a socket and a blanket.",
  },
  {
    name: "Couchette",
    line: "A berth in a shared compartment of four. Ask for a women-only compartment when you book.",
  },
  {
    name: "Sleeper cabin",
    line: "A private, lockable cabin for one or two, beds made up, breakfast brought to your door.",
  },
  {
    name: "Grand sleeper",
    line: "Our largest cabin, with its own shower, a double bed on request, and dinner in the dining car.",
  },
];

const STOPS = ["Port Aveline", "Hartwell", "Morrow Junction", "Calder Pass", "Sorrel Heights"];

export default async function LarkspurPage() {
  const props = await getChatProps(DEMO_SLUG);
  if (!props) notFound();
  const store = await getStore();
  const business = await store.getBusiness(DEMO_SLUG);
  const documents = business ? await store.listDocuments(business.id) : [];

  return (
    <div className="lk">
      <p className="lk-notice">
        Larkspur Night Line is not a real company. This page is the demo site for{" "}
        <Link href="/">Askwell</Link>. Ask Wren a question, bottom right, then{" "}
        <Link href="/dashboard">see it from the owner&rsquo;s side</Link>.
      </p>

      <header className="lk-top">
        <span className="lk-logo">
          <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
            <path d="M19.5 4.5a10 10 0 1 0 4.5 14.5A8.2 8.2 0 0 1 19.5 4.5Z" fill="currentColor" />
          </svg>
          Larkspur Night Line
        </span>
        <nav aria-label="Larkspur">
          <a href="#timetable">Timetable</a>
          <a href="#cabins">Cabins</a>
          <a href="#help">Help centre</a>
        </nav>
      </header>

      <main>
        <section className="lk-hero">
          <h1>
            Fall asleep in Port Aveline.
            <br />
            <em>Wake up in Sorrel Heights.</em>
          </h1>
          <p>
            One train, every night, in both directions. Board after dinner, sleep through the mountains, and step
            off at breakfast time.
          </p>

          <svg className="lk-scene" viewBox="0 0 1200 220" role="img" aria-label="A night train with lit windows crossing a dark landscape">
            <g className="lk-stars" fill="#f1e9d8">
              {[[60, 30, 1.4], [150, 70, 1], [240, 22, 1.2], [330, 58, 0.9], [455, 34, 1.5], [540, 80, 1], [640, 26, 1.1], [735, 62, 1.4], [820, 18, 0.9], [905, 52, 1.2], [990, 30, 1], [1080, 72, 1.4], [1150, 24, 1.1], [400, 96, 0.8], [690, 100, 0.8], [1020, 104, 0.9]].map(
                ([x, y, r], i) => (
                  <circle key={i} cx={x} cy={y} r={r} />
                ),
              )}
            </g>
            <path d="M0 176 180 120l120 40 150-70 170 76 130-52 190 62 120-34 140 54v44H0Z" fill="#16224a" />
            <path d="M0 196h1200" stroke="#2a396e" strokeWidth="2" />
            <g className="lk-train">
              {[0, 1, 2, 3, 4, 5].map((c) => (
                <g key={c} transform={`translate(${c * 126} 0)`}>
                  <rect x="0" y="160" width="120" height="32" rx="6" fill="#0a1124" stroke="#33437d" />
                  {[0, 1, 2, 3].map((w) => (
                    <rect key={w} x={12 + w * 26} y="168" width="18" height="11" rx="2" fill={(c * 3 + w) % 5 === 0 ? "#253566" : "#f2b544"} />
                  ))}
                </g>
              ))}
              <path d="M756 192v-22a10 10 0 0 1 10-10h62c18 0 34 14 40 32Z" fill="#0a1124" stroke="#33437d" />
              <rect x="772" y="168" width="34" height="11" rx="2" fill="#f2b544" />
              <circle cx="868" cy="186" r="3" fill="#fff6d8" />
            </g>
          </svg>
        </section>

        <section className="lk-band" id="timetable" aria-labelledby="tt-title">
          <div>
            <h2 id="tt-title">Tonight&rsquo;s trains</h2>
            <p>Boarding opens 45 minutes before departure and closes 5 minutes before. The doors do not reopen.</p>
          </div>
          <table>
            <thead>
              <tr>
                <th scope="col">Direction</th>
                <th scope="col">Leaves</th>
                <th scope="col">Arrives</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Northbound</th>
                <td>
                  <b>20:15</b> Port Aveline
                </td>
                <td>
                  <b>07:40</b> Sorrel Heights
                </td>
              </tr>
              <tr>
                <th scope="row">Southbound</th>
                <td>
                  <b>20:50</b> Sorrel Heights
                </td>
                <td>
                  <b>08:05</b> Port Aveline
                </td>
              </tr>
            </tbody>
          </table>
          <ol className="lk-route" aria-label="Stations on the route">
            {STOPS.map((stop) => (
              <li key={stop}>{stop}</li>
            ))}
          </ol>
        </section>

        <section className="lk-cabins" id="cabins" aria-labelledby="cabins-title">
          <h2 id="cabins-title">Four ways to spend the night</h2>
          <dl>
            {CABINS.map((cabin) => (
              <div key={cabin.name}>
                <dt>{cabin.name}</dt>
                <dd>{cabin.line}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="lk-help" id="help" aria-labelledby="help-title">
          <div>
            <h2 id="help-title">Help centre</h2>
            <p>
              These {documents.length} pages are everything Wren knows. If your question is not covered here, Wren
              will say so and offer to pass it to a person.
            </p>
          </div>
          <ul>
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link href={`/demo/help/${doc.id}`}>{doc.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="lk-foot">
        <p>Larkspur Night Line is fictional. Any likeness to a real railway is a coincidence.</p>
        <Link href="/">Back to Askwell</Link>
      </footer>

      <Widget
        {...props}
        style={{ "--w-accent": "#f2b544", "--w-on-accent": "#0e1730", "--w-head": "#0e1730" } as React.CSSProperties}
      />
    </div>
  );
}
