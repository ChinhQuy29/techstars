import LumiMascot from "./LumiMascot";
import { EXPRESSIONS, type LumiExpression } from "./lumiAssets";

/** Developer/design sheet: every expression in both poses. Open with /?mascot=gallery (not linked in the app). */
export default function MascotGallery() {
  const names = Object.keys(EXPRESSIONS) as LumiExpression[];
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-3xl font-extrabold">Lumi mascot sheet</h1>
      <p className="mb-6 text-slate-500">All states from lumiAssets.ts. Front and three-quarter poses. Static (animation off).</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {names.map((n) => (
          <figure key={n} className="card flex flex-col items-center gap-2 p-4">
            <div className="flex items-end gap-2">
              <LumiMascot expression={n} pose="front" animated={false} label="auto" className="w-24" />
              <LumiMascot expression={n} pose="threeQuarter" animated={false} className="w-24" />
            </div>
            <figcaption className="font-bold">{n}</figcaption>
          </figure>
        ))}
        <figure className="card flex flex-col items-center gap-2 p-4">
          <div className="flex items-end gap-3">
            {(["xs", "sm", "md"] as const).map((sz) => (
              <LumiMascot key={sz} size={sz} animated={false} />
            ))}
          </div>
          <figcaption className="font-bold">sizes xs · sm · md</figcaption>
        </figure>
      </div>
    </main>
  );
}
